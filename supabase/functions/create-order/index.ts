import { preflight } from "../_shared/cors.ts";
import { clientIp, fail, HttpError, logError, ok } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { rateLimit } from "../_shared/ratelimit.ts";
import { siteUrl } from "../_shared/config.ts";
import { computeAmounts } from "../_shared/money.ts";
import { createPaymentLink } from "../_shared/razorpay.ts";
import {
  email as validEmail,
  FULFILLMENT,
  oneOf,
  optionalStr,
  phone as validPhone,
  str,
} from "../_shared/validate.ts";

// Creates an `orders` row (status: placed) and a Razorpay payment link for it.
//
// SECURITY: the amount is computed here from listings.price_artisan +
// platform_config.commission_rate. Nothing about price is read from the request
// body. (checklist #1)

const STALE_PLACED_MINUTES = 30;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method not allowed", 405);

  const svc = serviceClient();
  let createdOrderId: string | null = null;

  try {
    await rateLimit(svc, `create-order:${clientIp(req)}`, { max: 8, windowSeconds: 600 });

    const b = await req.json().catch(() => {
      throw new HttpError("invalid JSON body", 400);
    });

    const listingId = str(b.listing_id, "listing", 10, 64);
    const buyer = {
      name: str(b.buyer_name, "name", 1, 120),
      phone: validPhone(b.buyer_phone, "phone"),
      email: validEmail(b.buyer_email, "email"),
    };
    const fulfillmentMethod = oneOf(b.fulfillment_method, "fulfillment method", FULFILLMENT);
    const delivery = {
      point: optionalStr(b.delivery_point, "delivery point", 200),
      time: optionalStr(b.delivery_time, "preferred time", 120),
      notes: optionalStr(b.delivery_notes, "notes", 500),
    };
    if (fulfillmentMethod === "delivery" && !delivery.point) {
      throw new HttpError("a delivery point is required for campus delivery", 422);
    }

    // --- price + availability, entirely server-side -------------------------
    const { data: listing, error: lErr } = await svc
      .from("listings")
      .select("id, title, status, price_artisan")
      .eq("id", listingId)
      .maybeSingle();
    if (lErr) throw new HttpError(lErr.message, 400);
    if (!listing) throw new HttpError("that item no longer exists", 404);
    if (listing.status !== "active") throw new HttpError("sorry, that item is no longer available", 409);

    const { data: cfg, error: cErr } = await svc
      .from("platform_config")
      .select("commission_rate")
      .single();
    if (cErr) throw new HttpError(cErr.message, 500);

    const amounts = computeAmounts(listing.price_artisan, Number(cfg.commission_rate));

    // Release any abandoned checkout on this listing before we try to insert.
    await svc
      .from("orders")
      .update({ status: "cancelled" })
      .eq("listing_id", listingId)
      .eq("status", "placed")
      .lt("created_at", new Date(Date.now() - STALE_PLACED_MINUTES * 60_000).toISOString());

    // --- create the order --------------------------------------------------
    const { data: order, error: oErr } = await svc
      .from("orders")
      .insert({
        listing_id: listingId,
        buyer_name: buyer.name,
        buyer_phone: buyer.phone,
        buyer_email: buyer.email,
        fulfillment_method: fulfillmentMethod,
        delivery_point: delivery.point,
        delivery_time: delivery.time,
        delivery_notes: delivery.notes,
        amount_total: amounts.amountTotal,
        amount_commission: amounts.amountCommission,
        amount_artisan: amounts.amountArtisan,
        status: "placed",
      })
      .select("id, access_token")
      .single();

    if (oErr) {
      // partial unique index -> another checkout for this listing is already live
      if (oErr.code === "23505") {
        throw new HttpError("someone is already checking this item out — try again in a few minutes", 409);
      }
      throw new HttpError(oErr.message, 400);
    }
    createdOrderId = order.id;

    // --- Razorpay payment link ------------------------------------------------
    const link = await createPaymentLink({
      amountPaise: amounts.amountTotal,
      referenceId: order.id,
      description: `Campus Artisan Marketplace — ${listing.title}`,
      callbackUrl: `${siteUrl()}/order/${order.access_token}`,
      customer: { name: buyer.name, contact: buyer.phone, email: buyer.email },
    });

    await svc.from("orders").update({ razorpay_payment_link_id: link.id }).eq("id", order.id);

    return ok({ short_url: link.shortUrl, access_token: order.access_token, order_id: order.id });
  } catch (err) {
    // don't leave a phantom 'placed' order locking the listing
    if (createdOrderId) {
      await svc.from("orders").update({ status: "cancelled" }).eq("id", createdOrderId).eq("status", "placed");
    }
    if (err instanceof HttpError) return fail(err.message, err.status);
    logError("create-order", err);
    return fail("could not start checkout — please try again", 500);
  }
});
