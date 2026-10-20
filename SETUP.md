# Setup & deployment

For what's built and what's still open, see [`docs/STATUS.md`](./docs/STATUS.md).

## Configuration (`backend/.env`, see `backend/.env.example`)

| Variable | Notes |
|---|---|
| `ENVIRONMENT` | `development` or `production`. Production refuses `PAYMENT_MODE=mock`, the dev `JWT_SECRET`, and the dev `SESSION_SECRET` (if Google sign-in is enabled). |
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/db` |
| `JWT_SECRET` | 32+ random chars: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `FRONTEND_URL` / `PUBLIC_API_URL` | Used for CORS, email links, image URLs, and the Google OAuth redirect URI |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated college domains; empty = open signup (enforced server-side, Google sign-in too) |
| `COMMISSION_RATE` | Seed value for `app_config` at first migration; change later in the DB row |
| `PAYMENT_MODE` | `mock` (demo) or `razorpay` |
| `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` | Required for `razorpay` mode |
| `RESEND_API_KEY`, `EMAIL_FROM` | Empty key = emails printed to the console — **must** be set in production (verification, reset, 2FA login notice, UPI-change confirmation and weekly statement emails all depend on it) |
| `UPLOAD_DIR` | Seller photos on local disk. Fine on a single-instance VPS with a persistent volume (what `docker-compose.yml` sets up); swap for S3/Cloudinary before running multiple API instances or on an ephemeral-disk platform |
| `ALERT_EMAIL` | Optional; receives alerts when webhook processing fails |
| `PAYOUT_PROVIDER` | `manual` only today; `razorpayx` is not implemented yet (see `docs/STATUS.md`) |
| `PAYOUT_HOLD_HOURS`, `PAYOUT_MAX_PAISE`, `PAYOUT_SELLER_DAILY_CAP_PAISE`, `PAYOUT_PLATFORM_DAILY_CAP_PAISE`, `PAYOUT_NEW_SELLER_DAYS`, `PAYOUT_UPI_CHANGE_COOLDOWN_DAYS`, `PAYOUT_MAX_ATTEMPTS` | Payout lifecycle tuning; defaults are reasonable for a campus-scale launch |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Both empty = Google sign-in disabled (its endpoints return 503). Both must be set together |
| `SESSION_SECRET` | Only used for the brief OAuth redirect (state/nonce). Required to be a real value in production *if* Google sign-in is enabled |
| `TOTP_ISSUER` | Display name shown in an admin's authenticator app |
| `ADMIN_ACCESS_TOKEN_MINUTES` | Shorter-lived session for admin accounts (default 10 min) |
| `BACKGROUND_TASKS_ENABLED` | See "Scheduled jobs" below — set `false` on every instance except one if you ever run more than one API process |

Frontend: `frontend/.env` has only `VITE_API_URL` (e.g. `https://api.example.com/api`).

## Deploy checklist
1. **Domain + HTTPS** for both the API and the frontend.
2. **Managed Postgres** with automated backups on, and one restore tested.
3. Set every production env var above — `check_startup()` in `backend/app/config.py` refuses to
   boot with an unsafe combination (mock payments, dev secrets, missing Razorpay keys if
   `PAYMENT_MODE=razorpay`, mismatched Google client id/secret, etc.), so a misconfigured deploy
   fails fast instead of serving traffic insecurely.
4. **Run migrations on deploy** — already automatic: the Dockerfile's `CMD` runs
   `alembic upgrade head` before starting `uvicorn`.
5. **Make an admin**: `docker compose exec api python -m app.scripts.make_admin you@college.edu`,
   then log in and complete 2FA enrollment at `/admin/2fa` before relying on the admin dashboard —
   `require_admin_2fa` blocks every `/admin/*` route until that's done.
6. **Scheduled jobs run exactly once, not once per instance**: the order-expiry, payout
   hold-window-promotion, and weekly-statement jobs are `asyncio` background tasks inside the API
   process, gated by `BACKGROUND_TASKS_ENABLED`. This is correct for a single API instance (the
   hosting path this repo is set up for). If you ever scale to more than one instance, set
   `BACKGROUND_TASKS_ENABLED=false` on every instance but one, or move these three jobs to a
   separate worker process.
7. **Error logging / uptime**: point your uptime monitor at `GET /health` (checks the DB
   connection). Application logs go to stdout (`logging.basicConfig` in `main.py`) — most
   container platforms capture this automatically; wire up a log drain or Sentry if you want more.
8. **Security audits**: `pip-audit` (backend) is clean — no vulnerable *runtime* dependencies.
   `npm audit` (frontend) flags `react-router-dom@6.26.x` (open-redirect advisory, fixed only in a
   breaking 7.x release — deferred, see `docs/STATUS.md`) and some dev-only tooling (`vite`,
   `tailwindcss`'s toolchain) that never ships in the production bundle.
9. Click through the deployed frontend once against the deployed API before announcing it.

## Going live with Razorpay
1. Sign up as **Individual/Unregistered Business** (PAN, govt ID, personal savings account).
2. Put the key id/secret in the API env and set `PAYMENT_MODE=razorpay`, `ENVIRONMENT=production`.
3. In Razorpay → Webhooks, add `https://<api>/api/webhooks/razorpay`, event **payment_link.paid**,
   and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Make one real low-value payment end to end. Never test with live keys otherwise.

## Going live with Google sign-in
1. Create an OAuth client in Google Cloud Console (type: Web application).
2. Authorized redirect URI: `https://<api>/api/auth/google/callback`.
3. Put the client id/secret in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, and set a real
   `SESSION_SECRET`.
4. The "Continue with Google" button on the frontend works automatically once the backend has
   those set — no frontend config needed.

## Operations
- Payouts: Admin → Payouts. `eligible` rows need a UPI transfer + the admin's 2FA code; `on_hold`
  rows (exceptions) need a 2FA code to release before they can be paid. Refund in the Razorpay
  dashboard, then Admin → Orders → "Mark refunded" (this automatically holds or reverses the
  matching payout — see `docs/STATUS.md` for the full lifecycle).
- Weekly statements generate automatically every Monday; Admin → Statements to view/regenerate any
  of them.
- Backups: managed Postgres backups (above) cover everything; no separate export needed.
