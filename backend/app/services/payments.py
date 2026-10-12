"""The ONLY code path that can mark an order paid."""
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Listing, ListingStatus, Order, OrderStatus, Payment, Payout, User
from . import razorpay

log = logging.getLogger("app.payments")


@dataclass
class PaidOutcome:
    changed: bool  # False when the order was not pending (idempotent no-op)
    order_id: uuid.UUID
    needs_refund: bool = False
    title: str = ""
    buyer_email: str = ""
    seller_email: str = ""


def mark_order_paid(
    db: Session,
    order_id: uuid.UUID,
    payment_id: str,
    amount_paise: int,
    raw_event: dict | None = None,
) -> PaidOutcome:
    """Runs in one transaction; commits at the end."""
    order = db.execute(select(Order).where(Order.id == order_id).with_for_update()).scalar_one_or_none()
    if order is None:
        db.rollback()
        return PaidOutcome(False, order_id)
    # Normally only pending orders. A cancelled (expired) order that still received money
    # is recorded as paid + needs_refund so the money is not silently lost.
    if order.status not in (OrderStatus.pending_payment, OrderStatus.cancelled):
        db.rollback()
        return PaidOutcome(False, order_id)
    late = order.status == OrderStatus.cancelled

    sold = db.execute(
        update(Listing).where(Listing.id == order.listing_id, Listing.status == ListingStatus.active).values(status=ListingStatus.sold)
    ).rowcount
    ok = sold == 1 and amount_paise == order.amount_paise and not late

    order.status = OrderStatus.paid
    order.paid_at = datetime.now(timezone.utc)
    order.needs_refund = not ok
    db.add(Payment(order_id=order.id, razorpay_payment_id=payment_id, amount_paise=amount_paise, status="captured", raw_event=raw_event))
    if ok:
        db.add(Payout(order_id=order.id, seller_id=order.seller_id, amount_paise=order.seller_amount_paise))
    else:
        log.warning("order %s paid but needs refund (sold=%s amount_ok=%s late=%s)", order.id, sold, amount_paise == order.amount_paise, late)

    title = db.get(Listing, order.listing_id).title
    buyer = db.get(User, order.buyer_id)
    seller = db.get(User, order.seller_id)
    out = PaidOutcome(True, order.id, order.needs_refund, title, buyer.email, seller.email)
    db.commit()
    return out


def send_paid_emails(outcome: PaidOutcome) -> None:
    from . import email

    if not outcome.changed:
        return
    email.send_order_paid_buyer(outcome.buyer_email, outcome.title, str(outcome.order_id), outcome.needs_refund)
    if not outcome.needs_refund:
        email.send_order_paid_seller(outcome.seller_email, outcome.title)


def expire_stale_orders(db: Session) -> int:
    """Cancel pending orders older than the expiry window and cancel their payment links."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=get_settings().order_expiry_minutes)
    stale = db.execute(
        select(Order).where(Order.status == OrderStatus.pending_payment, Order.created_at < cutoff).with_for_update(skip_locked=True)
    ).scalars().all()
    for o in stale:
        o.status = OrderStatus.cancelled
    link_ids = [o.razorpay_payment_link_id for o in stale]
    db.commit()
    for lid in link_ids:
        razorpay.cancel_payment_link(lid)
    return len(stale)
