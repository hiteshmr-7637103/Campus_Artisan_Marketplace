# Current Status

Implementation status of the v2 plan ([`artisan-marketplace-requirements.md`](./artisan-marketplace-requirements.md)):
FastAPI + PostgreSQL backend, React frontend on top of it, Supabase removed.

**Nothing is committed yet.** All changes are in the working tree.

## Verification so far

| Check | Result |
|---|---|
| Backend tests (`pytest`) | 31 passed |
| Frontend type-check and production build | Pass |
| API in Docker (`/health`, `/docs`, listings, login, demo seed) | Called with curl; works |
| Frontend pages clicked through in a browser | **Not done** |
| Razorpay (payment links, webhook signature) against live Razorpay | **Not tested** (needs your account keys) |

## Backend (`backend/`)

- **Auth:** signup, email verification, login, rotating refresh cookie, logout, password reset, `/me`.
  - Signup, login and forgot-password respond the same whether or not the email exists.
  - `ALLOWED_EMAIL_DOMAINS` is enforced on the server.
- **Marketplace:** the seller, admin and buyer endpoints from the plan.
  - Money is stored as integer paise.
  - `mark_order_paid` is the only code path that can set an order to paid.
  - Seller phone, Instagram and UPI are only returned to the owner, an admin, or a buyer with a paid order.
- **Payments:**
  - In mock mode, checkout goes to a local fake payment page.
  - The server refuses to start with mock mode in production.
  - A background task cancels orders left unpaid for 30 minutes.
- **Database:** one Alembic migration creates all tables, the two public views (`public_listings`, `seller_ratings`) and the seed data (categories, commission rate). It was generated from the models, then edited by hand.
- **Scripts:** `make_admin` (the only way to create an admin) and `seed_demo`.
- **Run:** `docker compose up -d --build` starts Postgres and the API.
- **Tests:** pytest covers all 24 items of the security checklist from the plan. Setup steps are in [`README.md`](./README.md).

## Frontend (`frontend/`)

The Supabase client is replaced by `lib/api.ts` (fetch wrapper) and `lib/auth.tsx` (auth state and route guards).

Pages:
- **Public:** browse with search and category filter, listing detail, seller profile.
- **Account:** login, signup, verify email, forgot and reset password, account.
- **Buyer:** checkout, checkout return page, mock payment page, orders list, order detail with review form.
- **Seller:** apply, dashboard, listing create/edit with photo upload.
- **Admin:** five tabs (metrics, seller applications, listing review, orders, payouts).

Route guards are UX only; the API enforces access.

## Supabase removal

Deleted:
- the `supabase/` folder (migrations, edge functions, config)
- the Supabase client and its npm package
- its env vars and references in the docs

Nothing else in the repo needed it.

## Changes beyond the plan

- A payment that arrives for an already-expired order is recorded as paid and flagged for refund, instead of being dropped.
- If a buyer starts checkout on an item they already have a pending order for, they get that order back instead of a duplicate.
- Orders flagged for refund never reveal the seller's contact details.

## Not built

- Google sign-in (post-V1 in the plan).
- Admin two-factor login (optional in the plan).

## Before launch

1. Sign up for Razorpay as an Individual/Unregistered Business and get the keys.
2. Set `PAYMENT_MODE=razorpay` and `ENVIRONMENT=production`, and add the webhook (steps in [`SETUP.md`](./SETUP.md)).
3. Make one real low-value payment end to end.
4. Click through the frontend in a browser.
5. Run `pip-audit` and `npm audit`, and turn on managed Postgres backups.
