import { logError, logInfo } from "./http.ts";

// Thin Resend wrapper. Email is best-effort: a failure to send is logged but
// never fails the payment webhook (the order is still paid).

const RESEND_API = "https://api.resend.com/emails";

function rupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!key || !from) {
    logInfo("resend", "email skipped — RESEND_API_KEY / RESEND_FROM not set", { to: opts.to });
    return false;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      logError("resend", new Error(`Resend ${res.status}: ${await res.text()}`), { to: opts.to });
      return false;
    }
    logInfo("resend", "email sent", { to: opts.to, subject: opts.subject });
    return true;
  } catch (err) {
    logError("resend", err, { to: opts.to });
    return false;
  }
}

// ---- templates -----------------------------------------------------------

const shell = (inner: string) => `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5">
  <h1 style="font-size:18px;margin:0 0 16px">Campus Artisan Marketplace</h1>
  ${inner}
  <p style="color:#888;font-size:12px;margin-top:28px">You are receiving this because you placed an order on the Campus Artisan Marketplace.</p>
</div>`;

export function orderConfirmedEmail(p: {
  buyerName: string;
  orderId: string;
  itemTitle: string;
  amountTotalPaise: number;
  orderUrl: string;
  artisanLine: string;
}): { subject: string; html: string } {
  return {
    subject: `Order confirmed — ${p.itemTitle}`,
    html: shell(`
      <p>Hi ${escapeHtml(p.buyerName)}, your payment is confirmed. 🎉</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0">
        <tr><td style="padding:4px 0;color:#666">Item</td><td style="text-align:right">${escapeHtml(p.itemTitle)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Amount paid</td><td style="text-align:right">${rupees(p.amountTotalPaise)}</td></tr>
        <tr><td style="padding:4px 0;color:#666">Order ref</td><td style="text-align:right">${p.orderId.slice(0, 8)}</td></tr>
      </table>
      <p style="font-size:14px"><strong>Artisan contact:</strong><br>${escapeHtml(p.artisanLine)}</p>
      <p style="margin-top:20px">
        <a href="${p.orderUrl}" style="background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">View your order</a>
      </p>
      <p style="font-size:13px;color:#666">The founders will coordinate handoff and settle the artisan. You'll get a note when it's marked fulfilled.</p>
    `),
  };
}

export function reviewPromptEmail(p: {
  buyerName: string;
  itemTitle: string;
  reviewUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `How was "${p.itemTitle}"? Leave a quick rating`,
    html: shell(`
      <p>Hi ${escapeHtml(p.buyerName)}, your order for <strong>${escapeHtml(p.itemTitle)}</strong> is marked fulfilled.</p>
      <p>A quick 1–5 star rating helps other campus buyers and the artisan.</p>
      <p style="margin-top:20px">
        <a href="${p.reviewUrl}" style="background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">Rate this artisan</a>
      </p>
    `),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
