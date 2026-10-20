"""Weekly per-seller statements: a summary on top of per-order payouts, snapshotted at
generation time so a later change (reversal, cap hit) does not rewrite statement history."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import Listing, Order, Payout, PayoutStatement, PayoutStatus


def week_bounds(ref: datetime) -> tuple[datetime, datetime]:
    """The Mon-Sun week before `ref`'s week."""
    ref = ref.astimezone(timezone.utc)
    this_monday = (ref - timedelta(days=ref.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    start = this_monday - timedelta(weeks=1)
    return start, this_monday


def generate_for_week(db: Session, period_start: datetime, period_end: datetime) -> int:
    seller_ids = db.execute(
        select(Payout.seller_id).where(Payout.created_at >= period_start, Payout.created_at < period_end).distinct()
    ).scalars().all()
    for seller_id in seller_ids:
        generate_for_seller(db, seller_id, period_start, period_end)
    return len(seller_ids)


def generate_for_seller(db: Session, seller_id: uuid.UUID, period_start: datetime, period_end: datetime) -> PayoutStatement:
    rows = db.execute(
        select(Payout, Order, Listing.title)
        .join(Order, Order.id == Payout.order_id)
        .join(Listing, Listing.id == Order.listing_id)
        .where(Payout.seller_id == seller_id, Payout.created_at >= period_start, Payout.created_at < period_end)
        .order_by(Payout.created_at)
    ).all()
    lines = [
        {
            "order_id": str(p.order_id), "product": title, "sale_amount_paise": p.gross_paise,
            "commission_paise": p.commission_paise, "net_payout_paise": p.amount_paise,
            "payout_status": p.status.value, "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "utr": p.upi_txn_ref,
        }
        for p, order, title in rows
    ]
    payouts = [p for p, _, _ in rows]
    statement = PayoutStatement(
        seller_id=seller_id, period_start=period_start, period_end=period_end, lines=lines,
        gross_paise=sum(p.gross_paise for p in payouts),
        commission_paise=sum(p.commission_paise for p in payouts),
        net_paise=sum(p.amount_paise for p in payouts),
        paid_paise=sum(p.amount_paise for p in payouts if p.status == PayoutStatus.paid),
        pending_paise=sum(p.amount_paise for p in payouts if p.status in (PayoutStatus.pending, PayoutStatus.eligible, PayoutStatus.processing)),
        held_paise=sum(p.amount_paise for p in payouts if p.status == PayoutStatus.on_hold),
    )
    stmt = insert(PayoutStatement).values(
        seller_id=statement.seller_id, period_start=statement.period_start, period_end=statement.period_end,
        lines=statement.lines, gross_paise=statement.gross_paise, commission_paise=statement.commission_paise,
        net_paise=statement.net_paise, paid_paise=statement.paid_paise, pending_paise=statement.pending_paise,
        held_paise=statement.held_paise,
    ).on_conflict_do_update(
        index_elements=["seller_id", "period_start"],
        set_={
            "lines": statement.lines, "gross_paise": statement.gross_paise, "commission_paise": statement.commission_paise,
            "net_paise": statement.net_paise, "paid_paise": statement.paid_paise, "pending_paise": statement.pending_paise,
            "held_paise": statement.held_paise,
        },
    ).returning(PayoutStatement.id)
    stmt_id = db.execute(stmt).scalar_one()
    db.commit()
    return db.get(PayoutStatement, stmt_id)
