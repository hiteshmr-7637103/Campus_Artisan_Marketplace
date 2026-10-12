# Campus Artisan Marketplace — Build Requirements (v1)

## Context for whoever is implementing this (including Claude Code)

This is a **two-sided marketplace** connecting student artisans (sellers of handmade/artisan products — jewelry, decor, textiles, pottery, etc.) with campus buyers. It launches campus-first, one college, with intent to expand to other colleges later.

**Business model:** commission-on-sale. The platform takes a percentage of each transaction; the rest settles to the artisan.

**Founding stage:** This is an unregistered/individual venture at this point — no LLP, Pvt Ltd, or GST yet. The founders (a student team) plan to formally register the business once it grows past pilot scale. Nothing in this build should assume a registered business entity exists. Payment collection is structured around **Razorpay's Individual/Unregistered Business KYC tier**, which is fully legal in India for this purpose (PAN + government ID + personal savings bank account — no GST/incorporation required).

**The core risk this build must respect:** the biggest competitive threat isn't other marketplaces — it's free substitutes (Instagram DMs, WhatsApp groups, college fest stalls) that artisans and buyers already use at zero cost. The platform only has a reason to exist if it's clearly better than those. Concretely, that means:
- Friction for both sellers and buyers must be low (minimal signup, simple listing flow)
- **Payment must happen ON the platform, not off it.** If checkout defers to "DM the seller to arrange UPI," the platform captures discovery but not the transaction — no commission, no real signal that anyone will pay through it, and no actual moat over Instagram. This is why real payment integration (not COD, not a static QR code) is a first-tier requirement, not a "V1 later" item, despite being the most common thing MVPs defer.
- Everything else non-essential to proving that loop (seller dashboards, search/filters, reviews, notifications, multi-shop tooling, etc.) should be deferred past this build.

**Scale target for this build:** a single campus, realistically dozens of listings and low hundreds of users at most. Do not over-engineer for scale — optimize for speed of shipping and clarity of the core loop instead.

---

## 1. User Roles

| Role | Capabilities |
|---|---|
| **Buyer** | Browse listings, view product detail, checkout via Razorpay, view own order status |
| **Seller (artisan)** | Submit listing via a simple form (self-service, no dashboard needed yet) |
| **Admin (founders)** | Approve/reject listings, view all orders, manually settle payouts to artisans, mark orders fulfilled |

Keep seller self-service minimal — a submission form is enough. Full seller dashboards (edit/delete own listings, sales stats) are a post-pilot addition once there are enough sellers that admin-managed listings become a bottleneck.

---

## 2. Listings

- Fields: product name, category (jewelry / decor / textiles / pottery / other), price (INR), description, 1–3 photos, artisan name, artisan contact (phone/email/Instagram handle)
- Submission: a coded "Add Listing" form, not a Google Form — this needs to write into the same database the storefront reads from
- Display: grid view, newest-first. No search bar needed at this scale (dozens of items) — a category filter is sufficient
- Status: Active / Sold — admin toggles manually after a sale, or automatically once an order is marked paid (see Orders section)

**Not in this build:** stock/quantity tracking, variants (size/color), image galleries beyond 3 photos, seller-facing edit access. Add these once listing volume makes manual admin management painful.

---

## 3. Discovery / Browsing

- Single grid/feed, newest-first
- Category filter (simple dropdown or tabs) — enough for dozens of listings
- Product detail page: photos, description, price, artisan info, "Buy Now" button

**Not in this build:** full-text search, personalization/recommendations, wishlists, "trending" sections. None of these matter at campus-pilot listing volumes.

---

## 4. Orders & Payment — the core loop

This is the most important module in the build. It's where the platform either proves it can beat free substitutes or doesn't.

