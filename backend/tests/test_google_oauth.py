import pytest
from fastapi import HTTPException

from app.models import User
from app.services import oauth_google


def test_new_google_user_is_created_and_verified(db):
    u = oauth_google.resolve_user(db, sub="g-1", email="new@example.com", email_verified=True, full_name="New Person")
    assert u.google_sub == "g-1" and u.email_verified_at is not None


def test_unverified_google_email_is_rejected(db):
    with pytest.raises(HTTPException) as e:
        oauth_google.resolve_user(db, sub="g-2", email="x@example.com", email_verified=False, full_name="X")
    assert e.value.status_code == 400


def test_wrong_domain_rejected(db, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "allowed_email_domains", "campus.edu")
    with pytest.raises(HTTPException) as e:
        oauth_google.resolve_user(db, sub="g-3", email="x@other.com", email_verified=True, full_name="X")
    assert e.value.status_code == 400


def test_existing_password_account_links_by_email(db, world):
    existing = world.user(email="link@example.com")
    u = oauth_google.resolve_user(db, sub="g-4", email="link@example.com", email_verified=True, full_name="Link")
    assert u.id == existing.id
    db.refresh(existing)
    assert existing.google_sub == "g-4"


def test_same_sub_returns_same_user_idempotently(db):
    a = oauth_google.resolve_user(db, sub="g-5", email="dup@example.com", email_verified=True, full_name="Dup")
    b = oauth_google.resolve_user(db, sub="g-5", email="dup@example.com", email_verified=True, full_name="Dup")
    assert a.id == b.id
