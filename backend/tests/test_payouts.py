from datetime import timedelta

import pytest

from app.models import Order, OrderStatus, Payout, PayoutStatus
from app.services import payouts


def _fulfilled_order(world, db, *, seller=None, price=50000):
    seller = seller or world.user(seller=True)
    buyer = world.user()
    l = world.listing(seller, price=price)
    o = world.order(world.headers(buyer), l.id)
    world.webhook(o["id"], price)
    order = db.get(Order, o["id"])
    order.status, order.fulfilled_at = OrderStatus.fulfilled, order.paid_at
    db.commit()
    return order, seller


def _paid_payout(world, db, seller=None):
    """A seller with one prior successful payout, so later ones aren't flagged as 'newly approved'."""
    order, seller = _fulfilled_order(world, db, seller=seller)
    payout = payouts.create_for_order(db, order)
    payout.status, payout.paid_at = PayoutStatus.paid, order.fulfilled_at
    db.commit()
    return seller


def test_one_payout_per_order(world, db):
    order, _ = _fulfilled_order(world, db)
    first = payouts.create_for_order(db, order)
    second = payouts.create_for_order(db, order)
    assert first.id == second.id
    assert db.query(Payout).filter_by(order_id=order.id).count() == 1


def test_refund_flagged_order_never_becomes_eligible(world, db):
    order, _ = _fulfilled_order(world, db)
    payouts.create_for_order(db, order)
    order.needs_refund = True
    db.commit()
    db.query(Order).filter_by(id=order.id).update({"fulfilled_at": order.fulfilled_at - timedelta(hours=48)})
    db.commit()
    payouts.promote_eligible(db)
    db.expire_all()
    p = db.query(Payout).filter_by(order_id=order.id).one()
    assert p.status == PayoutStatus.on_hold


def test_hold_window_timing(world, db):
    order, _ = _fulfilled_order(world, db)
    p = payouts.create_for_order(db, order)
    assert payouts.promote_eligible(db) == 0  # too soon
    db.expire_all()
    assert db.get(Payout, p.id).status == PayoutStatus.pending
    db.query(Order).filter_by(id=order.id).update({"fulfilled_at": order.fulfilled_at - timedelta(hours=48)})
    db.commit()
    assert payouts.promote_eligible(db) == 1
    db.expire_all()
    assert db.get(Payout, p.id).status in (PayoutStatus.eligible, PayoutStatus.on_hold)


def test_commission_arithmetic_has_no_drift(world, db):
    seller = world.user(seller=True)
    order, _ = _fulfilled_order(world, db, seller=seller, price=33333)
    p = payouts.create_for_order(db, order)
    assert p.commission_paise + p.amount_paise == p.gross_paise == order.amount_paise


def test_tampered_amount_is_never_sent(world, db):
    seller = _paid_payout(world, db)
    order, _ = _fulfilled_order(world, db, seller=seller)
    p = payouts.create_for_order(db, order)
    # Even the database itself refuses an inconsistent payout row (gross = commission + net).
    with pytest.raises(Exception):
        p.amount_paise += 1
        db.commit()
    db.rollback()
    # A payout for an order that is no longer in a payable state is also refused before sending.
    db.refresh(order)
    order.status = OrderStatus.paid  # e.g. fulfilment was reverted after the payout row was created
    db.commit()
    assert not payouts.check_before_send(db, p).ok


def test_duplicate_event_does_not_double_pay(world, db):
    seller = _paid_payout(world, db)
    order, _ = _fulfilled_order(world, db, seller=seller)
    p = payouts.create_for_order(db, order)
    p.status, p.eligible_at = PayoutStatus.eligible, order.fulfilled_at
    db.commit()
    payouts.mark_paid_manual(db, p, "UTR1")
    with pytest.raises(ValueError):
        payouts.mark_paid_manual(db, p, "UTR2")


def test_per_payout_cap_blocks_send(world, db, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "payout_max_paise", 1000)
    seller = _paid_payout(world, db)
    order, _ = _fulfilled_order(world, db, seller=seller, price=50000)
    p = payouts.create_for_order(db, order)
    p.status, p.eligible_at = PayoutStatus.eligible, order.fulfilled_at
    db.commit()
    with pytest.raises(ValueError):
        payouts.mark_paid_manual(db, p, "UTR1")
    db.expire_all()
    assert db.get(Payout, p.id).status == PayoutStatus.on_hold


def test_platform_circuit_breaker(world, db, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "payout_platform_daily_cap_paise", 1000)
    seller = _paid_payout(world, db)
    order, _ = _fulfilled_order(world, db, seller=seller, price=50000)
    p = payouts.create_for_order(db, order)
    p.status, p.eligible_at = PayoutStatus.eligible, order.fulfilled_at
    db.commit()
    with pytest.raises(ValueError):
        payouts.mark_paid_manual(db, p, "UTR1")


def test_upi_change_holds_payouts(world, db):
    from datetime import datetime, timezone

    from app.models import SellerPrivate
    seller = _paid_payout(world, db)
    priv = db.get(SellerPrivate, seller.id)
    priv.upi_updated_at = datetime.now(timezone.utc)
    db.commit()
    order, _ = _fulfilled_order(world, db, seller=seller)
    p = payouts.create_for_order(db, order)
    db.query(Order).filter_by(id=order.id).update({"fulfilled_at": order.fulfilled_at - timedelta(hours=48)})
    db.commit()
    payouts.promote_eligible(db)
    db.expire_all()
    assert db.get(Payout, p.id).status == PayoutStatus.on_hold


def test_admin_action_without_release_is_refused(world, db, client):
    order, seller = _fulfilled_order(world, db)
    payouts.create_for_order(db, order)
    admin, ah = world.admin()
    pay = client.get("/api/admin/payouts", headers=ah).json()
    body = {"upi_txn_ref": "UTR1", "totp_code": world.totp_code(admin)}
    assert client.post(f"/api/admin/payouts/{pay[0]['id']}/mark-paid", json=body, headers=ah).status_code == 409


def test_reversal_nets_as_adjustment_not_an_edit(world, db):
    from app.models import PayoutAdjustment
    seller = _paid_payout(world, db)
    order = db.query(Order).filter_by(seller_id=seller.id).order_by(Order.created_at.desc()).first()
    p = db.query(Payout).filter_by(order_id=order.id).one()
    order.status, order.needs_refund = OrderStatus.refunded, True
    db.commit()
    payouts.hold_for_refund(db, order.id)
    db.expire_all()
    p = db.get(Payout, p.id)
    assert p.status == PayoutStatus.reversed and p.amount_paise > 0  # the paid row itself is untouched
    adj = db.query(PayoutAdjustment).filter_by(payout_id=p.id).one()
    assert adj.amount_paise == -p.amount_paise