**Flow:**
1. Buyer clicks "Buy Now" on a product → sees order summary (item, price, platform's commission is invisible to buyer, baked into price or added transparently — decide once, be consistent) → enters name, phone, delivery/pickup preference
2. Buyer is taken to **Razorpay Checkout** (Payment Button or Payment Links / Orders API — see Technical Notes below) to pay the full listing price
3. On successful payment, Razorpay confirms via webhook/redirect → order status becomes "Paid" → listing auto-marks as "Sold" (or admin does this manually if webhook handling is deferred)
4. Admin sees the new paid order in an admin order list, with buyer contact + artisan contact
5. Admin manually transfers the artisan's share (price minus commission) to the artisan via UPI/bank transfer — **this payout step is manual for this build.** Automated split-payouts (Razorpay Route) require business-tier KYC per seller and are explicitly out of scope until the business is registered.
6. Order status: Placed → Paid → Fulfilled (admin marks Fulfilled once the artisan hands off / delivers the item)

**No COD, no external QR code, no "DM to arrange payment."** Every completed sale must go through Razorpay checkout — this is the one thing this build should not compromise on, since it's the whole point of testing this over Instagram/WhatsApp.

---

## 5. Payment Integration — Technical Notes for Implementation

**Account setup (founders do this before Claude Code needs live keys):**
- Sign up at razorpay.com under **Individual / Unregistered Business** KYC category
- Required: PAN card, government photo ID (Aadhaar/Voter ID/Passport), personal savings bank account details, of whichever founder's identity the account is registered under
- No GST, no certificate of incorporation, no business current account needed at this tier
- Note for the founders (not a build task): money collected legally lands as that individual's personal income for tax purposes until the business is formally registered — worth tracking separately from day one so it's not a mess later

**Integration approach (pick the lighter option first):**
- **Simplest:** Razorpay **Payment Links API** — generate a unique payment link per order server-side, redirect buyer to it, Razorpay hosts the checkout page entirely. Minimal frontend work, webhook gives you payment confirmation.
- **Slightly richer UX:** Razorpay **Checkout (Orders API + Checkout.js)** — an embedded/popup checkout on your own site rather than a redirect. More integration work, more polished feel.
- Use test mode keys during development; switch to live keys only once KYC is approved.
- Handle the `payment.captured` webhook (or equivalent) to reliably mark orders as paid — don't rely solely on client-side redirect success, since that can be spoofed or interrupted.

**Explicitly out of scope for this build:**
- Razorpay Route / linked accounts / auto-split payouts (needs per-seller business KYC)
- Recurring payments/subscriptions
- International payment methods
- Refund automation (handle refunds manually via Razorpay dashboard if needed at this scale)

---

## 5a. Trust & Safety (minimum viable)

Two additions, kept deliberately small — enough to protect the core loop without building a full trust/safety system.

**1. Post-transaction reviews**
- After an order is marked "Fulfilled," the buyer gets a simple prompt: 1–5 star rating + optional short text comment on the artisan
- Reviews are tied to a verified completed order only — no review without a real transaction behind it
- Display: average star rating on the artisan's listings (e.g., under their name on the product card/detail page)
- Keep it one-directional (buyer → artisan) for now — no seller-rates-buyer, no blind-reveal mechanics, no reviewer-reputation weighting. Those are post-PMF refinements.

**2. Contact info masking until payment clears**
- The buyer must never see the artisan's phone/email/Instagram handle on the product listing or at any point before checkout
- Artisan contact details are visible only to admin (via the order record), and are shared with the buyer *after* payment is confirmed (e.g., on the order confirmation screen, or forwarded manually by admin)
- This is a data-exposure rule, not a UI feature — make sure the listing/product API response never includes artisan contact fields to the buyer-facing frontend, only to admin views. This is the one place "helpful" scope creep (e.g., adding a seller contact button on the product page) would quietly break the core value proposition, so it's worth flagging explicitly to whoever builds this.

---

## 6. Messaging / Communication

- No in-app chat needed. Buyer and artisan contact details are exchanged via the order record (visible to admin, forwarded manually if needed)
- Order confirmation to buyer: a simple confirmation screen/email after payment is enough; no need for a notification system

---

## 7. Admin Panel

A minimal internal-only view (can be auth-gated with a single shared admin password at this scale — no need for role-based auth system yet):
- Pending listings queue → approve/reject
- All orders list: buyer info, artisan info, item, amount, status (Placed/Paid/Fulfilled)
- Manual "mark as Fulfilled" action
- This data doubles as your validation dataset: listings submitted, orders placed, orders paid (conversion), repeat sellers/buyers — the numbers that tell you whether the platform is actually beating the free substitutes

---

## 8. Non-Functional Requirements

- Mobile-responsive — non-negotiable, campus users are mobile-first
- Fast load at small scale — no premature performance engineering needed
- Buyers do not need accounts/login to purchase — every added step before checkout is friction that pushes people back to DM+UPI. Capture name/phone/email at checkout only.
- Sellers submit via an unauthenticated or lightly-gated form (e.g., a shared code given only to onboarded artisans) rather than a full account system
- Payment data itself is handled by Razorpay (PCI compliance is on them) — the app should never store card details; only store Razorpay order/payment IDs and status

---

## 9. Suggested Tech Stack

Given: solo founder-developer, free-tier infrastructure, building with Claude Code.

- **Frontend:** React (or plain HTML/CSS/JS if simpler) — storefront grid, product detail, listing submission form, admin panel
- **Backend/DB:** Supabase or Firebase free tier — handles listings, orders, and admin data without standing up custom server infrastructure. Supabase is slightly better suited if webhook handling (a small server function) is needed for Razorpay payment confirmation
- **Payments:** Razorpay (Payment Links API to start)
- **Hosting:** Vercel/Netlify free tier for frontend; Supabase/Firebase functions for any backend logic (e.g., the Razorpay webhook handler)

---

## 9a. System Design

The tech stack (section 9) is *what tools*; this section is *how they fit together* — the piece Claude Code actually needs to build consistently.

**Architecture** — three components, no custom backend server:
- **React frontend** — storefront, listing submission form, admin panel. Talks directly to Supabase for reads/writes (via Supabase client SDK) and redirects to Razorpay for checkout.
- **Supabase** — single source of truth: Postgres DB (listings, orders, reviews), auth (admin login), storage (product photos), and one edge function.
- **Razorpay** — hosted checkout page (Payment Links). Not embedded in your app; buyer is redirected there and back.
- **Supabase edge function** — the one piece of "backend logic" in this build. Receives Razorpay's webhook on successful payment and updates the order's status to Paid server-side. This must not be done client-side only — a client-side "payment succeeded" redirect can be spoofed or interrupted, so the webhook is the source of truth for whether an order is actually paid.

**Data model** (minimum tables):

| Table | Key fields | Notes |
|---|---|---|
| `listings` | id, artisan_name, artisan_contact, category, title, description, price, photo_urls, status (active/sold), created_at | `artisan_contact` must never be selected in buyer-facing queries — enforce via a Postgres view or RLS policy, not just frontend filtering |
| `orders` | id, listing_id (FK), buyer_name, buyer_phone, buyer_email, amount, status (placed/paid/fulfilled), razorpay_payment_id, created_at | status transitions: placed → paid (via webhook) → fulfilled (admin action) |
| `reviews` | id, order_id (FK, unique), listing_id (FK), rating (1–5), comment, created_at | one review per order; only insertable when the linked order.status = fulfilled |
| `admin_users` | via Supabase auth | single or few admin accounts, no public signup |

**Core sequence — buyer purchase flow:**
1. Buyer browses listings (buyer-facing view — excludes artisan_contact) → clicks a listing → "Buy Now"
2. Frontend creates an `orders` row (status: placed) with buyer details
3. Frontend calls Razorpay to generate a payment link for that order amount, redirects buyer to Razorpay's hosted checkout
4. Buyer pays on Razorpay's page
5. Razorpay fires a webhook to the Supabase edge function → function verifies the payment signature → updates that `orders` row to status: paid, and the linked `listings` row to status: sold
6. Buyer is redirected back to a confirmation page; admin sees the paid order (with artisan_contact now visible, since payment is confirmed) in the admin panel
7. Admin manually pays the artisan their share, then marks the order status: fulfilled
8. Buyer gets a review prompt for that order

**Access control (who can see/do what):**
- Buyer-facing frontend: read-only on `listings` (excluding artisan_contact), can insert into `orders` and `reviews` (reviews gated by order.status = fulfilled, enforce this in a DB check/policy, not just UI)
- Admin: full read/write on `listings`, `orders`; can update order status
- Only the edge function (using a service role key, never exposed to the frontend) can set order status to paid — this must not be a client-writable field

---

## 9b. Security — protecting user money and data

Not a compliance checklist — these are the specific things that, if skipped, put a real buyer's money or a real artisan's payout at risk. Each one maps to an actual way someone could get hurt or lose money if it's missing.

- **Price comes from the database, never the browser.** When generating the Razorpay payment link, pull the amount from the `listings.price` row server-side. Never trust a price value sent from the frontend — otherwise anyone could tamper with the request and pay less than the listed price.
- **Card/UPI details never touch your app.** Razorpay's hosted checkout handles payment entry directly — your frontend and database never see or store raw card numbers or UPI PINs. This is the single biggest protection for buyers.
- **Webhook signature check before trusting a "payment succeeded" event.** Razorpay signs each webhook with a secret; the edge function verifies that signature before marking an order paid. Without this, anyone who finds the webhook URL could fake a "paid" event and get an order for free — directly costing the artisan their item with no payment received.
- **`order.status = paid` is only ever set by the server-side function**, never writable from the frontend. If a buyer could set this themselves (e.g. via browser devtools), they could mark their own order paid without paying.
- **Secrets never ship to the browser.** Razorpay's secret key and Supabase's service role key live only in server-side environment variables. Only the public Razorpay key goes to the frontend. Leaking either secret would let someone impersonate your app or write directly to the database.
- **Webhook idempotency.** Razorpay can retry the same webhook; check if the order is already marked paid before processing, so a duplicate event can't cause duplicate side effects.
- **Artisan contact stays hidden until payment clears** (already specified in 5a) — this is also a privacy protection for artisans, not just a leakage-prevention measure: their phone number isn't exposed to anyone browsing, only to a buyer who has actually paid.
- **Admin panel behind a real login**, not just an unlisted URL — protects both buyer and artisan data (names, phone numbers, order history) from being viewable by anyone who guesses or finds the admin link.
- **HTTPS by default** — Vercel/Netlify and Supabase both serve over HTTPS out of the box; nothing to configure, just don't add an HTTP fallback.

**Application-layer attacks — the classic web vulnerabilities:**

- **SQL injection:** Not hand-written SQL — use the Supabase client library (or its query builder) for all reads/writes. It parameterizes queries automatically. The only place raw SQL risk creeps in is if the edge function ever builds a query string by concatenating user input — never do this; always use parameterized queries/prepared statements even in the edge function.
- **XSS (cross-site scripting):** React escapes rendered text by default, which covers most of this automatically. The two danger spots: (1) never use `dangerouslySetInnerHTML` on anything derived from user input (listing descriptions, review comments), and (2) sanitize/validate text fields on submission (strip script tags, limit length) even though React's escaping is the main defense — defense in depth.
- **Brute force (login/checkout abuse):** Rate-limit the admin login (Supabase auth has basic protections, but add a lockout after repeated failed attempts if not already present). For the buyer-facing flow, rate-limit listing submissions and order creation per IP/session so someone can't spam fake orders or flood the DB.
- **File upload validation:** Product photo uploads must validate file type (only image formats) and size server-side, not just via the frontend's `accept=` attribute — a malicious file renamed with a `.jpg` extension is still a risk if only the extension is checked. Supabase Storage policies can restrict this.
- **Input validation everywhere a human types something:** price must be a positive number, phone must match a phone pattern, email must be valid format — validate both client-side (UX) and server-side/DB-constraint-side (actual enforcement), since client-side checks can always be bypassed.
- **CSRF isn't a major concern here** since this isn't a traditional cookie-session server app — Supabase auth uses tokens, and Razorpay's redirect flow doesn't rely on ambient cookie trust. Worth a sanity check once auth is implemented, not a build-blocker now.

### Security implementation checklist (verify each one, don't assume)

Each item has a concrete test — implementation isn't "done" until the test passes, not just until the code looks right.

| # | Requirement | How to verify it's actually implemented |
|---|---|---|
| 1 | Payment amount is read from `listings.price` server-side | Try to send a modified/lower amount from the browser's network tab during checkout creation — it must be ignored/rejected |
| 2 | Webhook signature is verified | Send a fake POST to the webhook URL with an invalid signature — it must be rejected, not processed |
| 3 | `orders.status` is not client-writable | Attempt to update `orders.status` directly via the Supabase client from browser devtools — it must fail (RLS policy blocks it) |
| 4 | `artisan_contact` hidden from buyer queries | Query `listings` as an unauthenticated/buyer role — the response must not include `artisan_contact` at all (not just hidden in UI) |
| 5 | Reviews only insertable on fulfilled orders | Try inserting a review row for an order with status ≠ fulfilled — it must be rejected by a DB constraint/policy, not just blocked in the UI |
| 6 | No raw/concatenated SQL anywhere, including the edge function | Grep the codebase for raw SQL string building; all DB access should go through the Supabase client/query builder |
| 7 | No `dangerouslySetInnerHTML` on user-generated text | Grep the codebase for `dangerouslySetInnerHTML` — should return zero results, or only for content Claude Code itself authored, never listing descriptions/reviews |
| 8 | Admin login has failed-attempt protection | Attempt 10+ rapid wrong-password logins — should get throttled/locked, not silently keep allowing attempts |
| 9 | File uploads validated server-side (type + size) | Try uploading a renamed non-image file (e.g. `.js` renamed to `.jpg`) — must be rejected by Storage policy, not just the frontend `accept` attribute |
| 10 | All numeric/format inputs validated server-side | Try submitting a negative price or malformed phone number directly via API/devtools, bypassing the form — must be rejected, not just blocked by frontend JS |
| 11 | Secrets not present in frontend bundle | Search the built frontend JS bundle for the Razorpay secret key or Supabase service role key — must not appear anywhere in client-shipped code |
| 12 | Webhook is idempotent | Send the same webhook payload twice — the second one must not duplicate any side effect (e.g. double-marking, double-notifying) |

If any row fails its test, that's a real gap to fix before this goes live with real payments — not a nice-to-have.

---

## 9c. Production Readiness — beyond security

Security is one pillar; these are the other things that separate "it works on my machine" from "it works reliably for real users," sized to campus-pilot scale rather than enterprise scale.

- **Error handling for real failure cases:** Razorpay/network down during checkout, a photo upload failing, a form submitted with a missing required field. Each should show the user a clear message and not silently break or show a blank screen.
- **Basic monitoring:** Supabase's built-in logs are enough to start — but set up at least one alert (even a simple email/webhook) for edge function failures, since a silently-failing payment webhook is the one failure mode you can't afford to miss.
- **Backups:** Confirm Supabase's free-tier backup/retention policy covers your `orders` table specifically — this is the one table you cannot afford to lose data from. This is a settings check, not a build task.
- **Light rate-limiting / abuse prevention:** Basic per-IP or per-session limits on form submissions (listing creation, order creation) to prevent spam or accidental double-submission. Full bot-detection tooling can wait.
- **Privacy Policy + Terms of Service:** A simple one-page version covering what data you collect (name, phone, email, payment status) and how it's used. This isn't optional even for a pilot — you're collecting real personal and payment-adjacent data, and Razorpay's own KYC/checkout setup typically expects a policy link. Doesn't need a lawyer at this stage, just an honest, clear page.
- **Basic accessibility:** Semantic HTML, alt text on product photos, labeled form fields — cheap to do from the start, expensive to retrofit later. No need for a full audit at this scale.
- **Explicitly not needed yet:** performance/load optimization, SEO, automated test suites, uptime SLAs — all genuinely irrelevant at campus-pilot scale and worth deferring so they don't eat build time better spent on the core loop.

---

## 10. What Success Looks Like (fill in before launch, not after)

- Minimum # of artisans who list something in week 1: ______
- Minimum # of buyer checkouts started in 2 weeks: ______
- Minimum # of **completed, paid** orders in 2 weeks: ______
- Conversion rate from "checkout started" → "paid" (tells you if Razorpay friction itself is a drop-off point)
- Ask both sides directly: *"Why would/wouldn't you use this over Instagram/WhatsApp?"*

Since payment is now on-platform from day one, the paid-order count is a direct, honest measure of whether this beats the free substitutes — there's no manual-payment ambiguity clouding the signal anymore.
