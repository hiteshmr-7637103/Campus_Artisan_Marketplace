# Current status

_Last updated: 2026-10-20._ This supersedes [`archive/current-status.md`](./archive/current-status.md)
(the pre-payout/pre-2FA snapshot) and reports progress against the roadmap in
[`archive/artisian_prehosting.md`](./archive/artisian_prehosting.md). The original full spec is
[`archive/artisan-marketplace-requirements.md`](./archive/artisan-marketplace-requirements.md).

**Stack:** FastAPI (Python) · PostgreSQL · SQLAlchemy + Alembic · own JWT auth + Google OIDC (Authlib)
+ admin TOTP 2FA (PyOTP) · React + Vite (JavaScript) + Tailwind ("CampCraft" design) · Docker ·
Razorpay Payment Links.

**Tests:** 59 backend tests passing (`cd backend && source .venv/bin/activate && pytest -q`),
frontend production build passing (`cd frontend && npm run build`).

---

## 1. Built and working

### Core marketplace (pre-existing baseline)
- Auth: signup, email verification, login, rotating refresh cookie, logout, password reset.
- `ALLOWED_EMAIL_DOMAINS` enforced server-side.
- Listings, categories, search, seller profiles, orders, reviews.
- Money stored as integer paise; commission rate in the database.
- `mark_order_paid` is the only code path that can set an order to paid.
- Payment modes: `mock` (local) and `razorpay`; server refuses mock mode in production.
- 30-minute auto-cancel of unpaid orders; a late payment on an expired order is recorded and
  flagged for refund instead of being dropped.
- Seller contact details shown only to the owner, an admin, or a buyer with a paid order.
- Seller onboarding: apply, admin approval, dashboard, listing create/edit with photo upload.

### 3.1 — Automated payouts, ledger, weekly statements
- Payout states: `pending → eligible → processing → paid`, with `failed`, `on_hold`, `reversed`
  side paths. One payout row per order (idempotent), created only when the order is fulfilled.
- Automatic hold-window promotion job (every 5 min; default 36h hold) with exception rules: amount
  above cap, seller's UPI changed recently, seller has no prior successful payout ("newly
  approved"), too many past failures → pulled to `on_hold` for manual review.
- Exact-match invariant + per-payout/seller/platform-wide daily caps (circuit breaker) re-checked
  immediately before every send — the amount is always server-computed, never accepted from a
  request.
- Refunds net via an append-only `PayoutAdjustment`, never by editing an already-paid row.
- Admin ledger: filters (seller/status/method/search/date range), totals, CSV export, per-seller
  summary, release-hold, platform finance view (commission earned, outstanding to sellers, failed/
  stuck/large-payout alerts), weekly statements (list/view/regenerate).
- Seller-side: Payouts tab with real statuses + gross/commission breakdown, Statements tab with
  CSV download.
- Provider is `manual` only (`PAYOUT_PROVIDER=manual`); RazorpayX/automated transfer is **not**
  implemented — the hold-window/exception/caps logic is provider-agnostic and ready for it.

### 3.2 — Google sign-in (OIDC) + admin 2FA
- Google sign-in: `User.google_sub` linking, domain restriction and verified-email requirement
  enforced, links to an existing password account by email, creates a new verified account
  otherwise. Disabled cleanly (503) unless `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.
- Admin 2FA: TOTP enroll (idempotent while pending) → confirm (issues a fresh `mfa=true` session
  immediately, plus one-time recovery codes) → every subsequent admin login challenges for a code.
  `require_admin_2fa` gates all `/admin/*` routes. Step-up (fresh TOTP/recovery code) required on
  the two money-moving payout endpoints (`mark-paid`, `release`).
- Secure UPI-ID change: current password + a 1-hour emailed confirmation link + the existing
  cooldown (already feeding the 3.1 exception rule) before the new UPI affects payouts.
- Account page redesigned with a standard view/edit toggle instead of an always-editable form.

---

## 2. Known gaps / deferred (tracked, not blockers for a first deploy)

- **RazorpayX / automated payout transfer** — still manual; owned by the teammate doing Razorpay
  go-live, per the original roadmap.
- **Lost-2FA-device recovery** — no self-service "reset my 2FA" flow if an admin loses both their
  device and all recovery codes; needs direct DB access from another operator today.
- **`react-router-dom` is on 6.26.x**, which `npm audit` flags for an open-redirect advisory fixed
  only in 7.18.4+ (a major-version bump with breaking API changes). Deferred rather than risking an
  untested migration late in the project — do this with dedicated regression testing before launch
  if it's a concern for your threat model.
- Frontend dev-only dependencies (`vite`, `tailwindcss`'s `postcss`/`chokidar` chain, `esbuild`)
  have `npm audit` advisories; none run in the shipped production bundle (static HTML/JS/CSS), so
  they don't affect the deployed app, only the local dev server.
- Object storage for listing photos (S3/Cloudinary) is not wired up — the Docker image currently
  persists `/data/uploads` to a named volume, which is sufficient for a single-instance VPS/
  container deployment (the hosting path this repo's `Dockerfile`/`docker-compose.yml` are built
  for) but will need swapping out before scaling to multiple API instances or an ephemeral-disk
  platform.
- Scheduled background jobs (order-expiry, payout hold-window promotion, weekly statements) run as
  `asyncio` tasks inside the API process itself, gated by `BACKGROUND_TASKS_ENABLED`. This is
  correct for exactly one running instance; if you ever scale to multiple API instances, only one
  of them should have `BACKGROUND_TASKS_ENABLED=true` (or move these to a separate worker process),
  or the jobs will run once per instance.

---

## 3. Suggested next step

**3.3 Hosting** (see [`../SETUP.md`](../SETUP.md) for the concrete checklist), in parallel with the
teammate's Razorpay go-live and UI polish — per the original roadmap's suggested order of work.
