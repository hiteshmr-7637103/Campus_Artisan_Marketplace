# Campus Artisan Marketplace — Build Requirements (v2: FastAPI + PostgreSQL, account-based)

## 0. Context for whoever implements this (including Claude Code)

A **two-sided marketplace** connecting student artisans (handmade jewelry, decor, textiles, pottery, etc.) with campus buyers. Launches in one college first, with intent to expand to other campuses.

- **Business model:** commission on each sale. Platform keeps a percentage; the rest goes to the artisan.
- **Stage:** unregistered, individual venture. No LLP/Pvt Ltd/GST yet. Nothing here may assume a registered entity. Payments use **Razorpay's Individual/Unregistered KYC tier** (PAN + govt ID + personal savings account).
- **Core risk:** free substitutes (Instagram DMs, WhatsApp groups, fest stalls). The platform only exists if it is clearly better. Therefore:
  - **Payment must happen ON the platform.** No COD, no static QR, no "DM to arrange UPI". Otherwise there is no commission and no moat.
  - Keep friction low even with accounts: **browsing is public**; login is required only to buy, sell, or review.
- **What changed from v1 (Supabase version):** the backend is now a **real, self-owned API server written in Python (FastAPI)** talking to a **PostgreSQL** database, instead of Supabase Auth + RLS + Edge Functions. We own authentication, authorization, payments logic and the database schema end to end. The React (TypeScript) frontend stays and talks to the API over HTTP/JSON.
- **Why this is a good demo of a "proper product":** a documented REST API (auto-generated Swagger page at `/docs`), a relational database with migrations and constraints, real login with roles, a payment flow with a webhook, an admin panel, automated security tests, and a one-command local setup with Docker.
- **Scale target:** one campus, dozens-to-hundreds of listings, low hundreds-to-low-thousands of users. Do not over-engineer for scale; do not skimp on correctness of auth, money, and data access.

**Open decision (founder to confirm):** signup restricted to college email domains vs open to anyone. Build it as a config value `ALLOWED_EMAIL_DOMAINS` (comma-separated; empty = open). Default: empty. Enforce **server-side in the signup endpoint**, not only in the UI.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API server | **FastAPI** (Python 3.11+) | Simple, readable, type-checked request/response models, automatic `/docs` page for demos |
| Validation | **Pydantic v2** | Every request body is validated against a model before any code runs |
| Database | **PostgreSQL 16** (Docker for local) | Relational, constraints, transactions, enums |
| ORM + migrations | **SQLAlchemy 2.0 + Alembic** | Models in Python; every schema change is a versioned migration file |
| Auth | **Own JWT auth**: `argon2-cffi` (or `bcrypt`) for passwords, `PyJWT` for tokens | No third-party auth service; full control |
| Rate limiting | `slowapi` | Throttle login/signup/reset/order creation |
| File uploads | `python-multipart` + `Pillow` (verify real image type) | Seller photos stored on disk (`/uploads`) locally, swap for S3/Cloudinary later |
| HTTP client | `httpx` | Calls Razorpay Payment Links API |
| Email | Resend (free tier) via `httpx`; **prints to console when no API key** | Email failure must never break a flow |
| Tests | `pytest` + FastAPI `TestClient` against a real test Postgres | Automates the security checklist (Section 9) |
| Frontend | Existing React + Vite + TS + Tailwind, **Supabase client removed**, replaced by a small `api.ts` fetch wrapper | Reuse existing UI pages |
| Local run | `docker compose up` starts Postgres + API; frontend via `npm run dev` | One-command demo |
| Hosting (later) | API on Render/Railway/Fly.io, Postgres managed (Neon/Railway), frontend on Vercel | All have free tiers |

**Config via environment variables** (never committed; `.env` in `.gitignore`, `.env.example` committed):
`DATABASE_URL`, `JWT_SECRET` (32+ random chars), `FRONTEND_URL`, `PUBLIC_API_URL`, `ALLOWED_EMAIL_DOMAINS`, `COMMISSION_RATE` (seed value), `PAYMENT_MODE` (`mock` | `razorpay`), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `UPLOAD_DIR`.

