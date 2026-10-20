from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user, require_admin
from ..models import AuthToken, RecoveryCode, RefreshToken, TokenPurpose, User, UserRole
from ..ratelimit import AUTH_LIMIT, limiter
from ..schemas import (
    AuthOut, ForgotIn, LoginIn, MessageOut, MfaChallengeOut, ResetIn, SignupIn, TokenIn,
    TotpConfirmIn, TotpEnrollOut, TotpVerifyIn,
)
from ..security import (
    DUMMY_HASH, create_access_token, create_mfa_pending_token, decode_mfa_pending_token, hash_password,
    hash_token, new_recovery_codes, new_token, new_totp_secret, totp_provisioning_uri, verify_password, verify_totp,
)
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


def _issue_session(db: Session, user: User, response: Response, *, mfa: bool = False) -> AuthOut:
    s = get_settings()
    raw = new_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hash_token(raw), expires_at=_now() + timedelta(days=s.refresh_token_days), mfa=mfa))
    db.commit()
    response.set_cookie(
        COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True, samesite="lax",
        secure=s.is_production, path="/api/auth",
    )
    is_admin = user.role == UserRole.admin
    token = create_access_token(user.id, mfa=mfa, admin=is_admin)
    return AuthOut(access_token=token, user=user_out(user))


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


@router.post("/login", response_model=None)
@limiter.limit(AUTH_LIMIT)
def login(request: Request, body: LoginIn, response: Response, db: Session = Depends(get_db)) -> AuthOut | MfaChallengeOut:
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Invalid email or password")
    if user.role == UserRole.admin and user.totp_enabled:
        return MfaChallengeOut(mfa_token=create_mfa_pending_token(user.id))
    return _issue_session(db, user, response)


@router.post("/admin/2fa/verify", response_model=AuthOut)
@limiter.limit(get_settings().admin_2fa_attempt_limit)
def admin_2fa_verify(request: Request, body: TotpVerifyIn, response: Response, background: BackgroundTasks, db: Session = Depends(get_db)):
    user_id = decode_mfa_pending_token(body.mfa_token)
    if user_id is None:
        raise HTTPException(401, "This login challenge has expired; please log in again")
    user = db.get(User, user_id)
    if user is None or not user.totp_enabled:
        raise HTTPException(401, "This login challenge has expired; please log in again")
    if not _check_code(db, user, body.code):
        raise HTTPException(401, "Incorrect code")
    out = _issue_session(db, user, response, mfa=True)
    background.add_task(email.send_alert, "New admin login", f"{user.email} completed an admin login just now.")
    return out


def _check_code(db: Session, user: User, code: str) -> bool:
    if verify_totp(user.totp_secret, code):
        return True
    row = db.execute(
        select(RecoveryCode).where(RecoveryCode.user_id == user.id, RecoveryCode.code_hash == hash_token(code), RecoveryCode.used_at.is_(None))
    ).scalar_one_or_none()
    if row is None:
        return False
    row.used_at = _now()
    db.commit()
    return True


@router.post("/admin/2fa/enroll", response_model=TotpEnrollOut)
def admin_2fa_enroll(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    # Idempotent while a setup is pending: re-clicking "start setup" (or reloading the page before
    # confirming) must not invalidate whatever secret was already scanned into an authenticator app.
    if not user.totp_secret or user.totp_enabled:
        user.totp_secret = new_totp_secret()
        db.commit()
    return TotpEnrollOut(secret=user.totp_secret, otpauth_uri=totp_provisioning_uri(user.totp_secret, user.email))


@router.post("/admin/2fa/confirm", response_model=AuthOut)
def admin_2fa_confirm(body: TotpConfirmIn, response: Response, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not user.totp_secret or not verify_totp(user.totp_secret, body.code):
        raise HTTPException(400, "Incorrect code")
    user.totp_enabled, user.totp_confirmed_at = True, _now()
    db.execute(RecoveryCode.__table__.delete().where(RecoveryCode.user_id == user.id))
    codes = new_recovery_codes()
    for c in codes:
        db.add(RecoveryCode(user_id=user.id, code_hash=hash_token(c)))
    db.commit()
    # The session that enrolled 2FA was minted before 2FA existed (mfa=false) and is no longer
    # sufficient for admin routes — issue a fresh one now instead of leaving the admin stuck.
    out = _issue_session(db, user, response, mfa=True)
    out.recovery_codes = codes
    return out


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
        .returning(RefreshToken.user_id, RefreshToken.mfa)
    ).first()
    if row is None:
        db.rollback()
        response.delete_cookie(COOKIE, path="/api/auth")
        raise HTTPException(401, "Session expired")
    user = db.get(User, row.user_id)
    return _issue_session(db, user, response, mfa=row.mfa)  # commits the revoke + the new token together


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
