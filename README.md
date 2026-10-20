# Campus Artisan Marketplace

A two-sided marketplace connecting student artisans with campus buyers. Payment happens **on the
platform** (Razorpay Payment Links); the platform keeps a commission and pays sellers out (payout
ledger, automated hold-window, manual UPI transfer today — see [`docs/STATUS.md`](./docs/STATUS.md)).

**Stack:** FastAPI (Python) · PostgreSQL · SQLAlchemy + Alembic · own JWT auth + Google sign-in +
admin TOTP 2FA · React + Vite (JavaScript) + Tailwind, "CampCraft" design.

- **What's built, what's deferred:** [`docs/STATUS.md`](./docs/STATUS.md)
- **Configuration, deployment, going live:** [`SETUP.md`](./SETUP.md)
- **Original spec and prior planning docs (historical):** [`docs/archive/`](./docs/archive/)

## 5-minute local setup

```bash
# 1. Postgres + API (runs migrations on start). API: http://localhost:8000, Swagger: /docs
docker compose up -d --build

# 2. Optional demo data (admin/buyer/two sellers, password: demo-password-1)
docker compose exec api python -m app.scripts.seed_demo

# 3. Frontend: http://localhost:5173
cd frontend && cp .env.example .env && npm install && npm run dev
```

Defaults run in `PAYMENT_MODE=mock` (a fake checkout page) and print emails to the API console
(`docker compose logs -f api`), so verification links work without any external accounts.

Make yourself an admin (the only way to get admin): sign up in the UI, then
`docker compose exec api python -m app.scripts.make_admin you@college.edu`. Log in and complete
two-factor enrollment at `/admin/2fa` — the admin dashboard is blocked until that's done.

## Tests

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
docker compose exec db psql -U artisan -c "create database artisan_test" postgres   # once
.venv/bin/pytest
```

The suite maps to the security checklist (section 9 of [`docs/archive/artisan-marketplace-requirements.md`](./docs/archive/artisan-marketplace-requirements.md)), plus payout, 2FA and Google sign-in coverage added since; any failure is a launch blocker.

## Layout

```
backend/app/    main.py, config.py, models.py, schemas.py, deps.py, security.py,
                routers/ (auth, oauth, me, catalog, orders, seller, admin, webhooks),
                services/ (payments.mark_order_paid, payouts, statements, oauth_google,
                           razorpay, email, uploads, contact)
backend/alembic/  versioned migrations      backend/tests/  pytest suite
frontend/src/   pages/, components/, lib/api.js (the only file that calls the API), lib/auth.jsx
docker-compose.yml  postgres + api
```

See [`SETUP.md`](./SETUP.md) for configuration, Razorpay, email and deployment.
