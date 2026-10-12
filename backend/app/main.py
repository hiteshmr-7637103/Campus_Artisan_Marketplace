import asyncio
import logging
from contextlib import asynccontextmanager
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
from .routers import admin, auth, catalog, me, orders, seller, webhooks
from .services import payments

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    s.check_startup()  # refuses PAYMENT_MODE=mock in production, etc.
    Path(s.upload_dir).mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(_expiry_loop()) if s.background_tasks_enabled else None
    yield
    if task:
        task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="Campus Artisan Marketplace API", version="2.0.0", lifespan=lifespan,
        docs_url="/docs", redoc_url=None,
    )
    app.state.limiter = limiter
    install_error_handlers(app)

    app.add_middleware(SlowAPIMiddleware)

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
    for r in (auth.router, me.router, catalog.router, orders.router, seller.router, admin.router, webhooks.router):
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
