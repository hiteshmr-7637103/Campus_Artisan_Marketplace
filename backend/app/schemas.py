"""Pydantic request/response models.

Requests forbid extra fields so nothing (role, amount, status...) can be smuggled in.
Responses list their fields explicitly so a private column cannot leak by accident.
"""
import re
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from .models import ListingStatus, OrderStatus, PayoutStatus, SellerStatus, UserRole

PHONE_RE = re.compile(r"^[0-9+\-() ]{6,20}$")
UPI_RE = re.compile(r"^[A-Za-z0-9.\-_]{2,64}@[A-Za-z0-9]{2,40}$")

Text = Annotated[str, StringConstraints(strip_whitespace=True)]


class In(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _phone(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not PHONE_RE.match(v):
        raise ValueError("invalid phone number")
    return v


# ---- auth / me -------------------------------------------------------------
class SignupIn(In):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Text = Field(min_length=1, max_length=120)
    phone: Text | None = Field(default=None, max_length=20)

    _p = field_validator("phone")(_phone)


class LoginIn(In):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenIn(In):
    token: str = Field(min_length=10, max_length=200)


class ForgotIn(In):
    email: EmailStr


class ResetIn(In):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class MeUpdate(In):
    full_name: Text | None = Field(default=None, min_length=1, max_length=120)
    phone: Text | None = Field(default=None, max_length=20)

    _p = field_validator("phone")(_phone)


class UserOut(Out):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: UserRole
    seller_status: SellerStatus
    email_verified: bool


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str


# ---- catalog ---------------------------------------------------------------
class CategoryOut(Out):
    id: uuid.UUID
    name: str
    slug: str


class SellerBrief(BaseModel):
    id: uuid.UUID
    display_name: str
    avg_rating: float | None
    review_count: int


class ListingOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    price_paise: int
    category: str
    category_slug: str
    images: list[str]
    seller: SellerBrief
    created_at: datetime


class ListingPage(BaseModel):
    items: list[ListingOut]
    page: int
    page_size: int
    total: int


class ReviewOut(BaseModel):
    id: uuid.UUID
    rating: int
    comment: str
    buyer_name: str
    listing_title: str
    created_at: datetime


class SellerProfileOut(BaseModel):
    id: uuid.UUID
    display_name: str
    bio: str
    avg_rating: float | None
    review_count: int
    reviews: list[ReviewOut]
    listings: list[ListingOut]


# ---- seller ----------------------------------------------------------------
class SellerApplyIn(In):
    display_name: Text = Field(min_length=2, max_length=80)
    bio: Text = Field(default="", max_length=600)
    phone: Text = Field(min_length=6, max_length=20)
    instagram: Text | None = Field(default=None, max_length=60)
    upi_id: Text = Field(min_length=3, max_length=80)

    _p = field_validator("phone")(_phone)

    @field_validator("upi_id")
    @classmethod
    def _upi(cls, v: str) -> str:
        if not UPI_RE.match(v):
            raise ValueError("invalid UPI ID")
        return v


class SellerMeOut(BaseModel):
    seller_status: SellerStatus
    display_name: str | None = None
    bio: str | None = None
    phone: str | None = None
    instagram: str | None = None
    upi_id: str | None = None


class ListingCreateIn(In):
    title: Text = Field(min_length=3, max_length=120)
    category_id: uuid.UUID
    description: Text = Field(min_length=1, max_length=2000)
    price_paise: int = Field(gt=0, le=100_000_00)  # up to Rs 1,00,000


class ListingUpdateIn(In):
    title: Text | None = Field(default=None, min_length=3, max_length=120)
    category_id: uuid.UUID | None = None
    description: Text | None = Field(default=None, min_length=1, max_length=2000)
    price_paise: int | None = Field(default=None, gt=0, le=100_000_00)


class ImageOut(BaseModel):
    id: uuid.UUID
    url: str
    position: int


class SellerListingOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    price_paise: int
    category_id: uuid.UUID
    category: str
    status: ListingStatus
    reject_reason: str | None
    images: list[ImageOut]
    created_at: datetime


# ---- orders ----------------------------------------------------------------
class OrderCreateIn(In):
    listing_id: uuid.UUID


class SellerContactOut(BaseModel):
    display_name: str
    phone: str
    instagram: str | None


class OrderOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str
    listing_image: str | None
    seller_id: uuid.UUID
    seller_name: str
    amount_paise: int
    status: OrderStatus
    needs_refund: bool
    payment_url: str | None
    seller_contact: SellerContactOut | None
    reviewed: bool
    created_at: datetime
    paid_at: datetime | None
    fulfilled_at: datetime | None


class ReviewIn(In):
    rating: int = Field(ge=1, le=5)
    comment: Text = Field(default="", max_length=1000)


class SellerOrderOut(BaseModel):
    id: uuid.UUID
    listing_title: str
    amount_paise: int
    seller_amount_paise: int
    status: OrderStatus
    needs_refund: bool
    buyer_name: str | None
    buyer_phone: str | None
    created_at: datetime
    paid_at: datetime | None
    fulfilled_at: datetime | None


class SellerPayoutOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    amount_paise: int
    status: PayoutStatus
    upi_txn_ref: str | None
    paid_at: datetime | None
    created_at: datetime


# ---- admin -----------------------------------------------------------------
class DecisionIn(In):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: Text | None = Field(default=None, max_length=300)


class ListingDecisionIn(In):
    decision: str = Field(pattern="^(approve|reject|archive)$")
    reason: Text | None = Field(default=None, max_length=300)


class MarkPaidIn(In):
    upi_txn_ref: Text = Field(min_length=3, max_length=80)


class AdminSellerOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    seller_status: SellerStatus
    display_name: str | None
    bio: str | None
    phone: str | None
    instagram: str | None
    upi_id: str | None
    created_at: datetime


class AdminListingOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    price_paise: int
    category: str
    status: ListingStatus
    reject_reason: str | None
    seller_id: uuid.UUID
    seller_name: str
    images: list[str]
    created_at: datetime


class AdminOrderOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str
    buyer_name: str
    buyer_email: str
    seller_id: uuid.UUID
    seller_name: str
    amount_paise: int
    commission_paise: int
    seller_amount_paise: int
    status: OrderStatus
    needs_refund: bool
    created_at: datetime
    paid_at: datetime | None
    fulfilled_at: datetime | None


class AdminPayoutOut(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    seller_id: uuid.UUID
    seller_name: str
    upi_id: str | None
    amount_paise: int
    status: PayoutStatus
    upi_txn_ref: str | None
    paid_at: datetime | None
    created_at: datetime


class MetricsOut(BaseModel):
    signups: int
    verified_signups: int
    active_sellers: int
    listings_active: int
    listings_total: int
    checkouts_started: int
    paid_orders: int
    gmv_paise: int
    commission_paise: int
