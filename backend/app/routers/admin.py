import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import require_admin_2fa, step_up
from ..models import (
    Category, Listing, ListingImage, ListingStatus, Order, OrderStatus, Payout, PayoutAdjustment,
    PayoutStatement, PayoutStatus, SellerPrivate, SellerPublic, SellerStatus, User, UserRole,
)
from ..schemas import (
    AdjustmentOut, AdminListingOut, AdminOrderOut, AdminPayoutOut, AdminSellerOut, DecisionIn, FinanceOut,
    ListingDecisionIn, MarkPaidIn, MessageOut, MetricsOut, PayoutTotalsOut, SellerLedgerOut, StatementOut, StepUpIn,
)
from ..services import contact, email, payouts, statements, uploads

# Every route requires a completed admin login (2FA included), checked server-side, per request.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin_2fa)])


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---- sellers ---------------------------------------------------------------
@router.get("/sellers", response_model=list[AdminSellerOut])
def sellers(status: SellerStatus | None = None, admin: User = Depends(require_admin_2fa), db: Session = Depends(get_db)):
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
    payouts.create_for_order(db, o)
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
    o.status, o.needs_refund = OrderStatus.refunded, True
    db.commit()
    try:
        payouts.hold_for_refund(db, o.id)
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    return MessageOut(message="Marked refunded")


# ---- payouts (ledger) -------------------------------------------------------
def _ledger_query(seller_id=None, status=None, method=None, search=None, date_from=None, date_to=None):
    q = select(Payout, SellerPublic.display_name).join(SellerPublic, SellerPublic.seller_id == Payout.seller_id)
    if seller_id:
        q = q.where(Payout.seller_id == seller_id)
    if status:
        q = q.where(Payout.status == status)
    if method:
        q = q.where(Payout.provider == method)
    if search:
        try:
            q = q.where(Payout.order_id == uuid.UUID(search))
        except ValueError:
            q = q.where(Payout.upi_txn_ref.ilike(f"%{search}%"))
    if date_from:
        q = q.where(Payout.created_at >= date_from)
    if date_to:
        q = q.where(Payout.created_at < date_to)
    return q.order_by(Payout.created_at.desc())


@router.get("/payouts", response_model=list[AdminPayoutOut])
def list_payouts(
    status: PayoutStatus | None = None, seller_id: uuid.UUID | None = None, method: str | None = None,
    search: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None,
    admin: User = Depends(require_admin_2fa), db: Session = Depends(get_db),
):
    q = _ledger_query(seller_id, status, method, search, date_from, date_to).limit(500)
    out = []
    for p, name in db.execute(q).all():
        priv = contact.read_seller_private(db, admin, p.seller_id)
        out.append(AdminPayoutOut(
            id=p.id, order_id=p.order_id, seller_id=p.seller_id, seller_name=name, upi_id=priv.upi_id if priv else None,
            gross_paise=p.gross_paise, commission_paise=p.commission_paise, amount_paise=p.amount_paise,
            status=p.status, provider=p.provider, is_exception=p.is_exception, exception_reason=p.exception_reason,
            eligible_at=p.eligible_at, upi_txn_ref=p.upi_txn_ref, paid_at=p.paid_at, created_at=p.created_at,
        ))
    return out


