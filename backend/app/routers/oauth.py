from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..services import oauth_google
from .auth import _issue_session

router = APIRouter(prefix="/auth/google", tags=["auth"])


@router.get("/login")
async def google_login(request: Request):
    s = get_settings()
    redirect_uri = f"{s.public_api_url.rstrip('/')}/api/auth/google/callback"
    return await oauth_google.client().authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    s = get_settings()
    try:
        token = await oauth_google.client().authorize_access_token(request)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, "Google sign-in failed") from e
    claims = token.get("userinfo") or {}
    user = oauth_google.resolve_user(
        db, sub=claims.get("sub", ""), email=claims.get("email", ""),
        email_verified=bool(claims.get("email_verified")), full_name=claims.get("name", ""),
    )
    resp = RedirectResponse(url=f"{s.frontend_url.rstrip('/')}/auth/google/complete")
    _issue_session(db, user, resp)  # sets the refresh cookie on the redirect response; the frontend then calls /auth/refresh
    return resp
