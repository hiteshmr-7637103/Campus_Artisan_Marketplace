-- Product photo storage.
--
-- Uploads go ONLY through the `upload-photo` edge function, which sniffs real
-- image magic bytes and enforces the size cap with the service-role key. The
-- browser never writes to Storage directly, so a non-image renamed `.jpg`
-- cannot get in via a spoofed content-type. (checklist #9)
--
-- The bucket is public-read so <img> tags resolve without signed URLs; it is
-- NOT public-write (no INSERT/UPDATE/DELETE policy for anon/authenticated).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  true,
  5242880,                                   -- 5 MiB hard cap at the storage layer
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read for this bucket only.
create policy "product-photos public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-photos');

-- No write policies here on purpose — the service role (upload-photo function)
-- bypasses RLS; nobody else can write.
