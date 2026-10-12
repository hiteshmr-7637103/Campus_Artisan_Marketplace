import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, require_seller, require_verified
from ..models import (
    Category, Listing, ListingImage, ListingStatus, Order, Payout, SellerPrivate, SellerPublic,
    SellerStatus, User,
)
from ..schemas import (
    ImageOut, ListingCreateIn, ListingUpdateIn, MessageOut, SellerApplyIn, SellerListingOut, SellerMeOut,
    SellerOrderOut, SellerPayoutOut,
)
from ..services import contact, uploads

router = APIRouter(prefix="/seller", tags=["seller"])
MAX_IMAGES = 3


@router.post("/apply", response_model=SellerMeOut, status_code=201)
def apply(body: SellerApplyIn, user: User = Depends(require_verified), db: Session = Depends(get_db)):
    if user.seller_status in (SellerStatus.pending, SellerStatus.approved):
        raise HTTPException(409, "You have already applied")
    pub = db.get(SellerPublic, user.id)
    if pub is None:  # re-application after a rejection updates the existing rows
        db.add(SellerPublic(seller_id=user.id, display_name=body.display_name, bio=body.bio))
        db.add(SellerPrivate(seller_id=user.id, phone=body.phone, instagram=body.instagram, upi_id=body.upi_id))
    else:
        pub.display_name, pub.bio = body.display_name, body.bio
        priv = db.get(SellerPrivate, user.id)
        priv.phone, priv.instagram, priv.upi_id = body.phone, body.instagram, body.upi_id
    user.seller_status = SellerStatus.pending
    db.commit()
    return _me(db, user)


def _me(db: Session, user: User) -> SellerMeOut:
    pub = db.get(SellerPublic, user.id)
    priv = contact.read_seller_private(db, user, user.id) if pub else None  # owner read
    return SellerMeOut(
        seller_status=user.seller_status,
        display_name=pub.display_name if pub else None, bio=pub.bio if pub else None,
        phone=priv.phone if priv else None, instagram=priv.instagram if priv else None, upi_id=priv.upi_id if priv else None,
    )


