"""Payout lifecycle: creation, automatic promotion, exception rules and the exact-match
invariant. No code path here (or anywhere else) accepts an amount from a request; every
payout's amount is computed once, from the order, when the row is created."""
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Order, OrderStatus, Payout, PayoutAdjustment, PayoutStatus, SellerPrivate, SellerStatus, User

log = logging.getLogger("app.payouts")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_for_order(db: Session, order: Order) -> Payout | None:
    """Called when an order is fulfilled. Idempotent: one payout per order (unique constraint)."""
    if order.status != OrderStatus.fulfilled or order.needs_refund:
        return None
    payout = Payout(
        order_id=order.id, seller_id=order.seller_id,
        gross_paise=order.amount_paise, commission_paise=order.commission_paise, amount_paise=order.seller_amount_paise,
        provider=get_settings().payout_provider,
    )
    db.add(payout)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.execute(select(Payout).where(Payout.order_id == order.id)).scalar_one_or_none()
    return payout


def _exception_reason(db: Session, payout: Payout) -> str | None:
    s = get_settings()
    if payout.amount_paise > s.payout_max_paise:
        return f"amount {payout.amount_paise} exceeds per-payout cap {s.payout_max_paise}"
    priv = db.get(SellerPrivate, payout.seller_id)
    if priv and priv.upi_updated_at and _now() - priv.upi_updated_at < timedelta(days=s.payout_upi_change_cooldown_days):
        return "seller's UPI id changed recently"
    seller = db.get(User, payout.seller_id)
    if seller and seller.seller_status == SellerStatus.approved:
        # approximate "newly approved" using the seller's own creation date is not available here;
        # use the absence of any prior paid payout as the newly-approved signal instead.
        prior_paid = db.execute(
            select(func.count(Payout.id)).where(
                Payout.seller_id == payout.seller_id, Payout.status == PayoutStatus.paid, Payout.id != payout.id,
            )
        ).scalar_one()
        if prior_paid == 0:
            return "seller has no prior successful payout (newly approved)"
    if payout.attempt_count >= s.payout_max_attempts:
        return f"{payout.attempt_count} prior failed attempts"
    return None


def promote_eligible(db: Session) -> int:
    """The automatic hold-window job: pending -> eligible (or on_hold if an exception rule fires)."""
    s = get_settings()
    cutoff = _now() - timedelta(hours=s.payout_hold_hours)
    rows = db.execute(
        select(Payout)
        .join(Order, Order.id == Payout.order_id)
        .where(Payout.status == PayoutStatus.pending, Order.fulfilled_at.is_not(None), Order.fulfilled_at < cutoff)
        .with_for_update(of=Payout, skip_locked=True)
    ).scalars().all()
    n = 0
    for p in rows:
        order = db.get(Order, p.order_id)
        if order.needs_refund or order.status != OrderStatus.fulfilled:
            p.status = PayoutStatus.on_hold
            p.exception_reason = "order flagged for refund or not fulfilled"
            p.is_exception = True
            continue
        reason = _exception_reason(db, p)
        if reason:
            p.status, p.is_exception, p.exception_reason = PayoutStatus.on_hold, True, reason
        else:
            p.status, p.eligible_at = PayoutStatus.eligible, _now()
        n += 1
    db.commit()
    return n


@dataclass
class PayoutCheck:
    ok: bool
    reason: str | None = None


def _today_paid_total(db: Session, seller_id: uuid.UUID | None = None) -> int:
    start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    q = select(func.coalesce(func.sum(Payout.amount_paise), 0)).where(Payout.status == PayoutStatus.paid, Payout.paid_at >= start)
    if seller_id:
        q = q.where(Payout.seller_id == seller_id)
    return db.execute(q).scalar_one()


