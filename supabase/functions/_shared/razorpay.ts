import { HttpError } from "./http.ts";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function basicAuth(): string {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new HttpError(
      "payments are not configured yet — Razorpay keys are missing",
      503,
    );
  }
  return "Basic " + btoa(`${keyId}:${keySecret}`);
}

export interface PaymentLinkInput {
  amountPaise: number;
  referenceId: string;      // our order id
  description: string;
  callbackUrl: string;      // where Razorpay sends the buyer back
  customer: { name: string; contact: string; email: string };
}

export interface PaymentLinkResult {
  id: string;        // plink_...
  shortUrl: string;
}

export async function createPaymentLink(input: PaymentLinkInput): Promise<PaymentLinkResult> {
  const body = {
    amount: input.amountPaise,
    currency: "INR",
    accept_partial: false,
    reference_id: input.referenceId,
    description: input.description.slice(0, 250),
    customer: {
      name: input.customer.name.slice(0, 120),
      contact: input.customer.contact,
      email: input.customer.email,
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: input.callbackUrl,
    callback_method: "get",
  };

  const res = await fetch(`${RAZORPAY_API}/payment_links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.description ?? `Razorpay error (${res.status})`;
    throw new HttpError(`could not start payment: ${msg}`, 502);
  }
  return { id: data.id, shortUrl: data.short_url };
}

// HMAC-SHA256 hex of the raw request body, compared to the x-razorpay-signature
// header. This MUST pass before the webhook is trusted. (checklist #2)
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
