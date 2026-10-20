import uuid

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import SellerStatus, User, UserRole
from .security import decode_access_token_claims, verify_totp

_bearer = HTTPBearer(auto_error=False)


def current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Loads the user from the DB on every request: the token never carries role or verification state."""
    unauthorized = HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    claims = decode_access_token_claims(creds.credentials)
    if claims is None:
        raise unauthorized
    user = db.get(User, uuid.UUID(claims["sub"]))
    if user is None:
        raise unauthorized
    request.state.mfa_completed = bool(claims.get("mfa"))
    return user


def require_verified(user: User = Depends(current_user)) -> User:
    # REQUIRE_EMAIL_VERIFICATION=false skips the check (local development only; refused in production).
    if get_settings().require_email_verification and user.email_verified_at is None:
        raise HTTPException(403, "Please verify your email first")
    return user


def require_seller(user: User = Depends(require_verified)) -> User:
    if user.seller_status != SellerStatus.approved or user.role != UserRole.seller:
        raise HTTPException(403, "Approved seller account required")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(403, "Admin only")
    return user


def require_admin_2fa(request: Request, user: User = Depends(require_admin)) -> User:
    """Gate for every admin business route (not the 2FA enrolment routes themselves)."""
    if not user.totp_enabled:
        raise HTTPException(403, "Enable two-factor authentication to continue")
    if not getattr(request.state, "mfa_completed", False):
        raise HTTPException(403, "Complete two-factor login to continue")
    return user


def step_up(user: User, code: str, db: Session) -> None:
    """Re-verifies a fresh TOTP or single-use recovery code for a sensitive action,
    even inside an already-authenticated admin session. Raises 403 on failure."""
    from .models import RecoveryCode
    from .security import hash_token

    if user.totp_secret and verify_totp(user.totp_secret, code):
        return
    row = db.query(RecoveryCode).filter_by(user_id=user.id, code_hash=hash_token(code), used_at=None).one_or_none()
    if row is not None:
        from datetime import datetime, timezone

        row.used_at = datetime.now(timezone.utc)
        db.commit()
        return
    raise HTTPException(403, "A valid two-factor code is required for this action")