def check_before_send(db: Session, payout: Payout) -> PayoutCheck:
    """Exact-match invariant plus hard caps, re-checked immediately before a payout is sent.
    A mismatch here means the payout is never sent — it is pushed to the exception queue instead."""
    s = get_settings()
    order = db.get(Order, payout.order_id)
    if order is None or order.status != OrderStatus.fulfilled or order.needs_refund:
        return PayoutCheck(False, "order is not in a payable state")
    if payout.amount_paise != order.seller_amount_paise or payout.commission_paise + payout.amount_paise != payout.gross_paise:
        return PayoutCheck(False, "payout amount does not match the order's computed net")
    seller = db.get(User, payout.seller_id)
    if seller is None or seller.seller_status != SellerStatus.approved:
        return PayoutCheck(False, "seller is not approved")
    already_paid = db.execute(
        select(func.coalesce(func.sum(Payout.amount_paise), 0)).where(Payout.order_id == order.id, Payout.status == PayoutStatus.paid)
    ).scalar_one()
    if already_paid + payout.amount_paise > order.amount_paise:
        return PayoutCheck(False, "total paid for this order would exceed what was collected")
    if payout.amount_paise > s.payout_max_paise:
        return PayoutCheck(False, "per-payout cap exceeded")
    if _today_paid_total(db, payout.seller_id) + payout.amount_paise > s.payout_seller_daily_cap_paise:
        return PayoutCheck(False, "seller daily payout cap exceeded")
    if _today_paid_total(db) + payout.amount_paise > s.payout_platform_daily_cap_paise:
        return PayoutCheck(False, "platform daily payout cap exceeded (circuit breaker)")
    return PayoutCheck(True)


def mark_paid_manual(db: Session, payout: Payout, utr: str) -> Payout:
    """The only place a payout is marked paid. `utr` is a real bank/UPI reference, never fabricated."""
    if payout.status not in (PayoutStatus.eligible, PayoutStatus.processing):
        raise ValueError("Only an eligible or processing payout can be marked paid")
    check = check_before_send(db, payout)
    if not check.ok:
        payout.status, payout.is_exception, payout.exception_reason = PayoutStatus.on_hold, True, check.reason
        db.commit()
        raise ValueError(check.reason)
    payout.status, payout.upi_txn_ref, payout.paid_at = PayoutStatus.paid, utr, _now()
    db.commit()
    return payout


def release_hold(db: Session, payout: Payout) -> Payout:
    """Admin releases an exception back into the normal queue. Can change status, never the amount."""
    if payout.status != PayoutStatus.on_hold:
        raise ValueError("Only a held payout can be released")
    order = db.get(Order, payout.order_id)
    if order.needs_refund or order.status != OrderStatus.fulfilled:
        raise ValueError("The underlying order is still flagged for refund or not fulfilled")
    payout.status, payout.eligible_at, payout.is_exception = PayoutStatus.eligible, _now(), False
    db.commit()
    return payout


def hold_for_refund(db: Session, order_id: uuid.UUID) -> Payout | None:
    """Called when an order is marked refunded. Never deletes a row — a paid payout is netted via
    a PayoutAdjustment instead, so the ledger stays append-only."""
    payout = db.execute(select(Payout).where(Payout.order_id == order_id).with_for_update()).scalar_one_or_none()
    if payout is None:
        return None
    if payout.status in (PayoutStatus.pending, PayoutStatus.eligible, PayoutStatus.on_hold):
        payout.status, payout.is_exception, payout.exception_reason = PayoutStatus.on_hold, True, "order refunded"
    elif payout.status == PayoutStatus.processing:
        raise ValueError("Payout is in flight; wait for it to settle before refunding")
    elif payout.status == PayoutStatus.paid:
        db.add(PayoutAdjustment(
            seller_id=payout.seller_id, payout_id=payout.id, order_id=order_id,
            amount_paise=-payout.amount_paise, reason="refund issued after payout",
        ))
        payout.status = PayoutStatus.reversed
    db.commit()
    return payout
