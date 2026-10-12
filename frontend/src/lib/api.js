import { supabase } from "./supabaseClient";

export class ApiError extends Error {}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    const ctx = error.context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      } catch {
        /* keep default */
      }
    }
    throw new ApiError(msg);
  }
  if (data && data.ok === false) {
    throw new ApiError(data.error ?? "request failed");
  }
  return data;
}

// listings (buyer-facing, from the *_public views)
export async function fetchListings(category) {
  let q = supabase
    .from("listings_public")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (category && category !== "all") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw new ApiError(error.message);
  return data;
}

export async function fetchListing(id) {
  const { data, error } = await supabase
    .from("listings_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError(error.message);
  return data ?? null;
}

export async function fetchArtisanReviews(artisanId) {
  const { data, error } = await supabase
    .from("reviews_public")
    .select("*")
    .eq("artisan_id", artisanId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new ApiError(error.message);
  return data;
}

// edge functions
export function createListing(input) {
  return invoke("create-listing", input);
}

export async function uploadPhoto(file, artisanCode) {
  const form = new FormData();
  form.append("file", file);
  form.append("artisan_code", artisanCode);
  const res = await invoke("upload-photo", form);
  return supabase.storage.from("product-photos").getPublicUrl(res.path).data.publicUrl;
}

export function createOrder(input) {
  return invoke("create-order", input);
}

export function notifyFulfilled(orderId) {
  return invoke("notify-fulfilled", { order_id: orderId });
}

// RPCs
export async function getOrderByToken(token) {
  const { data, error } = await supabase.rpc("get_order_by_token", { p_token: token });
  if (error) throw new ApiError(error.message);
  return data ?? null;
}

export async function submitReview(token, rating, comment) {
  const { data, error } = await supabase.rpc("submit_review", {
    p_token: token,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw new ApiError(friendlyReviewError(error.message));
  return data;
}

export async function claimOrders() {
  const { data, error } = await supabase.rpc("claim_orders");
  if (error) throw new ApiError(error.message);
  return data ?? 0;
}

function friendlyReviewError(msg) {
  if (msg.includes("already exists")) return "You've already reviewed this order.";
  if (msg.includes("not fulfilled")) return "This order isn't marked fulfilled yet.";
  if (msg.includes("rating must be")) return "Please pick a rating between 1 and 5 stars.";
  return msg;
}
