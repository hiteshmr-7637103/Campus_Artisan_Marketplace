import { preflight } from "../_shared/cors.ts";
import { fail, HttpError, logError, ok } from "../_shared/http.ts";
import { requireAdmin, serviceClient } from "../_shared/supabase.ts";
import { reviewPromptEmail, sendEmail } from "../_shared/resend.ts";
import { siteUrl } from "../_shared/config.ts";

// Admin-only. Called by the admin panel right after it flips an order to
// 'fulfilled'. Emails the buyer a link to their order page, where the review
// form appears once status = fulfilled.

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return fail("method not allowed", 405);

  try {
    await requireAdmin(req);

    const b = await req.json().catch(() => {
      throw new HttpError("invalid JSON body", 400);
    });
    const orderId = String(b.order_id ?? "");
    if (!orderId) throw new HttpError("order_id is required", 422);

    const svc = serviceClient();
    const { data: order, error } = await svc
      .from("orders")
      .select("id, status, buyer_name, buyer_email, access_token, listing_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw new HttpError(error.message, 400);
    if (!order) throw new HttpError("order not found", 404);
    if (order.status !== "fulfilled") throw new HttpError("order is not fulfilled", 409);

    const { data: listing } = await svc
      .from("listings").select("title").eq("id", order.listing_id).maybeSingle();

    const mail = reviewPromptEmail({
      buyerName: order.buyer_name,
      itemTitle: listing?.title ?? "your item",
      reviewUrl: `${siteUrl()}/order/${order.access_token}`,
    });
    const sent = await sendEmail({ to: order.buyer_email, ...mail });

    return ok({ emailed: sent });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.message, err.status);
    logError("notify-fulfilled", err);
    return fail("could not send the review prompt", 500);
  }
});
