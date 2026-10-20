# Campus Artisan Marketplace: Status and Roadmap

_Last updated: 2026-10-20_

A campus-first marketplace where student artisans sell handmade goods and campus buyers pay on the platform. The platform keeps a commission and pays sellers out.

**Stack:** FastAPI (Python) · PostgreSQL · SQLAlchemy + Alembic · own JWT auth · React + Vite (JavaScript) + Tailwind ("CampCraft" design) · Docker · Razorpay Payment Links

---

## 1. Current status (built and working)

| Area | Status |
|---|---|
| Auth: signup, email verification, login, rotating refresh cookie, logout, password reset | Done |
| Email-domain restriction (`ALLOWED_EMAIL_DOMAINS`), enforced server-side | Done |
| Marketplace: listings, categories, search, seller profiles, orders, reviews | Done |
| Money stored as integer paise; commission rate in the database | Done |
| `mark_order_paid`: the only code path that can set an order to paid | Done |
| Payment modes: `mock` (local) and `razorpay`; server refuses mock mode in production | Done |
| 30-minute auto-cancel of unpaid orders | Done |
| Late payment on an expired order is recorded and flagged for refund | Done |
| Seller contact details shown only to the owner, an admin, or a buyer with a paid order | Done |
| Seller onboarding: apply, admin approval, dashboard, listing create/edit with photo upload | Done |
| Admin panel (5 tabs): metrics, seller applications, listing review, orders, payouts | Done, **manual** |
| Alembic migration, `make_admin` and `seed_demo` scripts | Done |
| Tests: 31 backend tests passing (cover the 24-item security checklist), frontend build passes | Done |
| Click-through in headless Chrome (browse, checkout, review, seller flow, admin flow, mobile) | Passed |
| Live Razorpay (payment links, webhook signature) | **Not tested** (friend is handling) |

---

## 2. Decisions made

- **Per-order payouts.** Each order is paid out on its own, not in bulk, so sellers can rely on the platform. A **weekly statement** is sent on top of that as a summary.
- **Payout page becomes a ledger.** No per-order approval clicks. The admin only handles exceptions. Confirmation is automatic through a payout provider, so "paid" always means money really moved.
- **Auto-pay rule.** If the payout equals the server-computed amount and passes all checks, it is paid automatically. Anything else is flagged for manual release with 2FA. Amounts are never supplied by a request, only computed by the server.
- **Listing auto-flagging, seller ranking and tiers:** deferred to future scope.
- **Razorpay go-live and UI improvements:** owned by a teammate, outside this list.
- **Repo rule:** changes are delivered as files for review. Nothing is pushed to GitHub without a go-ahead.

---

## 3. Up next (our work, in order)

### 3.1 Automated payouts, payout ledger and weekly statements
**Goal:** the admin handles exceptions only. No per-order clicking. The payout page becomes a ledger (a record of what was paid and what is owed) instead of a button page.

**Decision: automatic transfer through a payout provider** (RazorpayX payouts to UPI, or Razorpay Route). The provider's webhook confirms success or failure, so "paid" always means money really moved. A payout that equals the server-computed amount and passes every check is sent automatically. Anything else is flagged for manual release with 2FA (see "Payout security" below).

