import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from .config import get_settings

_hasher = PasswordHasher()  # Argon2id
# Compared against when the email is unknown so login timing does not leak existence.
DUMMY_HASH = _hasher.hash("dummy-password-for-timing")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: uuid.UUID, *, mfa: bool = False, admin: bool = False) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    ttl = s.admin_access_token_minutes if admin else s.access_token_minutes
    payload = {
        "sub": str(user_id),
        "type": "access",
        "mfa": mfa,
        "iat": now,
        "exp": now + timedelta(minutes=ttl),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=ALGORITHM)


def decode_access_token_claims(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])  # algorithm pinned
        if payload.get("type") != "access":
            return None
        uuid.UUID(payload["sub"])  # validated shape
        return payload
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


def decode_access_token(token: str) -> uuid.UUID | None:
    payload = decode_access_token_claims(token)
    return uuid.UUID(payload["sub"]) if payload else None


def create_mfa_pending_token(user_id: uuid.UUID) -> str:
    """Issued right after a correct password for an admin with 2FA enabled; good only for
    completing the second factor, never accepted by any other endpoint."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": "mfa_pending", "iat": now, "exp": now + timedelta(minutes=s.mfa_pending_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm=ALGORITHM)


def decode_mfa_pending_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "mfa_pending":
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


# ---- TOTP (admin 2FA) -------------------------------------------------------
def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=get_settings().totp_issuer)


def verify_totp(secret: str, code: str) -> bool:
    code = (code or "").strip().replace(" ", "")
    if not code.isdigit():
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def new_recovery_codes(n: int = 8) -> list[str]:
    return [f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(n)]
