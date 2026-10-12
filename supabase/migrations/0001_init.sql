-- Campus Artisan Marketplace — core schema
-- All money is stored as integer paise (₹1 = 100). Never floats.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type category as enum ('jewelry', 'decor', 'textiles', 'pottery', 'other');
create type listing_status as enum ('pending', 'active', 'sold', 'rejected');
create type order_status as enum ('placed', 'paid', 'fulfilled', 'cancelled');
create type fulfillment_method as enum ('pickup', 'delivery');

-- ---------------------------------------------------------------------------
-- platform_config — single row, read server-side only (never granted to anon)
-- ---------------------------------------------------------------------------
create table platform_config (
  id              boolean primary key default true,
  commission_rate numeric(4,3) not null default 0.100
                  check (commission_rate >= 0 and commission_rate < 1),
  updated_at      timestamptz not null default now(),
  constraint platform_config_singleton check (id)
);
insert into platform_config (id) values (true);

-- ---------------------------------------------------------------------------
-- admin_users — Supabase Auth users that may use the admin panel.
-- Populated manually (see SETUP.md). No public signup.
-- ---------------------------------------------------------------------------
create table admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- artisans — canonical seller record. Contact columns are admin-only and are
-- never exposed through any buyer-facing view.
-- ---------------------------------------------------------------------------
create table artisans (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  contact_phone  text check (contact_phone is null or contact_phone ~ '^[0-9+\-() ]{6,20}$'),
  contact_email  text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  instagram      text check (instagram is null or char_length(instagram) <= 60),
  created_at     timestamptz not null default now(),
  constraint artisans_have_a_contact
    check (contact_phone is not null or contact_email is not null or instagram is not null)
);

-- ---------------------------------------------------------------------------
-- listings
--   price_artisan  — integer paise the artisan wants to receive.
--   The buyer-facing price is derived (price_artisan + commission) in the
--   listings_public view and in create-order; it is never stored here.
--   submitted_artisan_* hold the raw text from the public /sell form until an
--   admin approves the listing and links / creates the canonical artisan row.
-- ---------------------------------------------------------------------------
create table listings (
  id                       uuid primary key default gen_random_uuid(),
  artisan_id               uuid references artisans (id) on delete set null,
  submitted_artisan_name   text not null check (char_length(submitted_artisan_name) between 1 and 120),
  submitted_artisan_contact text not null check (char_length(submitted_artisan_contact) between 1 and 200),
  category                 category not null,
  title                    text not null check (char_length(title) between 2 and 120),
  description              text not null check (char_length(description) between 1 and 4000),
  price_artisan            integer not null check (price_artisan > 0 and price_artisan <= 100000000),
  photo_urls               text[] not null check (array_length(photo_urls, 1) between 1 and 3),
  status                   listing_status not null default 'pending',
  reject_reason            text check (reject_reason is null or char_length(reject_reason) <= 500),
  created_at               timestamptz not null default now()
);
create index listings_status_created_idx on listings (status, created_at desc);
create index listings_category_idx on listings (category) where status = 'active';
create index listings_artisan_idx on listings (artisan_id);

-- Only one listing may be 'active' or 'sold' per ... (n/a — each listing is one item).
-- Concurrency guard for checkout lives in create-order (conditional update on status).

-- ---------------------------------------------------------------------------
-- orders
--   amount_* are snapshotted at creation so a later commission_rate change
--   never rewrites transaction history.
--   status is only ever moved to 'paid' by the razorpay-webhook function
--   (service role). RLS forbids anon/authenticated from writing status.
-- ---------------------------------------------------------------------------
create table orders (
  id                        uuid primary key default gen_random_uuid(),
  listing_id                uuid not null references listings (id) on delete restrict,
  buyer_user_id             uuid references auth.users (id) on delete set null,
  buyer_name                text not null check (char_length(buyer_name) between 1 and 120),
  buyer_phone               text not null check (buyer_phone ~ '^[0-9+\-() ]{6,20}$'),
  buyer_email               text not null check (buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  fulfillment_method        fulfillment_method not null,
  delivery_point            text check (delivery_point is null or char_length(delivery_point) <= 200),
  delivery_time             text check (delivery_time is null or char_length(delivery_time) <= 120),
  delivery_notes            text check (delivery_notes is null or char_length(delivery_notes) <= 500),
  delivery_lat              double precision,   -- reserved for the future campus-map picker
  delivery_lng              double precision,   -- reserved for the future campus-map picker
  amount_total              integer not null check (amount_total > 0),
  amount_commission         integer not null check (amount_commission >= 0),
  amount_artisan            integer not null check (amount_artisan > 0),
  status                    order_status not null default 'placed',
  razorpay_payment_link_id  text,
  razorpay_payment_id       text,
  access_token              uuid not null default gen_random_uuid(),
  payout_done               boolean not null default false,
  payout_reference          text check (payout_reference is null or char_length(payout_reference) <= 200),
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz,
  fulfilled_at              timestamptz,
  constraint amount_total_is_sum check (amount_total = amount_commission + amount_artisan)
);
create unique index orders_access_token_idx on orders (access_token);
create index orders_status_created_idx on orders (status, created_at desc);
create index orders_listing_idx on orders (listing_id);
create index orders_buyer_user_idx on orders (buyer_user_id) where buyer_user_id is not null;
create index orders_buyer_email_idx on orders (lower(buyer_email));
-- At most one order per listing may reach a live (placed/paid/fulfilled) state.
create unique index orders_one_live_per_listing_idx
  on orders (listing_id)
  where status in ('placed', 'paid', 'fulfilled');

-- ---------------------------------------------------------------------------
-- reviews — one per order, only for fulfilled orders (enforced in submit_review
-- and by the FK + unique constraint here).
-- ---------------------------------------------------------------------------
create table reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references orders (id) on delete cascade,
  listing_id  uuid not null references listings (id) on delete cascade,
  artisan_id  uuid references artisans (id) on delete set null,
  rating      integer not null check (rating between 1 and 5),
  comment     text check (comment is null or char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);
create index reviews_artisan_idx on reviews (artisan_id);
create index reviews_listing_idx on reviews (listing_id);

-- ---------------------------------------------------------------------------
-- webhook_events — idempotency ledger for Razorpay webhook retries
-- ---------------------------------------------------------------------------
create table webhook_events (
  id          text primary key,             -- Razorpay event id (x-razorpay-event-id)
  event_type  text,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ratelimit — light per-IP fixed-window counter for the public edge functions
-- ---------------------------------------------------------------------------
create table ratelimit (
  bucket       text primary key,            -- e.g. 'create-order:203.0.113.4'
  window_start timestamptz not null,
  count        integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Enable RLS on every table (policies added in 0003_rls.sql).
-- Tables with RLS on and no policy => deny all for anon/authenticated,
-- while the service-role key used by edge functions bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table platform_config enable row level security;
alter table admin_users     enable row level security;
alter table artisans        enable row level security;
alter table listings        enable row level security;
alter table orders          enable row level security;
alter table reviews         enable row level security;
alter table webhook_events  enable row level security;
alter table ratelimit       enable row level security;