**Interim until the provider account and KYC are ready** (your friend's Razorpay work): run in `manual` mode. Payouts are still created and queued automatically, and a person sends the UPI payment and records the reference (UTR), so nothing is ever shown as paid without a real reference.

**Payout provider setting:** `manual` now, `razorpayx` later, the same way `PAYMENT_MODE` works today. The ledger, states, statements and views do not change when the provider is switched on.

**Payout states (per order):** `pending` (order not yet payable) → `eligible` (hold window over) → `processing` → `paid`, with `failed`, `on_hold` and `reversed` as side paths.

**Automatic rules**
- [ ] When an order is paid and fulfilled, create its payout row: gross, commission, net, seller, status `pending`. Idempotent: one payout per order.
- [ ] **Hold window:** the payout becomes `eligible` automatically a set time after fulfilment (for example 24 to 48 hours) if the buyer has raised no issue. This is the automatic "confirmation", and it is safe because it gates *when*, not *whether money truly moved*.
- [ ] Orders flagged for refund, or with an open issue, stay `on_hold` and never become eligible.
- [ ] **Exception rules** that pull a payout back to the admin: amount above a threshold, seller's UPI ID changed in the last N days, seller newly approved, repeated failures.
- [ ] Failed payout: record the reason, notify the seller (for example "UPI ID invalid"), retry with a cap.

**Ledger (the new Payouts page)**
- [ ] Append-only: rows are never edited. A correction is a new entry (reversal or adjustment). If a refund happens after payout, a negative adjustment is netted against that seller's next payout.
- [ ] Views by **day, week, month and year**, with a date-range picker.
- [ ] Filter by **seller**, status and payout method; search by order ID or UTR.
- [ ] Totals for the selected view: orders, gross, commission, net paid, pending, on hold.
- [ ] Per-seller page: lifetime and period earnings, paid vs pending, order count, average order value, last payout date, UPI ID history.
- [ ] **Cumulative payout per seller** (running total, lifetime and rolling 8 weeks). Stored from day one so it is available later for seller ranking (see 5.2).
- [ ] CSV export for accounting.

**Platform money view (admin finance)**
- [ ] Commission earned per period.
- [ ] **Outstanding to sellers** (money collected but not yet paid out). Reconcile: collected − commission − paid out = still owed.
- [ ] Alerts: payout failed, payout stuck over X hours, unusually large payout.

**Seller side**
- [ ] Seller dashboard "Earnings" tab shows their own ledger with the same filters.
- [ ] UPI ID changes need re-verification and a short cooldown before they affect payouts (common fraud route).

**Payout security (design rules)**
- [ ] **No amount is ever accepted from outside.** A payout is created only by the internal job from the order row. There is no API endpoint, admin form or webhook that takes an amount. The amount is computed on the server: `net = order total − commission`.
- [ ] **Exact-match invariant, checked in code and again before sending:** payout equals the computed net; order is paid, fulfilled, past the hold window and not flagged; seller is approved; one payout per order (unique database constraint); total paid for an order never exceeds what was actually collected for it. Any mismatch means the payout is **not sent** and goes to the exception queue.
- [ ] **Hard caps independent of the invariant:** a per-payout maximum, a per-seller daily cap, and a platform-wide daily cap. Hitting the platform cap pauses all automatic payouts and alerts the admin (circuit breaker).
- [ ] **Higher scrutiny for risk:** payouts to new sellers, to a recently changed UPI ID, or above a set amount wait for manual release.
- [ ] **UPI-change protection:** changing the payout UPI ID requires the password plus an emailed confirmation, notifies the old email, and holds that seller's payouts for a cooldown period.
- [ ] **Provider callbacks:** verify the signature on every webhook and ignore repeated event IDs (replay protection). Payout status is set only by a verified callback, never by an admin button.
- [ ] **Admin step-up:** releasing a held payout, changing commission, changing payout settings and promoting an admin all require a fresh 2FA code, even inside a logged-in session. The admin can release or hold a payout but can never edit its amount.
- [ ] **Alerts and audit:** an append-only audit log of every manual action, and an instant notification (email or chat) on every manual release, UPI change and cap hit.
- [ ] **Provider-side limits (last line of defence):** set daily payout limits and restricted API scopes in the payout provider's dashboard, turn on 2FA there, keep keys only in server secrets, and keep only the needed balance in the payout account. Check whether the provider offers its own payout approval roles.
- [ ] **Tests:** a tampered amount is never sent; a duplicate event does not double-pay; cap and circuit breaker trigger; admin action without a fresh 2FA code is refused; UPI change holds payouts.

**Weekly statement**
- [ ] A scheduled job (every Monday) builds one statement per seller for the previous week, as a summary on top of per-order payouts.
- [ ] Rows: order ID, product, sale amount, commission, net payout, payout status, paid date and UTR. Footer: totals, and anything pending or held.
- [ ] Unique statement ID; view and download (PDF or CSV) from the seller dashboard, and emailed to the seller. Admin can view or regenerate any statement.

**Tests:** one payout per order; refund-flagged orders never become eligible; hold window timing; commission arithmetic in paise has no drift; failed payout does not mark an order paid out; statement totals equal the sum of its rows; ledger entries cannot be edited; reversal nets correctly into the next payout.

### 3.2 Google sign-in (OIDC) and admin 2FA
(Assuming "OCID" meant OIDC, i.e. "Sign in with Google". Tell me if you meant something else.)

**Google sign-in**
- [ ] Create a Google Cloud OAuth client (client ID and secret in env).
- [ ] Add the OIDC flow in the backend (`authlib`): redirect, callback, token verification.
- [ ] Enforce `ALLOWED_EMAIL_DOMAINS` on Google accounts too, and require a verified Google email.
- [ ] Link by email: an existing password account and a Google login for the same email resolve to the same user.
- [ ] "Continue with Google" button on the login and signup pages.
- [ ] Tests: wrong domain rejected, unverified email rejected, account linking.

**Admin 2FA**
- [ ] TOTP (authenticator app) for admin accounts, with QR enrolment.
- [ ] Recovery codes, shown once at enrolment.
- [ ] Admin endpoints require a completed second factor.
- [ ] Rate-limit code attempts.
- [ ] Step-up: sensitive actions (see payout security in 3.1) ask for a fresh code even within a live session.
- [ ] Short admin session lifetime, and a notification on every new admin login.
- [ ] Tests: admin without 2FA completed cannot reach admin routes.

### 3.3 Hosting
- [ ] Choose hosts. Suggested starting point: frontend on Vercel (config already in repo), API in a Docker container on a small VPS or a managed container service, managed PostgreSQL with automated backups.
- [ ] Production env: `ENVIRONMENT=production`, strong `JWT` secrets, `CORS` and cookie settings for the real domains.
- [ ] Domain and HTTPS.
- [ ] Persistent storage for listing photos (object storage rather than the container disk).
- [ ] Real email provider (SMTP or a transactional email service) so verification and statement emails actually send.
- [ ] Run migrations on deploy; scheduled jobs (auto-cancel, weekly statements) running exactly once, not once per instance.
- [ ] Error logging and an uptime check on `/health`.
- [ ] Managed Postgres backups on, with one restore tested.
- [ ] Run `pip-audit` and `npm audit` and fix findings.
- [ ] Click through the frontend once against the deployed API.

---

## 4. Handed off to teammate
- Razorpay account, keys, `PAYMENT_MODE=razorpay`, webhook, and one real low-value payment end to end.
- UI improvements.

**Dependency:** hosting needs a public URL before the Razorpay webhook can be registered, so 3.3 and the Razorpay setup need to be coordinated.

---

## 5. Future scope

### 5.1 Trust and admin workload
- **Listing auto-flagging.** A rules layer that sends suspicious listings to a "needs review" queue. It flags and never auto-rejects. Rules: missing or too few photos, price far outside the category range, banned keywords, duplicate title or image across sellers, first listing from a brand-new seller. Clean listings from trusted sellers can be fast-tracked.
- **Seller application pre-screening.** Flag incomplete applications and rank by completeness so the admin reviews high-risk ones first.
- **Admin audit log.** Who approved, rejected or paid what, and when.

### 5.2 Seller retention: ranking, tiers and perks
- **Seller score** computed nightly over a rolling 4 to 8 weeks: weighted average rating, cumulative payout (from the 3.1 ledger; use order count and rolling totals rather than lifetime rupees so high-priced items do not dominate), on-time fulfilment, cancellations, repeat buyers, listing quality (few flags), and response time (needs chat).
- **Tiers and badges** (Rising → Trusted → Star) instead of a strict weekly leaderboard. At campus scale a #1 to #N list reshuffled weekly mostly reflects luck and discourages the bottom sellers.
- **Perks:** higher placement in browse and search, a "Top Campus Seller" badge, homepage features, a lower commission for top tiers, and faster payouts.
- **Guardrails:** minimum order count before ranking, a grace period for new sellers, ignoring orders between linked accounts (self-dealing), and a cap on how much one review can move the score.

### 5.3 Buyer-seller communication
- **In-app chat between buyer and seller.** The original product vision is that customers buy by chatting with the maker. Explicitly out of V1. It would also unlock the response-time metric for seller scores. Needs: message storage, unread counts, notifications, abuse reporting, and keeping contact details gated as they are today.

### 5.4 Payments and money
- **Automated payout transfers** via RazorpayX payouts or Razorpay Route, if not already adopted for 3.1.
- **Tax and compliance review** (GST/TCS/TDS treatment for marketplace commission and seller payouts). Confirm with an accountant before scaling.
- **Refund automation**, so refund-flagged orders resolve without manual work.
- **Dispute workflow** between buyer, seller and admin, with evidence and a decision log.
- **Multi-item cart** and a single combined checkout.
- **Stock and variants** (sizes, colours, quantity limits).

### 5.5 Growth and discovery
- Wishlists and recommendations.
- SEO: server-rendered or pre-rendered listing pages, metadata, sitemap.
- Push notifications and email digests.
- Seller-rates-buyer (reputation in both directions).
- Native mobile apps.
- **Multi-campus tenancy:** campus as a first-class entity, per-campus domains, admins and commission settings.

### 5.6 Platform hardening
- Observability: metrics, tracing, alerting.
- Background-job runner (for example a proper task queue) once scheduled jobs multiply.
- Load testing and database index review once real traffic exists.

---

## 6. Suggested order of work

1. Automated payouts and weekly statements (3.1)
2. Google sign-in and admin 2FA (3.2)
3. Hosting (3.3), in parallel with the teammate's Razorpay and UI work
4. First real orders on campus, then pick from section 5 based on what sellers and buyers actually ask for (most likely chat, then flagging, then seller tiers)
