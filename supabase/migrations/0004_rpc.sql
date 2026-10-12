-- RPCs callable from the buyer-facing frontend (anon / authenticated).
-- All are SECURITY DEFINER and do their own authorization checks.

-- ---------------------------------------------------------------------------
-- get_order_by_token — the buyer's keyhole into a single order.
-- Artisan contact is included ONLY once payment has cleared (status paid /
-- fulfilled), matching the "contact masked until payment" rule (spec 5a).
-- ---------------------------------------------------------------------------
create or replace function get_order_by_token(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o        orders%rowtype;
  l        listings%rowtype;
  a        artisans%rowtype;
  has_rev  boolean;
  reveal   boolean;
begin
  select * into o from orders where access_token = p_token;
  if not found then
    return null;
  end if;

  select * into l from listings where id = o.listing_id;
  if l.artisan_id is not null then
    select * into a from artisans where id = l.artisan_id;
  end if;

  select exists(select 1 from reviews where order_id = o.id) into has_rev;
  reveal := o.status in ('paid', 'fulfilled');

  return json_build_object(
    'id',                 o.id,
    'status',             o.status,
    'created_at',         o.created_at,
    'paid_at',            o.paid_at,
    'fulfilled_at',       o.fulfilled_at,
    'buyer_name',         o.buyer_name,
    'buyer_phone',        o.buyer_phone,
    'buyer_email',        o.buyer_email,
    'fulfillment_method', o.fulfillment_method,
    'delivery_point',     o.delivery_point,
    'delivery_time',      o.delivery_time,
    'delivery_notes',     o.delivery_notes,
    'amount_total',       o.amount_total,
    'listing', json_build_object(
      'id',         l.id,
      'title',      l.title,
      'category',   l.category,
      'photo_urls', l.photo_urls
    ),
    'artisan', case when reveal then json_build_object(
      'name',          coalesce(a.name, l.submitted_artisan_name),
      'contact_phone', a.contact_phone,
      'contact_email', a.contact_email,
      'instagram',     a.instagram,
      -- fallback: if admin approved without splitting the raw contact out yet
      'contact_raw',   case when a.id is null then l.submitted_artisan_contact end
    ) else null end,
    'can_review',   (o.status = 'fulfilled' and not has_rev),
    'has_review',   has_rev
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_review — the only way a review row is ever created.
-- Enforces: valid token, order fulfilled, no existing review. (checklist #5)
-- ---------------------------------------------------------------------------
create or replace function submit_review(p_token uuid, p_rating int, p_comment text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  o     orders%rowtype;
  l     listings%rowtype;
  clean text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5' using errcode = '22023';
  end if;

  select * into o from orders where access_token = p_token;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;
  if o.status <> 'fulfilled' then
    raise exception 'order is not fulfilled yet' using errcode = '22023';
  end if;
  if exists (select 1 from reviews where order_id = o.id) then
    raise exception 'a review already exists for this order' using errcode = '23505';
  end if;

  -- sanitize: drop any angle-bracket markup, strip control chars, trim, cap length.
  -- (React escapes on render too — this is defense in depth, spec 9b.)
  clean := coalesce(p_comment, '');
  clean := regexp_replace(clean, '<[^>]*>', '', 'g');   -- tags
  clean := regexp_replace(clean, '[<>]', '', 'g');      -- stray brackets
  clean := regexp_replace(clean, '[[:cntrl:]]', ' ', 'g');
  clean := nullif(btrim(clean), '');
  if clean is not null and char_length(clean) > 1000 then
    clean := left(clean, 1000);
  end if;

  select * into l from listings where id = o.listing_id;

  insert into reviews (order_id, listing_id, artisan_id, rating, comment)
  values (o.id, l.id, l.artisan_id, p_rating, clean);

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_orders — after a buyer signs in with a magic link, attach any past
-- guest orders that used the same email address to their new account.
-- ---------------------------------------------------------------------------
create or replace function claim_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or em = '' then
    return 0;
  end if;
  update orders
     set buyer_user_id = auth.uid()
   where buyer_user_id is null
     and lower(buyer_email) = em;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Lock down execution: no PUBLIC, only the API roles that need each function.
revoke execute on function get_order_by_token(uuid) from public;
revoke execute on function submit_review(uuid, int, text) from public;
revoke execute on function claim_orders() from public;
revoke execute on function is_admin() from public;

grant execute on function get_order_by_token(uuid) to anon, authenticated;
grant execute on function submit_review(uuid, int, text) to anon, authenticated;
grant execute on function claim_orders() to authenticated;
grant execute on function is_admin() to authenticated;
