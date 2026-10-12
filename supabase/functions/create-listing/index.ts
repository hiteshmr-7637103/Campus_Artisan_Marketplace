import { preflight } from "../_shared/cors.ts";
import { clientIp, fail, HttpError, logError, ok } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { artisanCode } from "../_shared/config.ts";
import {
  CATEGORIES,
  oneOf,
  photoUrls,
  priceToPaise,
  safeEqual,
  str,
} from "../_shared/validate.ts";

// Public "Add Listing" submission. Gated by the shared artisan code, then queued
// for admin approval (status = 'pending'). The raw artisan contact is stored as
// text and only split into an `artisans` row when an admin approves.

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method not allowed", 405);

  const svc = serviceClient();
  try {
    await rateLimit(svc, `create-listing:${clientIp(req)}`, { max: 5, windowSeconds: 600 });

    const b = await req.json().catch(() => {
      throw new HttpError("invalid JSON body", 400);
    });

    if (!safeEqual(String(b.artisan_code ?? ""), artisanCode())) {
      throw new HttpError("that artisan code is not valid", 403);
    }

    const row = {
      submitted_artisan_name: str(b.artisan_name, "artisan name", 1, 120),
      submitted_artisan_contact: str(b.artisan_contact, "artisan contact", 3, 200),
      category: oneOf(b.category, "category", CATEGORIES),
      title: str(b.title, "title", 2, 120),
      description: str(b.description, "description", 1, 4000),
      price_artisan: priceToPaise(b.price, "price"),
      photo_urls: photoUrls(b.photo_urls),
      status: "pending" as const,
    };

    const { data, error } = await svc.from("listings").insert(row).select("id").single();
    if (error) throw new HttpError(error.message, 400);

    return ok({ id: data.id });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message, err.status);
    logError("create-listing", err);
    return fail("something went wrong submitting your listing", 500);
  }
});
