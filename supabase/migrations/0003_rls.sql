-- Row-level security policies.
--
-- Model:
--   * anon               → no direct table access at all; reads go through the
--                          *_public views, writes go through edge functions.
--   * authenticated buyer → may read ONLY their own orders (after claiming them
--                          via a magic-link login). No write access to any table.
--   * admin (in admin_users) → read/write the operational tables.
--   * edge functions use the service-role key, which bypasses RLS entirely and
--     is the ONLY path that sets orders.status = 'paid'. (checklist #3)
--
-- Tables with RLS enabled and no matching policy deny the operation.

-- ------------------------------------------------------------------ platform_config
create policy platform_config_admin_read on platform_config
  for select to authenticated using (is_admin());
create policy platform_config_admin_update on platform_config
  for update to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ admin_users
create policy admin_users_self_read on admin_users
  for select to authenticated using (is_admin());

-- ------------------------------------------------------------------ artisans
create policy artisans_admin_all on artisans
  for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ listings
create policy listings_admin_all on listings
  for all to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ orders
-- Buyers with an account see their own orders (read-only). No INSERT/UPDATE
-- policy for anon or non-admin authenticated => those operations are denied,
-- so status can never be flipped from the browser. (checklist #3)
create policy orders_buyer_read_own on orders
  for select to authenticated
  using (buyer_user_id = auth.uid());

create policy orders_admin_read on orders
  for select to authenticated using (is_admin());

-- Admin may progress an order (mark fulfilled, record payout). The webhook still
-- owns the placed -> paid transition; this is the manual fallback allowed by the
-- spec (section 4.3) and the fulfilled transition.
create policy orders_admin_update on orders
  for update to authenticated using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ reviews
-- Public read happens via reviews_public. Direct base-table reads are admin-only.
-- There is deliberately NO insert policy: reviews can be created only through the
-- submit_review() security-definer RPC, which enforces order.status = 'fulfilled'
-- and one-review-per-order. (checklist #5)
create policy reviews_admin_read on reviews
  for select to authenticated using (is_admin());

-- webhook_events and ratelimit have RLS enabled and no policies: only the
-- service role (edge functions) can touch them.
