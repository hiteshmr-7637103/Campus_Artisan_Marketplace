# Campus Artisan Marketplace

A campus-first, two-sided marketplace connecting student artisans with campus buyers.
Payment happens **on the platform** via Razorpay — the platform takes a 10% commission,
the rest is settled to the artisan manually by the founders.

See [`artisan-marketplace-requirements.md`](./artisan-marketplace-requirements.md) for the
full product spec and [`SETUP.md`](./SETUP.md) for how to configure the external accounts
and run it.

## The core loop

```
browse → Buy Now → checkout (name/phone/email, no signup) → Razorpay hosted checkout
  → webhook marks order Paid + listing Sold + emails buyer (with artisan contact)
  → admin settles the artisan manually, marks order Fulfilled
  → buyer gets a review prompt → 1–5★ rating shows on the artisan's listings
```

## Architecture

| Component | Role |
|---|---|
| **`frontend/`** — React + Vite + TS + Tailwind | Storefront, product detail, checkout, order/review pages, `/sell` form, `/admin` panel. Deploys to Vercel. Talks to Supabase directly for reads/auth; calls edge functions for privileged writes. |
| **Supabase** | Postgres (single source of truth), Auth (admin + optional buyer magic-link), Storage (product photos), Edge Functions. |
| **Supabase Edge Functions** | `create-listing`, `create-order`, `razorpay-webhook`, `notify-fulfilled`. The only code that holds secrets or writes privileged fields. |
| **Razorpay** | Hosted checkout via the Payment Links API. Buyer is redirected there and back. The `razorpay-webhook` function is the source of truth for whether an order is paid. |
| **Resend** | Transactional email (order confirmation, review prompt), called from edge functions. |

## Repo layout

```
frontend/                 Vite React app
supabase/
  migrations/              SQL schema, RLS policies, views, RPCs, storage policies
  functions/
    _shared/               cors, razorpay, resend, ratelimit, validation helpers
    create-listing/        shared-code gate + validation + insert (status: pending)
    create-order/          reads price server-side, creates order + Razorpay link
    razorpay-webhook/       signature verify + idempotent Paid transition + email
    notify-fulfilled/       admin-triggered review-prompt email
SETUP.md                  external account + env + deploy guide
```

## Quick start (local)

```bash
# 1. frontend deps
cd frontend && npm install && cd ..

# 2. supabase local stack (requires the Supabase CLI + Docker)
npx supabase start
npx supabase db reset          # applies everything in supabase/migrations
npx supabase functions serve   # serves edge functions locally

# 3. env — copy and fill
cp frontend/.env.example frontend/.env
cp supabase/functions/.env.example supabase/functions/.env

# 4. run the frontend
cd frontend && npm run dev
```

Full details, including what to put in each env var and how to verify the security
checklist, are in [`SETUP.md`](./SETUP.md).

## What is intentionally NOT built (per the requirements)

Stock/quantity tracking, product variants, seller dashboards, full-text search,
recommendations, wishlists, in-app chat, a notification system, Razorpay Route auto-split
payouts, refund automation, subscriptions, international payments, SEO, load optimization,
automated test suites. The campus-map delivery-point picker is planned for later — the
`orders` schema already has nullable `delivery_lat`/`delivery_lng` for it.