@router.get("/me", response_model=SellerMeOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _me(db, user)


def _listing_out(db: Session, l: Listing) -> SellerListingOut:
    imgs = db.execute(select(ListingImage).where(ListingImage.listing_id == l.id).order_by(ListingImage.position)).scalars().all()
    cat = db.get(Category, l.category_id)
    return SellerListingOut(
        id=l.id, title=l.title, description=l.description, price_paise=l.price_paise, category_id=l.category_id,
        category=cat.name, status=l.status, reject_reason=l.reject_reason, created_at=l.created_at,
        images=[ImageOut(id=i.id, url=uploads.image_url(i.storage_path), position=i.position) for i in imgs],
    )


def _own_listing(db: Session, user: User, listing_id: uuid.UUID) -> Listing:
    l = db.execute(select(Listing).where(Listing.id == listing_id, Listing.seller_id == user.id)).scalar_one_or_none()
    if l is None:
        raise HTTPException(404, "Listing not found")
    return l


def _check_category(db: Session, category_id: uuid.UUID) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(400, "Unknown category")


@router.get("/listings", response_model=list[SellerListingOut])
def my_listings(user: User = Depends(require_seller), db: Session = Depends(get_db)):
    rows = db.execute(select(Listing).where(Listing.seller_id == user.id).order_by(Listing.created_at.desc())).scalars().all()
    return [_listing_out(db, l) for l in rows]


@router.post("/listings", response_model=SellerListingOut, status_code=201)
def create_listing(body: ListingCreateIn, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    _check_category(db, body.category_id)
    l = Listing(seller_id=user.id, **body.model_dump())  # status defaults to pending_review
    db.add(l)
    db.commit()
    return _listing_out(db, l)


@router.get("/listings/{listing_id}", response_model=SellerListingOut)
def get_listing(listing_id: uuid.UUID, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    return _listing_out(db, _own_listing(db, user, listing_id))


@router.patch("/listings/{listing_id}", response_model=SellerListingOut)
def update_listing(listing_id: uuid.UUID, body: ListingUpdateIn, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    l = _own_listing(db, user, listing_id)
    if l.status in (ListingStatus.sold, ListingStatus.archived):
        raise HTTPException(409, f"A {l.status.value} listing cannot be edited")
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data:
        if data["category_id"] is None:
            raise HTTPException(400, "category_id cannot be null")
        _check_category(db, data["category_id"])
    for k, v in data.items():
        if v is None:
            raise HTTPException(400, f"{k} cannot be null")
        setattr(l, k, v)
    if l.status == ListingStatus.rejected:  # fixing a rejected listing resubmits it for review
        l.status, l.reject_reason = ListingStatus.pending_review, None
    db.commit()
    return _listing_out(db, l)


@router.post("/listings/{listing_id}/archive", response_model=SellerListingOut)
def archive_listing(listing_id: uuid.UUID, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    l = _own_listing(db, user, listing_id)
    if l.status == ListingStatus.sold:
        raise HTTPException(409, "A sold listing cannot be archived")
    l.status = ListingStatus.archived
    db.commit()
    return _listing_out(db, l)


@router.post("/listings/{listing_id}/images", response_model=ImageOut, status_code=201)
def upload_image(listing_id: uuid.UUID, file: UploadFile = File(...), user: User = Depends(require_seller), db: Session = Depends(get_db)):
    l = _own_listing(db, user, listing_id)
    used = set(db.execute(select(ListingImage.position).where(ListingImage.listing_id == l.id)).scalars().all())
    free = [p for p in range(MAX_IMAGES) if p not in used]
    if not free:
        raise HTTPException(400, f"A listing can have at most {MAX_IMAGES} images")
    rel = uploads.save_image(file, user.id)
    img = ListingImage(listing_id=l.id, storage_path=rel, position=free[0])
    db.add(img)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        uploads.delete_image(rel)
        raise HTTPException(409, "Please retry the upload") from None
    return ImageOut(id=img.id, url=uploads.image_url(rel), position=img.position)


@router.delete("/listings/{listing_id}/images/{image_id}", response_model=MessageOut)
def delete_image(listing_id: uuid.UUID, image_id: uuid.UUID, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    l = _own_listing(db, user, listing_id)
    img = db.execute(select(ListingImage).where(ListingImage.id == image_id, ListingImage.listing_id == l.id)).scalar_one_or_none()
    if img is None:
        raise HTTPException(404, "Image not found")
    rel = img.storage_path
    db.delete(img)
    db.commit()
    uploads.delete_image(rel)
    return MessageOut(message="Deleted")


@router.get("/orders", response_model=list[SellerOrderOut])
def my_orders(user: User = Depends(require_seller), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Order, Listing.title, User.full_name, User.phone)
        .join(Listing, Listing.id == Order.listing_id)
        .join(User, User.id == Order.buyer_id)
        .where(Order.seller_id == user.id)
        .order_by(Order.created_at.desc())
    ).all()
    out = []
    for o, title, bname, bphone in rows:
        show = contact.buyer_contact_visible(o)
        out.append(SellerOrderOut(
            id=o.id, listing_title=title, amount_paise=o.amount_paise, seller_amount_paise=o.seller_amount_paise,
            status=o.status, needs_refund=o.needs_refund, buyer_name=bname if show else None,
            buyer_phone=bphone if show else None, created_at=o.created_at, paid_at=o.paid_at, fulfilled_at=o.fulfilled_at,
        ))
    return out


@router.get("/payouts", response_model=list[SellerPayoutOut])
def my_payouts(user: User = Depends(require_seller), db: Session = Depends(get_db)):
    rows = db.execute(select(Payout).where(Payout.seller_id == user.id).order_by(Payout.created_at.desc())).scalars().all()
    return [SellerPayoutOut(id=p.id, order_id=p.order_id, amount_paise=p.amount_paise, status=p.status, upi_txn_ref=p.upi_txn_ref, paid_at=p.paid_at, created_at=p.created_at) for p in rows]
