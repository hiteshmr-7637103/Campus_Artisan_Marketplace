from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..models import AuthToken, RefreshToken, TokenPurpose, User
from ..ratelimit import AUTH_LIMIT, limiter
from ..schemas import AuthOut, ForgotIn, LoginIn, MessageOut, ResetIn, SignupIn, TokenIn
from ..security import DUMMY_HASH, create_access_token, hash_password, hash_token, new_token, verify_password
from ..services import email
from .me import user_out

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE = "refresh_token"
GENERIC_SIGNUP = "If this email can be registered, we have sent a verification link."
GENERIC_FORGOT = "If an account exists for this email, we have sent a reset link."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _issue_auth_token(db: Session, user: User, purpose: TokenPurpose, ttl: timedelta) -> str:
    raw = new_token()
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw), expires_at=_now() + ttl))
    db.commit()
    return raw


def _issue_session(db: Session, user: User, response: Response) -> AuthOut:
    s = get_settings()
    raw = new_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hash_token(raw), expires_at=_now() + timedelta(days=s.refresh_token_days)))
    db.commit()
    response.set_cookie(
        COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True, samesite="lax",
        secure=s.is_production, path="/api/auth",
    )
    return AuthOut(access_token=create_access_token(user.id), user=user_out(user))


@router.post("/signup", status_code=202, response_model=MessageOut)
@limiter.limit(AUTH_LIMIT)
def signup(request: Request, body: SignupIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    s = get_settings()
    domains = s.email_domains
    if domains and body.email.split("@")[-1].lower() not in domains:
        raise HTTPException(400, f"Signup is restricted to: {', '.join('@' + d for d in domains)}")
    pw_hash = hash_password(body.password)  # always hash so timing matches the existing-email path
    exists = db.execute(select(User.id).where(User.email == body.email)).first()
    if not exists:
        user = User(email=body.email, password_hash=pw_hash, full_name=body.full_name, phone=body.phone)
        db.add(user)
        try:
            db.flush()
        except IntegrityError:  # race with a concurrent signup of the same email
            db.rollback()
            return MessageOut(message=GENERIC_SIGNUP)
        raw = _issue_auth_token(db, user, TokenPurpose.verify_email, timedelta(hours=24))
        background.add_task(email.send_verification, user.email, raw)
    return MessageOut(message=GENERIC_SIGNUP)


@router.post("/login", response_model=AuthOut)
@limiter.limit(AUTH_LIMIT)
def login(request: Request, body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Invalid email or password")
    return _issue_session(db, user, response)


@router.post("/refresh", response_model=AuthOut)
@limiter.limit("60/15 minutes")
def refresh(request: Request, response: Response, refresh_token: str | None = Cookie(default=None, alias=COOKIE), db: Session = Depends(get_db)):
    if not refresh_token:
        raise HTTPException(401, "Not authenticated")
    # Atomic rotation: only one concurrent request can revoke a given live token.
    row = db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(refresh_token), RefreshToken.revoked_at.is_(None), RefreshToken.expires_at > _now())
        .values(revoked_at=_now())
        .returning(RefreshToken.user_id)
    ).first()
    if row is None:
        db.rollback()
        response.delete_cookie(COOKIE, path="/api/auth")
        raise HTTPException(401, "Session expired")
    user = db.get(User, row.user_id)
    return _issue_session(db, user, response)  # commits the revoke + the new token together


@router.post("/logout", response_model=MessageOut)
def logout(response: Response, refresh_token: str | None = Cookie(default=None, alias=COOKIE), db: Session = Depends(get_db)):
    if refresh_token:
        db.execute(update(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token), RefreshToken.revoked_at.is_(None)).values(revoked_at=_now()))
        db.commit()
    response.delete_cookie(COOKIE, path="/api/auth")
    return MessageOut(message="Logged out")


def _consume(db: Session, raw: str, purpose: TokenPurpose) -> User:
    """Single-use: the UPDATE only matches an unused, unexpired token."""
    row = db.execute(
        update(AuthToken)
        .where(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose, AuthToken.used_at.is_(None), AuthToken.expires_at > _now())
        .values(used_at=_now())
        .returning(AuthToken.user_id)
    ).first()
    if row is None:
        db.rollback()
        raise HTTPException(400, "This link is invalid or has expired")
    return db.get(User, row.user_id)


@router.post("/verify-email", response_model=MessageOut)
@limiter.limit(AUTH_LIMIT)
def verify_email(request: Request, body: TokenIn, db: Session = Depends(get_db)):
    user = _consume(db, body.token, TokenPurpose.verify_email)
    if user.email_verified_at is None:
        user.email_verified_at = _now()
    db.commit()
    return MessageOut(message="Email verified")


@router.post("/resend-verification", status_code=202, response_model=MessageOut)
@limiter.limit(AUTH_LIMIT)
def resend_verification(request: Request, background: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified_at is None:
        raw = _issue_auth_token(db, user, TokenPurpose.verify_email, timedelta(hours=24))
        background.add_task(email.send_verification, user.email, raw)
    return MessageOut(message="If your email is not yet verified, we have sent a new link.")


@router.post("/forgot-password", status_code=202, response_model=MessageOut)
@limiter.limit(AUTH_LIMIT)
def forgot_password(request: Request, body: ForgotIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user:
        raw = _issue_auth_token(db, user, TokenPurpose.reset_password, timedelta(hours=1))
        background.add_task(email.send_password_reset, user.email, raw)
    return MessageOut(message=GENERIC_FORGOT)


@router.post("/reset-password", response_model=MessageOut)
@limiter.limit(AUTH_LIMIT)
def reset_password(request: Request, body: ResetIn, db: Session = Depends(get_db)):
    user = _consume(db, body.token, TokenPurpose.reset_password)
    user.password_hash = hash_password(body.password)
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).values(revoked_at=_now()))
    db.commit()
    return MessageOut(message="Password updated. Please log in.")
