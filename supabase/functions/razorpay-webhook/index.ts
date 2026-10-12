import { fail, HttpError, logError, logInfo, ok } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { verifyWebhookSignature } from "../_shared/razorpay.ts";
import { orderConfirmedEmail, sendEmail } from "../_shared/resend.ts";
import { siteUrl } from "../_shared/config.ts";

// Razorpay's webhook is the ONLY thing that moves an order to 'paid'.
//
//   1. verify the HMAC signature before trusting anything          (checklist #2)
//   2. record the event id; a repeat is a no-op                    (checklist #12)
//   3. placed -> paid, listing -> sold, in that order
//   4. email the buyer their confirmation + the artisan's contact
//
// verify_jwt is disabled for this function (see config.toml).

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method not allowed", 405);

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    logError("razorpay-webhook", new Error("RAZORPAY_WEBHOOK_SECRET not set"));
    return fail("webhook not configured", 503);
  }

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!(await verifyWebhookSignature(raw, signature, secret))) {
    logError("razorpay-webhook", new Error("invalid signature"), {
      ip: req.headers.get("x-forwarded-for"),
    });
    return fail("invalid signature", 400);
  }

  let payload: RazorpayWebhook;
  try {
    payload = JSON.parse(raw);
  } catch {
    return fail("invalid JSON", 400);
  }

  const eventId = req.headers.get("x-razorpay-event-id") ?? `${payload.event}:${payload.created_at}`;
  const svc = serviceClient();

  try {
    // idempotency gate
    const { error: dupErr } = await svc
      .from("webhook_events")
      .insert({ id: eventId, event_type: payload.event });
    if (dupErr) {
      if (dupErr.code === "23505") {
        logInfo("razorpay-webhook", "duplicate event ignored", { eventId });
        return ok({ duplicate: true });
      }
      throw new HttpError(dupErr.message, 500);
    }

    if (payload.event !== "payment_link.paid") {
      logInfo("razorpay-webhook", "event ignored", { event: payload.event, eventId });
      return ok({ ignored: payload.event });
    }

    const plink = payload.payload?.payment_link?.entity;
    const payment = payload.payload?.payment?.entity;
    const orderId = plink?.reference_id;
    if (!orderId) {
      logError("razorpay-webhook", new Error("no reference_id on payment_link"), { eventId });
      return ok({ ignored: "no reference_id" });
    }

    const { data: order } = await svc
      .from("orders")
      .select("id, status, listing_id, buyer_name, buyer_email, amount_total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) {
      logError("razorpay-webhook", new Error("order not found"), { eventId, orderId });
      return ok({ ignored: "order not found" });
    }
    if (order.status === "paid" || order.status === "fulfilled") {
      return ok({ alreadyPaid: true });
    }

    // placed -> paid (guarded on status so a race can't double-apply)
    const { data: updated, error: uErr } = await svc
      .from("orders")
      .update({
        status: "paid",
        razorpay_payment_id: payment?.id ?? null,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "placed")
      .select("id, access_token")
      .maybeSingle();
    if (uErr) throw new HttpError(uErr.message, 500);
    if (!updated) return ok({ alreadyPaid: true });

    // listing -> sold
    await svc.from("listings").update({ status: "sold" }).eq("id", order.listing_id);

    // confirmation email with the now-unmasked artisan contact
    await sendConfirmation(svc, order, updated.access_token);

    logInfo("razorpay-webhook", "order marked paid", { orderId: order.id, eventId });
    return ok({ paid: true });
  } catch (err) {
    logError("razorpay-webhook", err, { eventId });
    // roll back the idempotency row so Razorpay's retry can reprocess this event
    await svc.from("webhook_events").delete().eq("id", eventId);
    return fail("webhook processing failed", 500);
  }
});

async function sendConfirmation(
  // deno-lint-ignore no-explicit-any
  svc: any,
  order: { id: string; listing_id: string; buyer_name: string; buyer_email: string; amount_total: number },
  accessToken: string,
) {
  const { data: listing } = await svc
    .from("listings")
    .select("title, artisan_id, submitted_artisan_contact")
    .eq("id", order.listing_id)
    .maybeSingle();

  let artisanLine = listing?.submitted_artisan_contact ?? "shared by the founders shortly";
  if (listing?.artisan_id) {
    const { data: a } = await svc
      .from("artisans")
      .select("name, contact_phone, contact_email, instagram")
      .eq("id", listing.artisan_id)
      .maybeSingle();
    if (a) {
      artisanLine = [
        a.name,
        a.contact_phone && `Phone: ${a.contact_phone}`,
        a.contact_email && `Email: ${a.contact_email}`,
        a.instagram && `Instagram: ${a.instagram}`,
      ].filter(Boolean).join(" · ");
    }
  }

  const mail = orderConfirmedEmail({
    buyerName: order.buyer_name,
    orderId: order.id,
    itemTitle: listing?.title ?? "your item",
    amountTotalPaise: order.amount_total,
    orderUrl: `${siteUrl()}/order/${accessToken}`,
    artisanLine,
  });
  await sendEmail({ to: order.buyer_email, ...mail });
}

// ---- Razorpay webhook shape (partial) -----------------------------------
interface RazorpayWebhook {
  event: string;
  created_at?: number;
  payload?: {
    payment_link?: { entity?: { id?: string; reference_id?: string; status?: string } };
    payment?: { entity?: { id?: string } };
  };
}
