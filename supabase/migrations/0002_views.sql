-- Buyer-facing views.
--
-- These are SECURITY DEFINER views (the Postgres default): they run with the
-- privileges of the owner (postgres), which bypasses RLS on the base tables.
-- anon/authenticated are granted SELECT on the VIEW only and have NO grant on
-- the underlying `listings` / `artisans` tables, so a buyer literally cannot
-- select artisan_contact or price_artisan — it is not a column of anything they
-- can query. (Security checklist #4.)

-- Per-artisan rating rollup (rating is shown per artisan, across all their listings).
create view artisan_ratings as
  select
    a.id                                   as artisan_id,
    count(r.id)                            as review_count,
    round(avg(r.rating)::numeric, 2)       as avg_rating
  from artisans a
  left join reviews r on r.artisan_id = a.id
  group by a.id;

-- The storefront feed + product detail source. Excludes every contact/private column.
create view listings_public as
  select
    l.id,
    l.category,
    l.title,
    l.description,
    l.photo_urls,
    l.status,
    l.created_at,
    l.artisan_id,
    a.name                                                    as artisan_name,
    -- buyer price = what the artisan wants + commission on top, from live config
    (l.price_artisan + round(l.price_artisan * pc.commission_rate))::integer as price_buyer,
    coalesce(ar.review_count, 0)                              as artisan_review_count,
    ar.avg_rating                                             as artisan_avg_rating
  from listings l
  cross join platform_config pc
  left join artisans a        on a.id = l.artisan_id
  left join artisan_ratings ar on ar.artisan_id = l.artisan_id
  where l.status in ('active', 'sold');

-- Review comments for the product / artisan pages. No buyer PII is stored on
-- reviews, so rating + comment + timestamp are safe to expose.
create view reviews_public as
  select
    r.id,
    r.listing_id,
    r.artisan_id,
    r.rating,
    r.comment,
    r.created_at
  from reviews r;

-- Grants: expose the views, nothing else.
grant select on artisan_ratings  to anon, authenticated;
grant select on listings_public  to anon, authenticated;
grant select on reviews_public   to anon, authenticated;
