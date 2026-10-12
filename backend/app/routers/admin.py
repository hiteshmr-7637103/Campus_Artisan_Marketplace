import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import (
    Category, Listing, ListingImage, ListingStatus, Order, OrderStatus, Payout, PayoutStatus,
    SellerPrivate, SellerPublic, SellerStatus, User, UserRole,
)
from ..schemas import (
    AdminListingOut, AdminOrderOut, AdminPayoutOut, AdminSellerOut, DecisionIn, ListingDecisionIn,
    MarkPaidIn, MessageOut, MetricsOut,
)
from ..services import contact, email, uploads

# Every route depends on require_admin (checked server-side, per request).
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---- sellers ---------------------------------------------------------------
@router.get("/sellers", response_model=list[AdminSellerOut])
def sellers(status: SellerStatus | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(User).where(User.seller_status != SellerStatus.none).order_by(User.created_at.desc())
    if status:
        q = q.where(User.seller_status == status)
    out = []
    for u in db.execute(q).scalars():
        pub = db.get(SellerPublic, u.id)
        priv = contact.read_seller_private(db, admin, u.id)
        out.append(AdminSellerOut(
            id=u.id, email=u.email, full_name=u.full_name, seller_status=u.seller_status,
            display_name=pub.display_name if pub else None, bio=pub.bio if pub else None,
            phone=priv.phone if priv else None, instagram=priv.instagram if priv else None,
            upi_id=priv.upi_id if priv else None, created_at=u.created_at,
        ))
    return out


@router.post("/sellers/{seller_id}/decision", response_model=MessageOut)
def seller_decision(seller_id: uuid.UUID, body: DecisionIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    u = db.get(User, seller_id)
    if u is None or u.seller_status != SellerStatus.pending:
        raise HTTPException(404, "No pending application")
    approved = body.decision == "approve"
    u.seller_status = SellerStatus.approved if approved else SellerStatus.rejected
    if approved and u.role == UserRole.buyer:
        u.role = UserRole.seller
    db.commit()
    background.add_task(email.send_seller_decision, u.email, approved, body.reason)
    return MessageOut(message="Approved" if approved else "Rejected")


# ---- listings --------------------------------------------------------------
@router.get("/listings", response_model=list[AdminListingOut])
def listings(status: ListingStatus | None = None, db: Session = Depends(get_db)):
    q = (
        select(Listing, Category.name, SellerPublic.display_name)
        .join(Category, Category.id == Listing.category_id)
        .join(SellerPublic, SellerPublic.seller_id == Listing.seller_id)
        .order_by(Listing.created_at.desc())
        .limit(200)
    )
    if status:
        q = q.where(Listing.status == status)
    out = []
    for l, cat, sname in db.execute(q).all():
        imgs = db.execute(select(ListingImage.storage_path).where(ListingImage.listing_id == l.id).order_by(ListingImage.position)).scalars().all()
        out.append(AdminListingOut(
            id=l.id, title=l.title, description=l.description, price_paise=l.price_paise, category=cat,
            status=l.status, reject_reason=l.reject_reason, seller_id=l.seller_id, seller_name=sname,
            images=[uploads.image_url(p) for p in imgs], created_at=l.created_at,
        ))
    return out


@router.post("/listings/{listing_id}/decision", response_model=MessageOut)
def listing_decision(listing_id: uuid.UUID, body: ListingDecisionIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    l = db.get(Listing, listing_id)
    if l is None:
        raise HTTPException(404, "Listing not found")
    if body.decision == "archive":
        if l.status == ListingStatus.sold:
            raise HTTPException(409, "A sold listing cannot be archived")
        l.status = ListingStatus.archived
        db.commit()
        return MessageOut(message="Archived")
    if l.status != ListingStatus.pending_review:
        raise HTTPException(409, "Only listings pending review can be approved or rejected")
    approved = body.decision == "approve"
    l.status = ListingStatus.active if approved else ListingStatus.rejected
    l.reject_reason = None if approved else body.reason
    seller = db.get(User, l.seller_id)
    db.commit()
    background.add_task(email.send_listing_decision, seller.email, l.title, approved, body.reason)
    return MessageOut(message="Approved" if approved else "Rejected")


# ---- orders ----------------------------------------------------------------
@router.get("/orders", response_model=list[AdminOrderOut])
def orders(status: OrderStatus | None = None, needs_refund: bool | None = None, db: Session = Depends(get_db)):
    q = (
        select(Order, Listing.title, User.full_name, User.email, SellerPublic.display_name)
        .join(Listing, Listing.id == Order.listing_id)
        .join(User, User.id == Order.buyer_id)
        .join(SellerPublic, SellerPublic.seller_id == Order.seller_id)
        .order_by(Order.needs_refund.desc(), Order.created_at.desc())
        .limit(300)
    )
    if status:
        q = q.where(Order.status == status)
    if needs_refund is not None:
        q = q.where(Order.needs_refund == needs_refund)
    return [
        AdminOrderOut(
            id=o.id, listing_id=o.listing_id, listing_title=t, buyer_name=bn, buyer_email=be, seller_id=o.seller_id,
            seller_name=sn, amount_paise=o.amount_paise, commission_paise=o.commission_paise,
            seller_amount_paise=o.seller_amount_paise, status=o.status, needs_refund=o.needs_refund,
            created_at=o.created_at, paid_at=o.paid_at, fulfilled_at=o.fulfilled_at,
        )
        for o, t, bn, be, sn in db.execute(q).all()
    ]


def _locked_order(db: Session, order_id: uuid.UUID) -> Order:
    o = db.execute(select(Order).where(Order.id == order_id).with_for_update()).scalar_one_or_none()
    if o is None:
        raise HTTPException(404, "Order not found")
    return o


@router.post("/orders/{order_id}/fulfill", response_model=MessageOut)
def fulfill(order_id: uuid.UUID, background: BackgroundTasks, db: Session = Depends(get_db)):
    o = _locked_order(db, order_id)
    if o.status != OrderStatus.paid or o.needs_refund:
        raise HTTPException(409, "Only paid orders (not flagged for refund) can be fulfilled")
    o.status, o.fulfilled_at = OrderStatus.fulfilled, _now()
    buyer, title = db.get(User, o.buyer_id), db.get(Listing, o.listing_id).title
    db.commit()
    background.add_task(email.send_order_fulfilled, buyer.email, title, str(o.id))
    return MessageOut(message="Order fulfilled")


@router.post("/orders/{order_id}/cancel", response_model=MessageOut)
def cancel(order_id: uuid.UUID, db: Session = Depends(get_db)):
    o = _locked_order(db, order_id)
    if o.status != OrderStatus.pending_payment:
        raise HTTPException(409, "Only unpaid orders can be cancelled; use refund for paid orders")
    o.status = OrderStatus.cancelled
    link = o.razorpay_payment_link_id
    db.commit()
    from ..services import razorpay

    razorpay.cancel_payment_link(link)
    return MessageOut(message="Order cancelled")


@router.post("/orders/{order_id}/refund", response_model=MessageOut)
def refund(order_id: uuid.UUID, db: Session = Depends(get_db)):
    """Records that a refund was done manually in the Razorpay dashboard."""
    o = _locked_order(db, order_id)
    if o.status not in (OrderStatus.paid, OrderStatus.fulfilled):
        raise HTTPException(409, "Only paid orders can be marked refunded")
    payout = db.execute(select(Payout).where(Payout.order_id == o.id)).scalar_one_or_none()
    if payout is not None:
        if payout.status == PayoutStatus.paid:
            raise HTTPException(409, "The seller has already been paid for this order")
        db.delete(payout)
    o.status = OrderStatus.refunded
    db.commit()
    return MessageOut(message="Marked refunded")


# ---- payouts ---------------------------------------------------------------
@router.get("/payouts", response_model=list[AdminPayoutOut])
def payouts(status: PayoutStatus | None = None, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = select(Payout, SellerPublic.display_name).join(SellerPublic, SellerPublic.seller_id == Payout.seller_id).order_by(Payout.created_at.desc())
    if status:
        q = q.where(Payout.status == status)
    out = []
    for p, name in db.execute(q).all():
        priv = contact.read_seller_private(db, admin, p.seller_id)
        out.append(AdminPayoutOut(
            id=p.id, order_id=p.order_id, seller_id=p.seller_id, seller_name=name, upi_id=priv.upi_id if priv else None,
            amount_paise=p.amount_paise, status=p.status, upi_txn_ref=p.upi_txn_ref, paid_at=p.paid_at, created_at=p.created_at,
        ))
    return out


@router.post("/payouts/{payout_id}/mark-paid", response_model=MessageOut)
def mark_payout_paid(payout_id: uuid.UUID, body: MarkPaidIn, db: Session = Depends(get_db)):
    p = db.execute(select(Payout).where(Payout.id == payout_id).with_for_update()).scalar_one_or_none()
    if p is None:
        raise HTTPException(404, "Payout not found")
    if p.status == PayoutStatus.paid:
        raise HTTPException(409, "Already marked paid")
    p.status, p.upi_txn_ref, p.paid_at = PayoutStatus.paid, body.upi_txn_ref, _now()
    db.commit()
    return MessageOut(message="Payout recorded")


# ---- metrics ---------------------------------------------------------------
@router.get("/metrics", response_model=MetricsOut)
def metrics(db: Session = Depends(get_db)):
    def count(q) -> int:
        return db.execute(q).scalar_one()

    paid = (OrderStatus.paid, OrderStatus.fulfilled)
    ok = Order.needs_refund.is_(False)
    return MetricsOut(
        signups=count(select(func.count(User.id))),
        verified_signups=count(select(func.count(User.id)).where(User.email_verified_at.is_not(None))),
        active_sellers=count(select(func.count(func.distinct(Listing.seller_id))).where(Listing.status == ListingStatus.active)),
        listings_active=count(select(func.count(Listing.id)).where(Listing.status == ListingStatus.active)),
        listings_total=count(select(func.count(Listing.id))),
        checkouts_started=count(select(func.count(Order.id))),
        paid_orders=count(select(func.count(Order.id)).where(Order.status.in_(paid), ok)),
        gmv_paise=count(select(func.coalesce(func.sum(Order.amount_paise), 0)).where(Order.status.in_(paid), ok)),
        commission_paise=count(select(func.coalesce(func.sum(Order.commission_paise), 0)).where(Order.status.in_(paid), ok)),
    )