**Mock payment mode (for demos before Razorpay KYC):** with `PAYMENT_MODE=mock`, `create-order` returns a local "fake checkout" page URL, and a dev-only endpoint marks the order paid by calling the **same internal function the real webhook uses**. The server must **refuse to start with `PAYMENT_MODE=mock` when `ENVIRONMENT=production`**.

---

## 2. Roles & Accounts

| Role | How obtained | Can do |
|---|---|---|
| **Visitor** (no login) | n/a | Browse listings, view listing detail, view public seller profile + ratings |
| **Buyer** | Sign up (default for every account) | Everything a visitor can + checkout, view own orders, leave reviews |
| **Seller** | Buyer applies, admin approves | Everything a buyer can (except buying own listings) + create/edit/archive own listings, view orders received, view payout status |
| **Admin** | Created by a CLI script run by a founder (`python -m app.scripts.make_admin <email>`). **No public path to admin.** | Approve sellers and listings, view all orders, record payouts, mark orders fulfilled/cancelled/refunded, see metrics |

### Authentication requirements (implemented in our own API)
- **Signup** with email + password + full name (phone optional). Password: min 8 chars, max 128. Hashed with Argon2id (or bcrypt cost 12). Never logged, never returned.
- **Email verification** (link with a single-use, 24-hour token) required before checkout, seller application, or review.
- **Login** returns a short-lived **access token** (JWT, 15 min) in the JSON response and sets a **refresh token** (random, 14 days) in an **httpOnly, SameSite=Lax, Secure (in production)** cookie. Refresh tokens are stored **hashed** in the DB, **rotated on every use**, and revocable (logout, password reset).
- **Password reset:** "forgot password" emails a single-use, 1-hour token; using it sets the new password and **revokes all refresh tokens**.
- **Do not trust the token for role or verification state:** on every request the API loads the user from the DB, so a demotion or approval takes effect immediately.
- **No account enumeration:** signup, login and forgot-password responses are identical whether or not the email exists (login also does a dummy hash compare for unknown emails so timing does not leak).
- Logout revokes the refresh token. Frontend redirects protected routes to login and returns the user to where they were.
- **Google sign-in:** optional, **post-V1** (needs a Google Cloud OAuth client; add with `authlib` later). Not required for the first demo.
- Admin MFA (TOTP via `pyotp`): recommended, optional for V1.
- Account deletion/data export: out of scope for v1 (mention a contact email in the Privacy Policy).

---

## 3. Feature Scope

### 3.1 Public / Buyer
- Home: listing grid (newest first), category filter, basic title search (`ILIKE`).
- Listing detail: photos, title, description, price, category, seller public profile (display name, bio, average rating, review count). **No seller contact info** (see 6.2).
- Checkout (login required): order summary, then payment page, then confirmation page.
- "My orders": list + detail with status; after payment, seller contact becomes visible on that order.
- Review prompt on fulfilled orders.

### 3.2 Seller
- Apply to become a seller: display name, bio, phone, Instagram (optional), UPI ID for payouts. Status `pending` until admin approves.
- Dashboard: my listings (create, edit, archive), orders received (buyer name/phone only after payment), payout status per order.
- Listing form: title, category, price (INR), description, 1–3 images.
- New listings start `pending_review`; admin approves, then they become `active`. Edits to an approved listing do not require re-approval in v1 (admin can archive anything).
- Listings are single-item (one-off handmade pieces): once paid, status becomes `sold`. No stock counts or variants in v1.

### 3.3 Admin
- Seller applications queue (approve/reject).
- Listing review queue (approve/reject, archive).
- All orders table with filters by status; orders flagged `needs_refund` highlighted.
- Payouts view: orders paid and awaiting payout, with seller UPI ID and amount owed; "mark paid" with UPI transaction reference.
- Actions: mark order fulfilled, cancel, mark refunded (the refund itself is done manually in the Razorpay dashboard).
- Metrics page: signups, active sellers, listings, checkouts started, paid orders, GMV, commission earned (feeds Section 12).

### 3.4 Transactional email
Order paid (buyer and seller), order fulfilled (buyer, with review link), seller approved/rejected, listing approved/rejected, plus verification and password-reset emails. Sent from a background task; **a failure is logged and never blocks the request**.

