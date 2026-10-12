import time

import pytest

from app.models import RefreshToken, User, UserRole
from app.ratelimit import limiter

from .conftest import PASSWORD, token_from


def signup(client, email="new@example.com", password=PASSWORD):
    return client.post("/api/auth/signup", json={"email": email, "password": password, "full_name": "New User"})


def test_signup_verify_login_flow(client, outbox, db):
    assert signup(client).status_code == 202
    token = token_from(outbox, "new@example.com")
    r = client.post("/api/auth/login", json={"email": "new@example.com", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["user"]["email_verified"] is False
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    # single use
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 400
    r = client.post("/api/auth/login", json={"email": "new@example.com", "password": PASSWORD})
    assert r.json()["user"]["email_verified"] is True
    assert "password" not in r.text


def test_5_no_self_promotion(client, world):
    u = world.user()
    h = world.headers(u)
    for body in ({"role": "admin"}, {"seller_status": "approved"}, {"email": "x@y.com"}, {"email_verified_at": "2020-01-01T00:00:00Z"}):
        assert client.patch("/api/me", json=body, headers=h).status_code == 422
    assert client.patch("/api/me", json={"full_name": "Renamed", "phone": "98765 43210"}, headers=h).status_code == 200
    assert client.get("/api/me", headers=h).json()["role"] == "buyer"


def test_13_unverified_blocked(client, world):
    seller = world.user(seller=True)
    listing = world.listing(seller)
    u = world.user(verified=False)
    h = world.headers(u)
    assert client.post("/api/orders", json={"listing_id": str(listing.id)}, headers=h).status_code == 403
    apply = {"display_name": "Shop", "bio": "", "phone": "9876543210", "upi_id": "me@okaxis"}
    assert client.post("/api/seller/apply", json=apply, headers=h).status_code == 403
    assert client.post("/api/orders/00000000-0000-0000-0000-000000000000/review", json={"rating": 5}, headers=h).status_code == 403


def test_16_no_account_enumeration(client, world, outbox):
    world.user("exists@example.com")
    a = signup(client, "exists@example.com")
    b = signup(client, "brandnew@example.com")
    assert (a.status_code, a.json()) == (b.status_code, b.json())
    a = client.post("/api/auth/forgot-password", json={"email": "exists@example.com"})
    b = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert (a.status_code, a.json()) == (b.status_code, b.json())
    a = client.post("/api/auth/login", json={"email": "exists@example.com", "password": "wrong-password"})
    b = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "wrong-password"})
    assert (a.status_code, a.json()) == (b.status_code, b.json()) == (401, {"error": "Invalid email or password"})


def test_15_auth_abuse_throttled(client):
    limiter.enabled = True
    limiter.reset()
    codes = [client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-password"}).status_code for _ in range(22)]
    assert codes[:20] == [401] * 20 and 429 in codes[20:]
    limiter.reset()
    codes = [client.post("/api/auth/forgot-password", json={"email": "a@example.com"}).status_code for _ in range(22)]
    assert 429 in codes


def test_21_email_domain_rule(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "allowed_email_domains", "college.edu")
    assert signup(client, "x@gmail.com").status_code == 400
    assert signup(client, "x@college.edu").status_code == 202


def test_23_token_handling(client, world, outbox, db):
    u = world.user("tok@example.com")
    r = client.post("/api/auth/login", json={"email": u.email, "password": PASSWORD})
    old_cookie = client.cookies.get("refresh_token")
    assert old_cookie
    # rotation
    r2 = client.post("/api/auth/refresh")
    assert r2.status_code == 200 and client.cookies.get("refresh_token") != old_cookie
    # reuse of the old one is rejected
    client.cookies.clear()
    client.cookies.set("refresh_token", old_cookie, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401
    # stored hashed
    assert db.query(RefreshToken).filter(RefreshToken.token_hash == old_cookie).count() == 0

    # reset revokes sessions; reset token single use
    client.cookies.clear()
    client.post("/api/auth/login", json={"email": u.email, "password": PASSWORD})
    live = client.cookies.get("refresh_token")
    client.post("/api/auth/forgot-password", json={"email": u.email})
    token = token_from(outbox, u.email)
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "brand-new-password"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "another-password-1"}).status_code == 400
    client.cookies.clear()
    client.cookies.set("refresh_token", live, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401
    assert client.post("/api/auth/login", json={"email": u.email, "password": "brand-new-password"}).status_code == 200


def test_expired_reset_token_rejected(client, world, outbox, db):
    from datetime import datetime, timedelta, timezone

    from app.models import AuthToken

    u = world.user("exp@example.com")
    client.post("/api/auth/forgot-password", json={"email": u.email})
    token = token_from(outbox, u.email)
    db.query(AuthToken).update({"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "brand-new-password"}).status_code == 400


def test_logout_revokes_and_demoted_admin_loses_access(client, world, db):
    admin, h = world.admin()
    assert client.get("/api/admin/metrics", headers=h).status_code == 200
    db.query(User).filter(User.id == admin.id).update({"role": UserRole.buyer})
    db.commit()
    assert client.get("/api/admin/metrics", headers=h).status_code == 403  # role loaded from DB each request

    client.post("/api/auth/login", json={"email": admin.email, "password": PASSWORD})
    assert client.post("/api/auth/logout").status_code == 200
    assert client.post("/api/auth/refresh").status_code == 401


def test_password_validation(client):
    assert signup(client, password="short").status_code == 422
    assert signup(client, password="x" * 129).status_code == 422
