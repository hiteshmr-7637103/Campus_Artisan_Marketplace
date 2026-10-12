from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import SellerStatus, User, UserRole
from .security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Loads the user from the DB on every request: the token never carries role or verification state."""
    unauthorized = HTTPException(401, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    user_id = decode_access_token(creds.credentials)
    if user_id is None:
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
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