### 3.5 Explicitly out of scope for v1
In-app chat, wishlists, recommendations, multi-item cart, stock/variants, automated payouts (Razorpay Route), refund automation, dispute workflow, seller-rates-buyer, native apps, push notifications, SEO, multi-campus tenancy, Google sign-in (post-V1).

---

## 4. REST API (all under `/api`, JSON, documented automatically at `/docs`)

**Auth** (public unless noted)
| Method + path | Purpose |
|---|---|
| `POST /auth/signup` | Create account, send verification email (generic 202 response) |
| `POST /auth/login` | Returns access token, sets refresh cookie |
| `POST /auth/refresh` | Rotates refresh token, returns new access token |
| `POST /auth/logout` | Revokes refresh token |
| `POST /auth/verify-email` | Body `{token}` |
| `POST /auth/resend-verification` | Logged in |
| `POST /auth/forgot-password`, `POST /auth/reset-password` | Reset flow |
| `GET /me`, `PATCH /me` | Own profile. `PATCH` accepts **only** `full_name`, `phone`; unknown fields (e.g. `role`) are rejected |

**Public catalog**
| Method + path | Purpose |
|---|---|
| `GET /categories` | List categories |
| `GET /listings?category=&q=&page=` | Active listings only, via the public-safe view |
| `GET /listings/{id}` | Active listing detail |
| `GET /sellers/{id}` | Public profile, rating, reviews |

**Buyer** (logged in; verified where noted)
| Method + path | Purpose |
|---|---|
| `POST /orders` | Body `{listing_id}` only. **Verified** email required. Creates order + payment link |
| `GET /orders`, `GET /orders/{id}` | Own orders; seller contact included only when `paid`/`fulfilled` |
| `POST /orders/{id}/review` | **Verified**, own `fulfilled` order, one per order |

**Seller** (approved sellers; `POST /seller/apply` for verified buyers)
| Method + path | Purpose |
|---|---|
| `POST /seller/apply` | Create seller profile, status `pending` |
| `GET/POST /seller/listings`, `PATCH /seller/listings/{id}`, `POST /seller/listings/{id}/archive` | Own listings only; cannot set status to `active`/`sold` |
| `POST /seller/listings/{id}/images` | Multipart upload, max 3 per listing |
| `GET /seller/orders`, `GET /seller/payouts` | Own orders (buyer contact only after payment) and payout status |

**Admin** (role `admin`, every endpoint checked server-side)
`GET /admin/sellers`, `POST /admin/sellers/{id}/decision`, `GET /admin/listings`, `POST /admin/listings/{id}/decision`, `GET /admin/orders`, `POST /admin/orders/{id}/fulfill|cancel|refund`, `GET /admin/payouts`, `POST /admin/payouts/{id}/mark-paid`, `GET /admin/metrics`.

**Payments**
`POST /webhooks/razorpay` (public, signature-verified, raw body), `POST /dev/simulate-payment/{order_id}` (exists **only** when `PAYMENT_MODE=mock`).

