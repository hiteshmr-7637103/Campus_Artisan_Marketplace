import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timezone

# Configure BEFORE importing the app.
os.environ.update({
    "DATABASE_URL": os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://artisan:artisan@localhost:5432/artisan_test"),
    "ENVIRONMENT": "test",
    "PAYMENT_MODE": "mock",
    "RAZORPAY_WEBHOOK_SECRET": "whsec_test_secret",
    "JWT_SECRET": "test-secret-test-secret-test-secret-123456",
    "RATE_LIMIT_ENABLED": "false",
    "REQUIRE_EMAIL_VERIFICATION": "true",
    "BACKGROUND_TASKS_ENABLED": "false",
    "RESEND_API_KEY": "",
    "ALLOWED_EMAIL_DOMAINS": "",
    "UPLOAD_DIR": "/tmp/artisan_test_uploads",
    "PUBLIC_API_URL": "http://testserver",
})

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal, engine
from app.main import app
from app.models import (
    Category, Listing, ListingStatus, SellerPrivate, SellerPublic, SellerStatus, User, UserRole,
)
from app.ratelimit import limiter
from app.security import hash_password

PASSWORD = "correct-horse-battery"
WEBHOOK_SECRET = "whsec_test_secret"


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with engine.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    command.upgrade(Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini")), "head")
    yield


@pytest.fixture(autouse=True)
def _clean():
    with engine.begin() as c:
        c.execute(text(
            "TRUNCATE users, refresh_tokens, auth_tokens, seller_public, seller_private, listings, listing_images, "
            "orders, payments, payouts, payout_adjustments, payout_statements, reviews, webhook_events, "
            "recovery_codes RESTART IDENTITY CASCADE"
        ))
    limiter.enabled = False
    limiter.reset()
    yield


@pytest.fixture
def outbox(monkeypatch):
    sent: list[dict] = []
    monkeypatch.setattr("app.services.email.send_email", lambda to, subject, body: sent.append({"to": to, "subject": subject, "body": body}))
    return sent


@pytest.fixture
def client(outbox):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


def token_from(outbox, to: str) -> str:
    for m in reversed(outbox):
        if m["to"] == to:
            found = re.search(r"token=([\w-]+)", m["body"])
            if found:
                return found.group(1)
    raise AssertionError(f"no token email for {to}")


class World:
    def __init__(self, client, db):
        self.client, self.db = client, db

    def user(self, email=None, *, verified=True, role=UserRole.buyer, seller=False, name="Test User") -> User:
        email = email or f"u{uuid.uuid4().hex[:8]}@example.com"
        u = User(
            email=email, password_hash=hash_password(PASSWORD), full_name=name, role=role,
            email_verified_at=datetime.now(timezone.utc) if verified else None,
            seller_status=SellerStatus.approved if seller else SellerStatus.none,
        )
        if seller:
            u.role = UserRole.seller
        self.db.add(u)
        self.db.flush()
        if seller:
            self.db.add(SellerPublic(seller_id=u.id, display_name=f"Shop {name}", bio="bio"))
            self.db.add(SellerPrivate(seller_id=u.id, phone="9876500000", instagram="shop_ig", upi_id="shop@okaxis"))
        self.db.commit()
        return u

    def headers(self, user: User) -> dict:
        r = self.client.post("/api/auth/login", json={"email": user.email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        if body.get("mfa_required"):
            import pyotp
            code = pyotp.TOTP(self.db.get(User, user.id).totp_secret).now()
            r2 = self.client.post("/api/auth/admin/2fa/verify", json={"mfa_token": body["mfa_token"], "code": code})
            assert r2.status_code == 200, r2.text
            body = r2.json()
        return {"Authorization": f"Bearer {body['access_token']}"}

    def totp_code(self, user: User) -> str:
        import pyotp
        return pyotp.TOTP(self.db.get(User, user.id).totp_secret).now()

    def listing(self, seller: User, price=50000, status=ListingStatus.active, title="Clay pot") -> Listing:
        cat = self.db.query(Category).first()
        l = Listing(seller_id=seller.id, category_id=cat.id, title=title, description="d", price_paise=price, status=status)
        self.db.add(l)
        self.db.commit()
        return l

    def order(self, buyer_headers, listing_id) -> dict:
        r = self.client.post("/api/orders", json={"listing_id": str(listing_id)}, headers=buyer_headers)
        assert r.status_code == 201, r.text
        return r.json()

    def webhook(self, order_id, amount, payment_id=None, event_id=None, secret=WEBHOOK_SECRET, sign=True):
        body = json.dumps({
            "event": "payment_link.paid",
            "payload": {
                "payment_link": {"entity": {"reference_id": str(order_id), "amount_paid": amount}},
                "payment": {"entity": {"id": payment_id or f"pay_{uuid.uuid4().hex[:10]}", "amount": amount}},
            },
        }).encode()
        sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest() if sign else "bad"
        return self.client.post(
            "/api/webhooks/razorpay", content=body,
            headers={"x-razorpay-signature": sig, "x-razorpay-event-id": event_id or uuid.uuid4().hex, "content-type": "application/json"},
        )

    def admin(self, *, with_2fa=True):
        u = self.user(role=UserRole.admin, name="Admin")
        if with_2fa:
            import pyotp
            u.totp_secret = pyotp.random_base32()
            u.totp_enabled = True
            u.totp_confirmed_at = datetime.now(timezone.utc)
            self.db.commit()
        return u, self.headers(u)


@pytest.fixture
def world(client, db):
    return World(client, db)
