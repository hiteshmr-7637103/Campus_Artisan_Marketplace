# Setup & deployment

## Configuration (`backend/.env`, see `backend/.env.example`)

| Variable | Notes |
|---|---|
| `ENVIRONMENT` | `development` or `production`. Production refuses `PAYMENT_MODE=mock` and the dev JWT secret. |
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/db` |
| `JWT_SECRET` | 32+ random chars: `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `FRONTEND_URL` / `PUBLIC_API_URL` | Used for CORS, email links, and image URLs |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated college domains; empty = open signup (enforced server-side) |
| `COMMISSION_RATE` | Seed value for `app_config` at first migration; change later in the DB row |
| `PAYMENT_MODE` | `mock` (demo) or `razorpay` |
| `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` | Required for `razorpay` mode |
| `RESEND_API_KEY`, `EMAIL_FROM` | Empty key = emails printed to the console |
| `UPLOAD_DIR` | Seller photos on local disk (use a persistent volume; swap for S3/Cloudinary later) |
| `ALERT_EMAIL` | Optional; receives alerts when webhook processing fails |

Frontend: `frontend/.env` has only `VITE_API_URL` (e.g. `https://api.example.com/api`).

## Going live with Razorpay
1. Sign up as **Individual/Unregistered Business** (PAN, govt ID, personal savings account).
2. Put the key id/secret in the API env and set `PAYMENT_MODE=razorpay`, `ENVIRONMENT=production`.
3. In Razorpay → Webhooks, add `https://<api>/api/webhooks/razorpay`, event **payment_link.paid**,
   and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Make one real low-value payment end to end. Never test with live keys otherwise.

## Operations
- `GET /health` checks the database connection; point your uptime monitor at it.
- Payouts and refunds are manual: Admin → Payouts (pay by UPI, record the reference); refund in the
  Razorpay dashboard, then Admin → Orders → "Mark refunded". Orders flagged `needs_refund` are highlighted.
- Backups: enable managed Postgres backups; export `orders`, `payments`, `payouts` weekly.
- Before launch: `pip-audit` and `npm audit`.
- Deploy: API on Render/Railway/Fly.io (Dockerfile in `backend/`, runs `alembic upgrade head` on start),
  managed Postgres (Neon/Railway), frontend on Vercel (`frontend/vercel.json` sets security headers).