Pages the frontend needs: `/`, `/listing/:id`, `/seller/:id`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account`, `/orders`, `/orders/:id`, `/checkout/:listingId`, `/checkout/return` (polls order status from the API, never trusts URL params), `/mock-pay/:orderId` (mock mode only), `/sell/apply`, `/sell`, `/sell/listings/new`, `/sell/listings/:id/edit`, `/sell/orders`, `/admin/*`, `/privacy`, `/terms`. Frontend route guards are UX only; **real enforcement is in the API.**

---

## 5. Data Model (PostgreSQL, relational, with constraints)

All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`. Money stored as **integer paise** (never floats). Statuses are Postgres enums. Every change is an **Alembic migration** committed to the repo.

| Table | Key columns | Constraints / notes |
|---|---|---|
| `users` | `email` (citext, unique), `password_hash`, `full_name`, `phone`, `role` (buyer/seller/admin, default buyer), `seller_status` (none/pending/approved/rejected, default none), `email_verified_at` | `role` and `seller_status` are never written by any user-facing endpoint; only admin endpoints and the admin CLI change them |
| `refresh_tokens` | `user_id` (FK), `token_hash` (unique), `expires_at`, `revoked_at` | Store only the hash of the token |
| `auth_tokens` | `user_id` (FK), `purpose` (verify_email/reset_password), `token_hash` (unique), `expires_at`, `used_at` | Single use |
| `seller_public` | `seller_id` (PK, FK users), `display_name`, `bio` | Safe to show publicly |
| `seller_private` | `seller_id` (PK, FK users), `phone`, `instagram`, `upi_id` | **Never returned by public endpoints**; see 6.2 |
| `categories` | `name` (unique), `slug` (unique) | Seeded: jewelry, decor, textiles, pottery, other |
| `listings` | `seller_id` (FK), `category_id` (FK), `title`, `description`, `price_paise` (CHECK > 0), `status` (pending_review/active/sold/rejected/archived) | Index on (`status`, `created_at`) |
| `listing_images` | `listing_id` (FK, ON DELETE CASCADE), `storage_path`, `position` (0–2) | UNIQUE (`listing_id`, `position`) caps images at 3 |
| `orders` | `buyer_id`, `seller_id`, `listing_id` (FKs), `amount_paise`, `commission_rate`, `commission_paise`, `seller_amount_paise`, `status` (pending_payment/paid/fulfilled/cancelled/refunded), `needs_refund` bool, `razorpay_payment_link_id`, `paid_at`, `fulfilled_at` | CHECK `buyer_id <> seller_id`; CHECK `commission_paise + seller_amount_paise = amount_paise`; amounts are **snapshots** taken at creation |
| `payments` | `order_id` (FK), `razorpay_payment_id` (**unique**), `amount_paise`, `status`, `raw_event` jsonb | Written only by the payment-confirmation function |
| `payouts` | `order_id` (FK, **unique**), `seller_id` (FK), `amount_paise`, `status` (pending/paid), `upi_txn_ref`, `paid_at` | Created when an order is confirmed paid (not for refund-flagged orders) |
| `reviews` | `order_id` (FK, **unique**), `buyer_id`, `seller_id`, `listing_id`, `rating` (CHECK 1–5), `comment` (max 1000) | One per order; no edits/deletes by users |
| `webhook_events` | `event_id` (**unique**), `type`, `received_at` | Idempotency: insert first; duplicate means ignore |
| `app_config` | `commission_rate` (e.g. 0.10) | Single row; read when creating orders |

**Views (public-safe):** `public_listings` (active listings joined with category, images, seller display name, rating; excludes anything private) and `seller_ratings` (average rating and review count per seller).

---

## 6. Core Flows

### 6.1 Purchase flow (all money logic is server-side)
1. A logged-in, verified buyer clicks Buy on an `active` listing.
2. Frontend calls `POST /api/orders` with **only** `{listing_id}`. The API:
   - verifies the user, verified email, listing `active`, buyer is not the seller;
   - reads the price from the DB and the commission rate from `app_config`, computes and **snapshots** the amounts;
   - inserts the `orders` row (`pending_payment`);
   - creates a Razorpay **Payment Link** (amount from DB, `reference_id` = order id, callback URL = `/checkout/return`) and returns its URL.
3. Buyer is redirected to Razorpay hosted checkout and pays.
4. Razorpay calls `POST /api/webhooks/razorpay`. The handler must: (a) verify the HMAC-SHA256 signature over the **raw body** with a constant-time compare; (b) insert `event_id` into `webhook_events` (duplicate: return 200 and stop); (c) on a paid event call the single internal function `mark_order_paid(order_id, payment_id, amount)`.
5. **`mark_order_paid`** (the only code path that can set `paid`) runs in **one database transaction**:
   - lock the order row (`SELECT ... FOR UPDATE`); if it is not `pending_payment`, stop;
   - atomically `UPDATE listings SET status='sold' WHERE id=:id AND status='active'`;
   - if 1 row updated **and** the paid amount equals `amount_paise`: order `paid`, insert `payments`, insert `payouts` (pending), send emails;
   - otherwise (someone else bought first, or amount mismatch): order `paid` with `needs_refund = true`, no payout; admin sees it flagged and refunds manually in Razorpay.
6. `/checkout/return` polls `GET /orders/{id}` until `paid` (or shows "payment processing" after a timeout). It never trusts query-string "success".
7. Seller hands over the item; admin marks `fulfilled`; buyer gets an email with a review link.
8. Admin pays the seller `seller_amount_paise` via UPI, then marks the payout `paid` with the transaction reference.
9. Orders stuck in `pending_payment` for more than 30 minutes are expired by a background task (every few minutes) and the payment link is cancelled.

### 6.2 Contact masking (privacy rule, enforced in the API's SQL, not the UI)
- `seller_private` is only ever read by: the owner, admins, and a buyer who has an order with that seller in status `paid` or `fulfilled`. Implement as one query helper that joins `orders`; no other code reads this table.
- Sellers see buyer name/phone only for their own `paid`/`fulfilled` orders.
- Public endpoints return only the `public_listings` and `seller_public` shapes. Pydantic **response models** list fields explicitly, so a private column cannot leak by accident. No "contact seller" buttons anywhere.

### 6.3 Reviews
Buyer, own order, status `fulfilled`, one per order (unique constraint). Shown on the listing and seller profile with the average rating.

---

## 7. Access Control (replaces Supabase RLS)

There is no database-level row security in this version; **the API is the only door to the database**, and these rules are enforced in code and tested:

- **One `current_user` dependency** loads the user from the DB on every request. Dependencies `require_verified`, `require_seller` (approved), and `require_admin` wrap every protected route. Default for new routes is **deny**.
- **Ownership-scoped queries:** every query on listings, orders, payouts, etc. includes the owner id (`WHERE seller_id = :me`). Looking up another user's record by ID returns **404**, not 403 (no information leak).
- **No client can write** `orders`, `payments`, `payouts`, `role`, `seller_status`, or listing `status` beyond `pending_review`/`archived`. Those change only inside admin endpoints or `mark_order_paid`.
- **Pydantic models forbid extra fields** (`extra="forbid"`) so an attacker cannot smuggle `role` or `amount` into a request.
- Admin endpoints re-check `role == 'admin'` themselves (not just a frontend check).
- The database user used by the API has no superuser rights; secrets live only in environment variables.

| Resource | Visitor | Logged-in buyer | Approved seller | Admin |
|---|---|---|---|---|
| Active listings, seller public profile | read | read | read | read |
| Own profile | none | read/update name, phone | same | same |
| `seller_private` | none | only for sellers with their own paid/fulfilled order | own | read |
| Listings (any status) | none | none | own: create/edit/archive | all |
| Orders | none | own (as buyer) | own (as seller) | all; status actions |
| Payouts | none | none | own, read-only | read; mark paid |
| Reviews | read | create (rules above) | read | read/delete |

**Uploads:** accepted only from approved sellers; max 2 MB; allowed types `image/jpeg`, `image/png`, `image/webp`, **verified by opening the file with Pillow** (not by trusting the extension or `Content-Type`); saved under a server-generated random filename in `uploads/{user_id}/`; max 3 per listing.

---

## 8. Payment Integration Notes

**Founder setup before live keys:** sign up on Razorpay as **Individual/Unregistered Business** (PAN, govt photo ID, personal savings account of one founder). Money collected is that person's income for tax purposes until the business is registered; keep records from day one.

- Amount always read from the DB server-side; never from the client.
- Verify the webhook signature over the raw request body; reject on mismatch (4xx, no DB change).
- Use the Payment Links "paid" event as the source of truth.
- Payouts to artisans are **manual** for v1 (Route/auto-split needs business KYC).
- Refunds are manual in the Razorpay dashboard; the app only records the `refunded` status.
- Never store card/UPI credentials; store only Razorpay IDs and statuses.

---

## 9. Security Requirements

Not a compliance exercise: each item prevents a specific way a user could lose money or data.

**Authentication & accounts**
- Passwords: Argon2id/bcrypt only; never logged or returned. Tokens (refresh, verify, reset) stored only as SHA-256 hashes.
- Rate limits (`slowapi`) on signup, login, forgot/reset password and order creation (for example 20 attempts per 15 minutes per IP on auth routes). Add CAPTCHA (Cloudflare Turnstile) on signup if abuse appears.
- Generic auth error messages and identical responses for existing/non-existing emails.
- JWT: HS256 with a strong secret from the environment, short expiry, algorithm pinned on verify.
- **CORS** restricted to `FRONTEND_URL` only; cookies httpOnly + SameSite=Lax (+ Secure in production).

**Web attacks**
- **SQL injection:** only SQLAlchemy expressions or bound parameters; never build SQL with f-strings or string concatenation.
- **XSS:** React escapes by default; never `dangerouslySetInnerHTML` with user content; length limits on all text fields; set a Content-Security-Policy header on the frontend host.
- **CSRF:** state-changing calls use the `Authorization: Bearer` header (not ambient cookies); the refresh endpoint is the only cookie-authenticated route and is SameSite=Lax.
- **Input validation:** Pydantic models with explicit types and bounds (price > 0, phone format, rating 1–5, text lengths) **plus** DB CHECK constraints as a second layer.
- **File uploads:** see Section 7.
- **Headers:** HTTPS only in production; `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`/`X-Frame-Options` set (middleware or host config).
- **Secrets hygiene:** `.env` in `.gitignore`; no secrets in the repo or frontend bundle; rotate if ever leaked.
- **Dependencies:** pin versions in `requirements.txt`/lockfile; run `pip-audit` and `npm audit` before launch.
- **Logging:** never log passwords, tokens, or full request bodies of auth routes.

### Security verification checklist (implementation is not done until each test passes; automate in `pytest`)

| # | Requirement | Test |
|---|---|---|
| 1 | Price server-side | `POST /orders` with an extra `amount` field is rejected or ignored; order uses the DB price |
| 2 | Webhook signature verified | Fake payload with a bad signature gets 4xx and no DB change |
| 3 | Webhook idempotent | Replay a valid event: no duplicate payment, payout, or email |
| 4 | Money tables not client-writable | No endpoint can create/update `orders` status, `payments`, or `payouts` except order creation and admin actions; direct attempts return 403/404/405 |
| 5 | No self-promotion | `PATCH /me` with `role` or `seller_status` is rejected (400); the user's role is unchanged |
| 6 | Seller contact hidden | Visitor and buyer without a paid order never see `seller_private` fields in any response |
| 7 | Contact revealed only after payment | After a paid order the buyer sees that seller's contact; a different buyer still cannot |
| 8 | Cross-user isolation | User A requesting user B's order/listing by ID gets 404 |
| 9 | Seller cannot self-activate | Seller sending `status: active` or `sold` is rejected |
| 10 | Buyer cannot buy own listing | `POST /orders` for own listing returns an error |
| 11 | Double sale handled | Two buyers pay for the same listing: listing sold once, second order flagged `needs_refund`, only one payout |
| 12 | Reviews gated | Review on an unfulfilled order, someone else's order, or a second review on one order is rejected |
| 13 | Unverified email blocked | Unverified account cannot create orders, seller applications, or reviews (403) |
| 14 | Admin routes protected | Non-admin calling any `/admin/*` route gets 403 and no data |
| 15 | Auth abuse throttled | 20+ rapid failed logins or reset requests get 429 |
| 16 | No account enumeration | Signup, login, forgot-password responses identical for existing vs non-existing emails |
| 17 | Upload restrictions | A `.js` renamed `.jpg`, an image over 2 MB, or a 4th image is rejected |
| 18 | Input validation server-side | Negative price, bad phone, rating 9, 5,000-char comment sent directly to the API are rejected |
| 19 | No raw SQL / XSS sinks | Grep: no string-built SQL; no `dangerouslySetInnerHTML` on user content |
| 20 | Secrets not exposed | Built frontend JS contains no Razorpay secret or JWT secret; `.env` not in git |
| 21 | Email-domain rule | With `ALLOWED_EMAIL_DOMAINS` set, a signup from another domain is rejected server-side |
| 22 | Checkout return page | `/checkout/return?status=success` without paying does not show the order as paid |
| 23 | Token handling | Reused refresh token is rejected; password reset revokes existing sessions; reset/verify tokens are single use and expire |
| 24 | Mock mode safety | Server refuses to start with `PAYMENT_MODE=mock` in production; `/dev/simulate-payment` returns 404 otherwise |

Any failing row is a launch blocker.

---

## 10. Production Readiness (campus scale)

- **Error handling:** consistent JSON errors (`{"error": "..."}`), no stack traces to clients; frontend shows clear messages for payment/network/upload/validation failures; loading and empty states everywhere.
- **Monitoring:** structured logs plus an alert (email) on 5xx errors and webhook failures; a silently failing webhook is the worst failure mode. Provide `GET /health` (checks DB connection).
- **Backups:** enable managed Postgres backups; weekly manual export of `orders`, `payments`, `payouts`.
- **Migrations & environments:** all schema in Alembic migrations; separate dev (Razorpay test mode / mock) and prod databases; never test with live keys.
- **Seed data:** migration seeds categories and `app_config`; an optional `seed_demo` script creates an admin, two sellers, sample listings and orders for demos.
- **Privacy Policy + Terms of Service:** simple honest one-pagers (what is collected: name, email, phone, order data; who sees it; contact for deletion requests; commission and manual-payout/refund handling). Razorpay onboarding typically expects these links.
- **Accessibility:** semantic HTML, alt text on images, labelled form fields, keyboard-usable checkout.
- **Mobile-first responsive design** (campus users are on phones).
- **Docs:** README with a 5-minute local setup; the auto-generated `/docs` page doubles as API documentation.
- **Not needed yet:** performance tuning, SEO, load testing, SLAs.

---

## 11. Suggested Repository Layout

```
frontend/                  React + Vite + TS (existing; Supabase client replaced by api.ts)
backend/
  app/
    main.py                FastAPI app, CORS, security headers, routers
    config.py              Settings from environment (pydantic-settings)
    db.py                  SQLAlchemy engine/session
    models.py              SQLAlchemy models
    schemas.py             Pydantic request/response models (extra="forbid")
    deps.py                current_user, require_verified/seller/admin
    security.py            hashing, JWT, token helpers
    routers/               auth.py, me.py, catalog.py, orders.py, seller.py, admin.py, webhooks.py
    services/              payments.py (mark_order_paid), razorpay.py, email.py, uploads.py
    scripts/               make_admin.py, seed_demo.py
  alembic/                 migrations
  tests/                   pytest suite mapped to the Section 9 checklist
  requirements.txt
  Dockerfile
docker-compose.yml         postgres + backend
README.md
```

---

## 12. Suggested Build Order for Claude Code

1. **Setup:** repo layout, `docker-compose.yml` (Postgres + API), `.env.example`, config loader, `/health` endpoint.
2. **Schema:** SQLAlchemy models + first Alembic migration (all tables, enums, constraints, views, seeds). Write the pytest fixtures (test DB, test client, helper to create users of each role).
3. **Auth:** signup, verify email, login, refresh rotation, logout, forgot/reset, `/me`, dependencies for roles. Tests for checklist 5, 13, 15, 16, 21, 23.
4. **Seller flow:** apply, admin approval, listing CRUD, image upload, dashboard endpoints. Tests 9, 17, 18.
5. **Buyer browse:** categories, listings, listing detail, seller profile. Tests 6, 8.
6. **Checkout:** `POST /orders`, Razorpay link (+ mock mode), webhook, `mark_order_paid`, order expiry task. Tests 1, 2, 3, 7, 10, 11, 22, 24.
7. **Admin:** applications, listing review, orders, payouts, fulfil/cancel/refund, metrics. Test 14.
8. **Reviews & email:** review flow, transactional emails. Test 12.
9. **Frontend migration:** replace the Supabase client with `api.ts`; add login/signup/verify/reset pages, buyer order history, seller dashboard, admin pages; route guards.
10. **Hardening:** run the full checklist (tests 1–24), fix failures, privacy/terms pages, error/empty states, health/monitoring alert.
11. **Pre-launch:** Razorpay live keys after KYC, one real low-value end-to-end payment, backup check, switch off mock mode.

---

## 13. Success Metrics (fill in before launch, not after)

- Verified signups in first 2 weeks: ______
- Approved sellers with at least one active listing: ______
- Active listings by end of week 1: ______
- Checkouts started: ______, paid orders: ______ (conversion: ______%)
- Repeat buyers after 4 weeks: ______
- Ask both sides: *"Why would/wouldn't you use this over Instagram/WhatsApp?"*

Paid orders are the honest signal of whether the platform beats the free substitutes. Also watch the funnel drop-off at **signup**: if people bounce at login, revisit friction (college-email auto-fill, later Google sign-in) before concluding demand is missing.
