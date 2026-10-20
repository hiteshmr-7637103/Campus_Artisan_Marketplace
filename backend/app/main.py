import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal, get_db
from .errors import install_error_handlers
from .ratelimit import limiter
from .routers import admin, auth, catalog, me, oauth, orders, seller, webhooks
from .services import payments, payouts, statements

log = logging.getLogger("app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


async def _expiry_loop() -> None:
    while True:
        await asyncio.sleep(180)
        try:
            def run():
                with SessionLocal() as db:
                    return payments.expire_stale_orders(db)

            n = await asyncio.to_thread(run)
            if n:
                log.info("expired %d stale orders", n)
        except Exception:  # noqa: BLE001
            log.exception("order expiry task failed")


async def _payout_loop() -> None:
    """Runs the hold-window promotion (pending -> eligible/on_hold) every few minutes.
    A separate, single-writer process should run this in production (see scripts.run_payout_jobs)
    so it fires exactly once, not once per API instance."""
    while True:
        await asyncio.sleep(300)
        try:
            def run():
                with SessionLocal() as db:
                    return payouts.promote_eligible(db)

            n = await asyncio.to_thread(run)
            if n:
                log.info("promoted %d payouts to eligible", n)
        except Exception:  # noqa: BLE001
            log.exception("payout promotion task failed")


async def _statement_loop() -> None:
    """Checks once an hour; generates last week's statements the first time it sees a Monday."""
    last_run_monday = None
    while True:
        await asyncio.sleep(3600)
        now = datetime.now(timezone.utc)
        if now.weekday() != 0:
            continue
        today = now.date()
        if today == last_run_monday:
            continue
        try:
            def run():
                with SessionLocal() as db:
                    start, end = statements.week_bounds(now)
                    return statements.generate_for_week(db, start, end)

            n = await asyncio.to_thread(run)
            last_run_monday = today
            log.info("generated %d weekly statements", n)
        except Exception:  # noqa: BLE001
            log.exception("weekly statement task failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    s.check_startup()  # refuses PAYMENT_MODE=mock in production, etc.
    Path(s.upload_dir).mkdir(parents=True, exist_ok=True)
    tasks = []
    if s.background_tasks_enabled:
        tasks = [asyncio.create_task(_expiry_loop()), asyncio.create_task(_payout_loop()), asyncio.create_task(_statement_loop())]
    yield
    for t in tasks:
        t.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="Campus Artisan Marketplace API", version="2.0.0", lifespan=lifespan,
        docs_url="/docs", redoc_url=None,
    )
    app.state.limiter = limiter
    install_error_handlers(app)

    app.add_middleware(SlowAPIMiddleware)
    if s.google_enabled:
        from starlette.middleware.sessions import SessionMiddleware

        # Only used transiently to hold the OAuth state/nonce between the redirect and the callback.
        app.add_middleware(SessionMiddleware, secret_key=s.session_secret, same_site="lax", https_only=s.is_production, max_age=600)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["X-Frame-Options"] = "DENY"
        if request.url.path not in ("/docs", "/openapi.json"):
            resp.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if s.is_production:
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return resp

    app.add_middleware(
        CORSMiddleware, allow_origins=[s.frontend_url.rstrip("/")], allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"],
    )

    api = APIRouter(prefix="/api")
    for r in (auth.router, oauth.router, me.router, catalog.router, orders.router, seller.router, admin.router, webhooks.router):
        api.include_router(r)
    if s.payment_mode == "mock":
        api.include_router(webhooks.dev_router)

    @api.get("/health", tags=["ops"])
    def health(db: Session = Depends(get_db)):
        db.execute(text("select 1"))
        return {"status": "ok"}

    app.include_router(api)
    app.add_api_route("/health", health, methods=["GET"], tags=["ops"])

    Path(s.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=s.upload_dir), name="uploads")
    return app


app = create_app()