@router.get("/payouts/totals", response_model=PayoutTotalsOut)
def payout_totals(
    seller_id: uuid.UUID | None = None, status: PayoutStatus | None = None, method: str | None = None,
    search: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    q = _ledger_query(seller_id, status, method, search, date_from, date_to)
    rows = db.execute(q).all()
    def total(pred):
        return sum(p.amount_paise for p, _ in rows if pred(p))
    return PayoutTotalsOut(
        orders=len(rows),
        gross_paise=sum(p.gross_paise for p, _ in rows),
        commission_paise=sum(p.commission_paise for p, _ in rows),
        net_paid_paise=total(lambda p: p.status == PayoutStatus.paid),
        pending_paise=total(lambda p: p.status in (PayoutStatus.pending, PayoutStatus.eligible, PayoutStatus.processing)),
        on_hold_paise=total(lambda p: p.status == PayoutStatus.on_hold),
    )


@router.get("/payouts/export.csv")
def export_payouts_csv(
    seller_id: uuid.UUID | None = None, status: PayoutStatus | None = None, method: str | None = None,
    search: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    q = _ledger_query(seller_id, status, method, search, date_from, date_to)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["payout_id", "order_id", "seller_id", "gross_paise", "commission_paise", "net_paise", "status", "provider", "utr", "paid_at", "created_at"])
    for p, _ in db.execute(q).all():
        w.writerow([p.id, p.order_id, p.seller_id, p.gross_paise, p.commission_paise, p.amount_paise, p.status.value, p.provider, p.upi_txn_ref or "", p.paid_at or "", p.created_at])
    buf.seek(0)
    return StreamingResponse(buf, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=payouts.csv"})


@router.get("/payouts/adjustments", response_model=list[AdjustmentOut])
def list_adjustments(seller_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    q = select(PayoutAdjustment).order_by(PayoutAdjustment.created_at.desc())
    if seller_id:
        q = q.where(PayoutAdjustment.seller_id == seller_id)
    return [
        AdjustmentOut(
            id=a.id, seller_id=a.seller_id, payout_id=a.payout_id, order_id=a.order_id,
            amount_paise=a.amount_paise, reason=a.reason, settled_in_payout_id=a.settled_in_payout_id, created_at=a.created_at,
        )
        for a in db.execute(q).scalars()
    ]


@router.get("/payouts/sellers/{seller_id}", response_model=SellerLedgerOut)
def seller_ledger(seller_id: uuid.UUID, db: Session = Depends(get_db)):
    rows = db.execute(select(Payout).where(Payout.seller_id == seller_id)).scalars().all()
    paid = [p for p in rows if p.status == PayoutStatus.paid]
    last_paid = max((p.paid_at for p in paid if p.paid_at), default=None)
    priv = db.get(SellerPrivate, seller_id)
    rolling_cutoff = _now() - timedelta(weeks=8)
    return SellerLedgerOut(
        seller_id=seller_id,
        lifetime_paid_paise=sum(p.amount_paise for p in paid),
        rolling_8w_paid_paise=sum(p.amount_paise for p in paid if p.paid_at and p.paid_at >= rolling_cutoff),
        pending_paise=sum(p.amount_paise for p in rows if p.status in (PayoutStatus.pending, PayoutStatus.eligible, PayoutStatus.processing)),
        on_hold_paise=sum(p.amount_paise for p in rows if p.status == PayoutStatus.on_hold),
        order_count=len(paid),
        average_order_paise=round(sum(p.gross_paise for p in paid) / len(paid)) if paid else 0,
        last_payout_at=last_paid,
        upi_id=priv.upi_id if priv else None,
        upi_updated_at=priv.upi_updated_at if priv else None,
    )


@router.post("/payouts/{payout_id}/mark-paid", response_model=MessageOut)
def mark_payout_paid(payout_id: uuid.UUID, body: MarkPaidIn, admin: User = Depends(require_admin_2fa), db: Session = Depends(get_db)):
    step_up(admin, body.totp_code, db)  # moving real money: a fresh code, even in a live session
    p = db.execute(select(Payout).where(Payout.id == payout_id).with_for_update()).scalar_one_or_none()
    if p is None:
        raise HTTPException(404, "Payout not found")
    try:
        payouts.mark_paid_manual(db, p, body.upi_txn_ref)
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    return MessageOut(message="Payout recorded")


@router.post("/payouts/{payout_id}/release", response_model=MessageOut)
def release_payout(payout_id: uuid.UUID, body: StepUpIn, admin: User = Depends(require_admin_2fa), db: Session = Depends(get_db)):
    """Admin releases a held (exception) payout back into the normal queue. Can change status, never the amount."""
    step_up(admin, body.totp_code, db)
    p = db.execute(select(Payout).where(Payout.id == payout_id).with_for_update()).scalar_one_or_none()
    if p is None:
        raise HTTPException(404, "Payout not found")
    try:
        payouts.release_hold(db, p)
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    return MessageOut(message="Payout released")


# ---- platform finance view ---------------------------------------------------
@router.get("/finance", response_model=FinanceOut)
def finance(db: Session = Depends(get_db)):
    paid_orders = (OrderStatus.paid, OrderStatus.fulfilled)
    ok = Order.needs_refund.is_(False)
    collected = db.execute(select(func.coalesce(func.sum(Order.amount_paise), 0)).where(Order.status.in_(paid_orders), ok)).scalar_one()
    commission = db.execute(select(func.coalesce(func.sum(Order.commission_paise), 0)).where(Order.status.in_(paid_orders), ok)).scalar_one()
    paid_out = db.execute(select(func.coalesce(func.sum(Payout.amount_paise), 0)).where(Payout.status == PayoutStatus.paid)).scalar_one()
    stuck_cutoff = _now() - timedelta(hours=24)
    stuck = db.execute(select(func.count(Payout.id)).where(Payout.status == PayoutStatus.processing, Payout.created_at < stuck_cutoff)).scalar_one()
    failed = db.execute(select(func.count(Payout.id)).where(Payout.status == PayoutStatus.failed)).scalar_one()
    large_cutoff = get_settings().payout_max_paise
    large = db.execute(select(func.count(Payout.id)).where(Payout.amount_paise >= large_cutoff, Payout.status != PayoutStatus.paid)).scalar_one()
    return FinanceOut(
        commission_earned_paise=commission, collected_paise=collected, paid_out_paise=paid_out,
        outstanding_to_sellers_paise=collected - commission - paid_out,
        payouts_failed=failed, payouts_stuck=stuck, payouts_large_pending=large,
    )


# ---- weekly statements -------------------------------------------------------
@router.get("/statements", response_model=list[StatementOut])
def list_statements(seller_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    q = select(PayoutStatement).order_by(PayoutStatement.period_start.desc())
    if seller_id:
        q = q.where(PayoutStatement.seller_id == seller_id)
    return [_statement_out(s) for s in db.execute(q.limit(500)).scalars()]


@router.get("/statements/{statement_id}", response_model=StatementOut)
def get_statement(statement_id: uuid.UUID, db: Session = Depends(get_db)):
    s = db.get(PayoutStatement, statement_id)
    if s is None:
        raise HTTPException(404, "Statement not found")
    return _statement_out(s)


@router.post("/statements/{statement_id}/regenerate", response_model=StatementOut)
def regenerate_statement(statement_id: uuid.UUID, db: Session = Depends(get_db)):
    s = db.get(PayoutStatement, statement_id)
    if s is None:
        raise HTTPException(404, "Statement not found")
    return _statement_out(statements.generate_for_seller(db, s.seller_id, s.period_start, s.period_end))


def _statement_out(s: PayoutStatement) -> StatementOut:
    return StatementOut(
        id=s.id, seller_id=s.seller_id, period_start=s.period_start, period_end=s.period_end, lines=s.lines,
        gross_paise=s.gross_paise, commission_paise=s.commission_paise, net_paise=s.net_paise,
        paid_paise=s.paid_paise, pending_paise=s.pending_paise, held_paise=s.held_paise, created_at=s.created_at,
    )


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
