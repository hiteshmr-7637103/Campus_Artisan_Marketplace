import { preflight } from "../_shared/cors.ts";
import { clientIp, fail, HttpError, logError, ok } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { artisanCode } from "../_shared/config.ts";
import { safeEqual } from "../_shared/validate.ts";

// Product photo upload. The browser never writes to Storage directly — this is
// the only path in. We sniff the real file signature (not the extension or the
// browser-declared content-type) so a `.js` renamed `.jpg` is rejected here, not
// just by a frontend `accept=` attribute. (checklist #9)

const MAX_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method not allowed", 405);

  const svc = serviceClient();
  try {
    await rateLimit(svc, `upload-photo:${clientIp(req)}`, { max: 40, windowSeconds: 600 });

    const form = await req.formData().catch(() => {
      throw new HttpError("expected multipart/form-data", 400);
    });

    if (!safeEqual(String(form.get("artisan_code") ?? ""), artisanCode())) {
      throw new HttpError("that artisan code is not valid", 403);
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError("no file provided", 422);
    if (file.size === 0) throw new HttpError("file is empty", 422);
    if (file.size > MAX_BYTES) throw new HttpError("image must be 5 MB or smaller", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) throw new HttpError("that file is not a JPEG, PNG or WebP image", 415);

    const path = `${crypto.randomUUID()}.${kind.ext}`;
    const { error } = await svc.storage
      .from("product-photos")
      .upload(path, bytes, { contentType: kind.mime, upsert: false });
    if (error) throw new HttpError(error.message, 500);

    // The frontend rebuilds the public URL from the browser's Supabase origin;
    // `url` here is convenience/debugging only and may carry an internal host.
    const { data } = svc.storage.from("product-photos").getPublicUrl(path);
    return ok({ path, url: data.publicUrl });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message, err.status);
    logError("upload-photo", err);
    return fail("could not upload that photo", 500);
  }
});

function sniffImage(b: Uint8Array): { ext: string; mime: string } | null {
  // JPEG: FF D8 FF
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}
