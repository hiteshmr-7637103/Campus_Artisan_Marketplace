import { supabase } from "./supabaseClient";
import type {
  Category,
  FulfillmentMethod,
  OrderView,
  PublicListing,
  PublicReview,
} from "./types";

export class ApiError extends Error {}

// Normalise a supabase.functions.invoke result: pull the server's { error }
// message out of the non-2xx response body so the UI can show something useful.
async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    // deno/supabase-js exposes the raw Response on error.context
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      } catch { /* keep default */ }
    }
    throw new ApiError(msg);
  }
  if (data && (data as { ok?: boolean }).ok === false) {
    throw new ApiError((data as { error?: string }).error ?? "request failed");
  }
  return data as T;
}

// ---- listings (buyer-facing, from the *_public views) --------------------

export async function fetchListings(category?: Category | "all"): Promise<PublicListing[]> {
  let q = supabase
    .from("listings_public")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (category && category !== "all") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new ApiError(error.message);
  return data as PublicListing[];
}

export async function fetchListing(id: string): Promise<PublicListing | null> {
  const { data, error } = await supabase
    .from("listings_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return (data as PublicListing) ?? null;
}

export async function fetchArtisanReviews(artisanId: string): Promise<PublicReview[]> {
  const { data, error } = await supabase
    .from("reviews_public")
    .select("*")
    .eq("artisan_id", artisanId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new ApiError(error.message);
  return data as PublicReview[];
}

// ---- edge functions -----------------------------------------------------

export interface CreateListingInput {
  artisan_code: string;
  artisan_name: string;
  artisan_contact: string;
  category: Category;
  title: string;
  description: string;
  price: number; // rupees
  photo_urls: string[];
}

export function createListing(input: CreateListingInput) {
  return invoke<{ ok: true; id: string }>("create-listing", input);
}

export async function uploadPhoto(file: File, artisanCode: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("artisan_code", artisanCode);
  const res = await invoke<{ ok: true; path: string }>("upload-photo", form);
  // Build the public URL from the browser's Supabase origin, so it's correct in
  // every environment (the edge function only sees an internal hostname locally).
  return supabase.storage.from("product-photos").getPublicUrl(res.path).data.publicUrl;
}

export interface CreateOrderInput {
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  fulfillment_method: FulfillmentMethod;
  delivery_point?: string;
  delivery_time?: string;
  delivery_notes?: string;
}

export function createOrder(input: CreateOrderInput) {
  return invoke<{ ok: true; short_url: string; access_token: string; order_id: string }>(
    "create-order",
    input,
  );
}

export function notifyFulfilled(orderId: string) {
  return invoke<{ ok: true; emailed: boolean }>("notify-fulfilled", { order_id: orderId });
}

// ---- RPCs -------------------------------------------------------------------

export async function getOrderByToken(token: string): Promise<OrderView | null> {
  const { data, error } = await supabase.rpc("get_order_by_token", { p_token: token });
  if (error) throw new ApiError(error.message);
  return (data as OrderView) ?? null;
}

export async function submitReview(token: string, rating: number, comment: string) {
  const { data, error } = await supabase.rpc("submit_review", {
    p_token: token,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw new ApiError(friendlyReviewError(error.message));
  return data as { ok: true };
}

export async function claimOrders(): Promise<number> {
  const { data, error } = await supabase.rpc("claim_orders");
  if (error) throw new ApiError(error.message);
  return (data as number) ?? 0;
}

function friendlyReviewError(msg: string): string {
  if (msg.includes("already exists")) return "You've already reviewed this order.";
  if (msg.includes("not fulfilled")) return "This order isn't marked fulfilled yet.";
  if (msg.includes("rating must be")) return "Please pick a rating between 1 and 5 stars.";
  return msg;
}
