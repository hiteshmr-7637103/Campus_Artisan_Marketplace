"""Google sign-in (OIDC). Account linking and domain/verification rules live in `resolve_user`,
which is pure (no network) so it is unit-testable without a real Google round trip."""
import secrets
from datetime import datetime, timezone

from authlib.integrations.starlette_client import OAuth
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import User
from ..security import hash_password

_oauth = OAuth()
_registered = False


def client():
    global _registered
    s = get_settings()
    if not s.google_enabled:
        raise HTTPException(503, "Google sign-in is not configured")
    if not _registered:
        _oauth.register(
            name="google",
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_id=s.google_client_id,
            client_secret=s.google_client_secret,
            client_kwargs={"scope": "openid email profile"},
        )
        _registered = True
    return _oauth.google


def resolve_user(db: Session, *, sub: str, email: str, email_verified: bool, full_name: str) -> User:
    """Links a Google identity to a user, enforcing the same rules as password signup.
    Raises HTTPException on a rejected domain or an unverified Google email."""
    if not email_verified:
        raise HTTPException(400, "Your Google account's email is not verified")
    domains = get_settings().email_domains
    if domains and email.split("@")[-1].lower() not in domains:
        raise HTTPException(400, f"Sign-in is restricted to: {', '.join('@' + d for d in domains)}")

    user = db.execute(select(User).where(User.google_sub == sub)).scalar_one_or_none()
    if user is not None:
        return user

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is not None:
        user.google_sub = sub  # link: an existing password account and a Google login for the same email are the same user
        if user.email_verified_at is None:
            user.email_verified_at = datetime.now(timezone.utc)
        db.commit()
        return user

    user = User(
        email=email, google_sub=sub, full_name=full_name or email.split("@")[0],
        password_hash=hash_password(secrets.token_urlsafe(32)),  # unusable random password; sign-in is Google-only
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    return user
