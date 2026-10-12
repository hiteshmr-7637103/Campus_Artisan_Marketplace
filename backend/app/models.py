import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class UserRole(str, enum.Enum):
    buyer = "buyer"
    seller = "seller"
    admin = "admin"


class SellerStatus(str, enum.Enum):
    none = "none"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TokenPurpose(str, enum.Enum):
    verify_email = "verify_email"
    reset_password = "reset_password"


class ListingStatus(str, enum.Enum):
    pending_review = "pending_review"
    active = "active"
    sold = "sold"
    rejected = "rejected"
    archived = "archived"


class OrderStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    paid = "paid"
    fulfilled = "fulfilled"
    cancelled = "cancelled"
    refunded = "refunded"


class PayoutStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


def pg_enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, values_callable=lambda x: [m.value for m in x])


def pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))


def created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.buyer, server_default="buyer", nullable=False)
    seller_status: Mapped[SellerStatus] = mapped_column(pg_enum(SellerStatus, "seller_status"), default=SellerStatus.none, server_default="none", nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose: Mapped[TokenPurpose] = mapped_column(pg_enum(TokenPurpose, "auth_token_purpose"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SellerPublic(Base):
    __tablename__ = "seller_public"
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = created()
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    bio: Mapped[str] = mapped_column(String(600), default="", server_default="", nullable=False)


class SellerPrivate(Base):
    __tablename__ = "seller_private"
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = created()
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    instagram: Mapped[str | None] = mapped_column(String(60))
    upi_id: Mapped[str] = mapped_column(String(80), nullable=False)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint("price_paise > 0", name="listings_price_positive"),
        Index("ix_listings_status_created", "status", "created_at"),
    )
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    price_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[ListingStatus] = mapped_column(pg_enum(ListingStatus, "listing_status"), default=ListingStatus.pending_review, server_default="pending_review", nullable=False)
    reject_reason: Mapped[str | None] = mapped_column(String(300))


class ListingImage(Base):
    __tablename__ = "listing_images"
    __table_args__ = (
        UniqueConstraint("listing_id", "position", name="uq_listing_images_position"),
        CheckConstraint("position between 0 and 2", name="listing_images_position_range"),
    )
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_path: Mapped[str] = mapped_column(String(300), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("buyer_id <> seller_id", name="orders_buyer_not_seller"),
        CheckConstraint("commission_paise + seller_amount_paise = amount_paise", name="orders_amounts_add_up"),
        CheckConstraint("amount_paise > 0", name="orders_amount_positive"),
    )
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    buyer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"), nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    commission_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    seller_amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(pg_enum(OrderStatus, "order_status"), default=OrderStatus.pending_payment, server_default="pending_payment", nullable=False)
    needs_refund: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    razorpay_payment_link_id: Mapped[str | None] = mapped_column(String(80))
    payment_url: Mapped[str | None] = mapped_column(String(500))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    razorpay_payment_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    raw_event: Mapped[dict | None] = mapped_column(JSONB)


class Payout(Base):
    __tablename__ = "payouts"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), unique=True, nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[PayoutStatus] = mapped_column(pg_enum(PayoutStatus, "payout_status"), default=PayoutStatus.pending, server_default="pending", nullable=False)
    upi_txn_ref: Mapped[str | None] = mapped_column(String(80))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (CheckConstraint("rating between 1 and 5", name="reviews_rating_range"),)
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), unique=True, nullable=False)
    buyer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(String(1000), default="", server_default="", nullable=False)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[uuid.UUID] = pk()
    created_at: Mapped[datetime] = created()
    event_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    type: Mapped[str] = mapped_column(String(80), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AppConfig(Base):
    __tablename__ = "app_config"
    __table_args__ = (CheckConstraint("id", name="app_config_singleton"),)
    id: Mapped[bool] = mapped_column(Boolean, primary_key=True, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = created()
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0.10)
