"""Contact masking. This module holds the ONLY queries that read seller_private / buyer contact."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Order, OrderStatus, SellerPrivate, SellerPublic, User, UserRole

_REVEALED = (OrderStatus.paid, OrderStatus.fulfilled)


def read_seller_private(db: Session, viewer: User, seller_id: uuid.UUID) -> SellerPrivate | None:
    """Owner, admin, or a buyer with a paid/fulfilled (not refund-flagged) order with this seller."""
    if viewer.id == seller_id or viewer.role == UserRole.admin:
        return db.get(SellerPrivate, seller_id)
    q = (
        select(SellerPrivate)
        .join(Order, Order.seller_id == SellerPrivate.seller_id)
        .where(
            SellerPrivate.seller_id == seller_id,
            Order.buyer_id == viewer.id,
            Order.status.in_(_REVEALED),
            Order.needs_refund.is_(False),
        )
        .limit(1)
    )
    return db.execute(q).scalar_one_or_none()


def seller_contact_for_order(db: Session, viewer: User, order: Order):
    """Seller contact for an order the viewer owns as buyer; None until paid."""
    from ..schemas import SellerContactOut

    priv = read_seller_private(db, viewer, order.seller_id)
    if priv is None or order.status not in _REVEALED or order.needs_refund:
        return None
    pub = db.get(SellerPublic, order.seller_id)
    return SellerContactOut(display_name=pub.display_name, phone=priv.phone, instagram=priv.instagram)


def buyer_contact_visible(order: Order) -> bool:
    return order.status in _REVEALED and not order.needs_refund
