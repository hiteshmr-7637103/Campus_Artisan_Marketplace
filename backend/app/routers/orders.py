import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, require_verified
from ..models import AppConfig, Listing, ListingImage, ListingStatus, Order, OrderStatus, Review, SellerPublic, User
from ..ratelimit import ORDER_LIMIT, limiter
from ..schemas import OrderCreateIn, OrderOut, ReviewIn, MessageOut
from ..services import contact, razorpay
from ..services.uploads import image_url

router = APIRouter(tags=["orders"])


def order_out(db: Session, viewer: User, o: Order) -> OrderOut:
    listing = db.get(Listing, o.listing_id)
    img = db.execute(select(ListingImage.storage_path).where(ListingImage.listing_id == o.listing_id).order_by(ListingImage.position).limit(1)).scalar_one_or_none()
    seller = db.get(SellerPublic, o.seller_id)
    reviewed = db.execute(select(Review.id).where(Review.order_id == o.id)).first() is not None
    return OrderOut(
        id=o.id, listing_id=o.listing_id, listing_title=listing.title, listing_image=image_url(img) if img else None,
        seller_id=o.seller_id, seller_name=seller.display_name, amount_paise=o.amount_paise, status=o.status,
        needs_refund=o.needs_refund,
        payment_url=o.payment_url if o.status == OrderStatus.pending_payment else None,
        seller_contact=contact.seller_contact_for_order(db, viewer, o),
        reviewed=reviewed, created_at=o.created_at, paid_at=o.paid_at, fulfilled_at=o.fulfilled_at,
    )


def _own_order(db: Session, user: User, order_id: uuid.UUID) -> Order:
    o = db.execute(select(Order).where(Order.id == order_id, Order.buyer_id == user.id)).scalar_one_or_none()
    if o is None:
        raise HTTPException(404, "Order not found")  # 404, not 403: no information leak
    return o


@router.post("/orders", response_model=OrderOut, status_code=201)
@limiter.limit(ORDER_LIMIT)
def create_order(request: Request, body: OrderCreateIn, user: User = Depends(require_verified), db: Session = Depends(get_db)):
    listing = db.get(Listing, body.listing_id)
    if listing is None or listing.status != ListingStatus.active:
        raise HTTPException(404, "This item is no longer available")
    if listing.seller_id == user.id:
        raise HTTPException(400, "You cannot buy your own listing")
    # Re-use an open checkout by the same buyer for the same item.
    existing = db.execute(
        select(Order).where(Order.buyer_id == user.id, Order.listing_id == listing.id, Order.status == OrderStatus.pending_payment)
    ).scalars().first()
    if existing and existing.amount_paise == listing.price_paise and existing.payment_url:
        return order_out(db, user, existing)

    rate = Decimal(str(db.get(AppConfig, True).commission_rate))
    amount = listing.price_paise  # always from the DB, never from the client
    commission = int((Decimal(amount) * rate).to_integral_value())
    order = Order(
        buyer_id=user.id, seller_id=listing.seller_id, listing_id=listing.id, amount_paise=amount,
        commission_rate=rate, commission_paise=commission, seller_amount_paise=amount - commission,
    )
    db.add(order)
    db.flush()
    try:
        link_id, url = razorpay.create_payment_link(order, listing.title, user.full_name, user.email)
    except Exception:
        db.rollback()
        raise HTTPException(502, "Could not start the payment. Please try again.") from None
    order.razorpay_payment_link_id = link_id
    order.payment_url = url
    db.commit()
    return order_out(db, user, order)


@router.get("/orders", response_model=list[OrderOut])
def my_orders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    orders = db.execute(select(Order).where(Order.buyer_id == user.id).order_by(Order.created_at.desc())).scalars().all()
    return [order_out(db, user, o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return order_out(db, user, _own_order(db, user, order_id))


@router.post("/orders/{order_id}/review", response_model=MessageOut, status_code=201)
def review_order(order_id: uuid.UUID, body: ReviewIn, user: User = Depends(require_verified), db: Session = Depends(get_db)):
    o = _own_order(db, user, order_id)
    if o.status != OrderStatus.fulfilled:
        raise HTTPException(400, "You can review an order once it has been fulfilled")
    db.add(Review(order_id=o.id, buyer_id=user.id, seller_id=o.seller_id, listing_id=o.listing_id, rating=body.rating, comment=body.comment))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already reviewed this order") from None
    return MessageOut(message="Thanks for your review!")
