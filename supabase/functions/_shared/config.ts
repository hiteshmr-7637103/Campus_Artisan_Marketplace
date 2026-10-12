import { requireEnv } from "./supabase.ts";

// The deployed frontend origin, used to build buyer-facing links (order page,
// Razorpay callback). Falls back to localhost for `supabase functions serve`.
export function siteUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173").replace(/\/+$/, "");
}

export function artisanCode(): string {
  return requireEnv("ARTISAN_SIGNUP_CODE");
}
