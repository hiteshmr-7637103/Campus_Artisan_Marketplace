# Setup & Operations Guide

This covers: creating the three external accounts, wiring the keys, running locally,
deploying, and verifying the security checklist from the requirements doc.

> **State of play:** the code is complete and runs against local Supabase today.
> Real payments and email stay inert until you add Razorpay + Resend keys (Stage B
> below) — nothing else changes when you do.

---

## 0. Prerequisites

- Node 18+ and npm
- Docker (for the local Supabase stack)
- The Supabase CLI — `npm i -g supabase` or use `npx supabase ...`

---

## 1. External accounts

### 1a. Supabase (needed first)

1. Create a project at [supabase.com](https://supabase.com). Note the **Project URL**,
   the **anon** public key, and the **service_role** secret key
   (Project Settings → API).
2. Nothing else to click — the schema, RLS, views, storage bucket and functions are
   all created by the migrations in `supabase/migrations/` and the deploy step below.

### 1b. Razorpay (add when ready — Stage B)

1. Sign up at [razorpay.com](https://razorpay.com) under **Individual / Unregistered
   Business** KYC (PAN + government ID + personal savings account — no GST/incorporation).
2. Stay in **Test mode** until KYC is approved.
3. Settings → API Keys → generate **Key ID** + **Key Secret**.
4. Settings → Webhooks → **Add webhook**:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`
   - Active events: **`payment_link.paid`**
   - Set a **secret** — this is `RAZORPAY_WEBHOOK_SECRET`.

### 1c. Resend (add when ready — Stage B)

1. Sign up at [resend.com](https://resend.com), verify a sending domain.
2. Create an API key → `RESEND_API_KEY`.
3. `RESEND_FROM` = e.g. `"Campus Artisan Marketplace <orders@yourdomain.com>"`.

---

## 2. Environment variables

### Frontend — `frontend/.env` (copy from `.env.example`)

| var | value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL (or `http://127.0.0.1:54321` local) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

**Only these two.** Anything secret would be inlined into the browser bundle.

### Edge functions — `supabase/functions/.env` (copy from `.env.example`)

| var | value |
|---|---|
| `SUPABASE_URL` | Project URL (auto-set in prod; set for local serve) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | from 1b (leave blank in Stage A) |
| `RAZORPAY_WEBHOOK_SECRET` | from 1b (set a local value in Stage A to test the webhook) |
| `RESEND_API_KEY` / `RESEND_FROM` | from 1c (leave blank in Stage A — email is skipped, logged) |
| `ARTISAN_SIGNUP_CODE` | any string; hand it to onboarded artisans |
| `PUBLIC_SITE_URL` | deployed frontend origin (e.g. `https://market.vercel.app`) |

---

## 3. Run locally

```bash
cd frontend && npm install && cd ..

npx supabase start                 # boots Postgres + Auth + Storage in Docker
npx supabase db reset              # applies supabase/migrations/*.sql + seeds
npx supabase functions serve --env-file supabase/functions/.env --no-verify-jwt

cp frontend/.env.example frontend/.env
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<printed by `supabase start`>
cd frontend && npm run dev         # http://localhost:5173
```

### Create an admin user

```bash
# 1. make the auth user
npx supabase auth admin create-user --email you@example.com --password 'choose-a-strong-one'
#    (or sign up once via the app, then:)

# 2. copy its id from Studio (http://localhost:54323 → Authentication) and:
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2)" \
  -c "insert into admin_users (user_id, email) values ('<uuid>', 'you@example.com');"
```

Then sign in at `http://localhost:5173/admin`.

---

## 4. Deploy

### Frontend → Vercel

- Import the repo, set **Root Directory** to `frontend/`.
- Framework preset: **Vite**. Build command `npm run build`, output `dist`.
- Add a rewrite so client-side routes work: create `frontend/vercel.json` is already
  included (all paths → `/index.html`).
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### Backend → Supabase

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push                                   # apply migrations
npx supabase functions deploy                          # deploy all 5 functions
npx supabase secrets set --env-file supabase/functions/.env
```

Set the Supabase **Auth → URL Configuration → Site URL** to your Vercel URL, and add
it to redirect allow-list (for the buyer magic-link).

---

## 5. Monitoring & backups (settings checks, spec §9c)

- **Edge function failure alert:** Supabase Dashboard → Logs → create a log-based
  alert on `razorpay-webhook` where `level = error`. A silently-failing payment
  webhook is the one failure you cannot miss.
- **Backups:** confirm the `orders` table is covered by your plan's backup/retention
  (Dashboard → Database → Backups). This is the table you cannot lose.
- **Webhook health:** Razorpay Dashboard → Webhooks shows delivery success/failure.

---

## 6. Security checklist verification (spec §9b)

Run these after any change that touches payments, RLS, or uploads.

### Stage A — no Razorpay keys yet

| # | Test | Expected |
|---|---|---|
| 3 | In devtools console on the site: `await supabase.from('orders').update({status:'paid'}).eq('id','<any>')` | `[]` / RLS error — no row updated |
| 4 | `await supabase.from('listings').select('*')` as a normal visitor | error / no rows; `listings_public` never returns `artisan_contact` or `price_artisan` |
| 5 | `await supabase.rpc('submit_review',{p_token:'<token of a paid-not-fulfilled order>',p_rating:5,p_comment:'x'})` | error "order is not fulfilled yet" |
| 2 | `curl -XPOST .../functions/v1/razorpay-webhook -d '{}' -H 'x-razorpay-signature: bad'` | `400 invalid signature` |
| 12 | Post a valid signed payload (see below) twice | 1st → `{paid:true}`, 2nd → `{duplicate:true}`; order paid once, one email attempt logged |
| 9 | `/sell` → add a `.js` file renamed `photo.jpg` | rejected: "not a JPEG, PNG or WebP image" (server-side magic-byte check) |
| 10 | `curl -XPOST .../functions/v1/create-listing -d '{"artisan_code":"<code>","price":-5, ...}'` | `422 price must be a positive number` |
| 1 | (Stage B) tamper `amount` in the `create-order` network call | ignored — server recomputes from `listings.price_artisan` |
| 8 | 6+ wrong admin logins | client locks for 60s; Supabase Auth also throttles server-side |
| 11 | `npm run build` in `frontend/`, then `grep -r "service_role\|RAZORPAY_KEY_SECRET" frontend/dist` | no matches |
| 6 | `grep -rn "raw sql\|\` + .* + \`" supabase/functions` for string-built SQL | none — all DB access via the supabase-js client / RPCs |
| 7 | `grep -rn dangerouslySetInnerHTML frontend/src` | none |

**Signing a test webhook payload (Stage A):**

```bash
BODY='{"event":"payment_link.paid","payload":{"payment_link":{"entity":{"reference_id":"<ORDER_ID>"}},"payment":{"entity":{"id":"pay_test123"}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -XPOST "$SUPABASE_URL/functions/v1/razorpay-webhook" \
  -H "content-type: application/json" -H "x-razorpay-signature: $SIG" \
  -H "x-razorpay-event-id: evt_test_1" -d "$BODY"
```

### Stage B — with real Razorpay test keys

1. Full loop: list → approve → Buy Now → pay on Razorpay's test page (use test card
   `4111 1111 1111 1111`, any future expiry/CVV) → redirected to `/order/:token` →
   status flips to Paid within seconds → confirmation email arrives with artisan
   contact → listing shows Sold.
2. Admin → Orders → Mark fulfilled → review-prompt email → open the link → submit a
   rating → it appears on the artisan's cards.
3. Re-run checklist item 1 (amount tampering) against the live `create-order`.

---

## 7. Day-one business notes (not build tasks)

- Money collected lands as the registering founder's **personal income** until the
  business is registered — track it separately from day one.
- Refunds: handle manually in the Razorpay dashboard at this scale.
- Fill in the success metrics in `artisan-marketplace-requirements.md` §10 before launch.
