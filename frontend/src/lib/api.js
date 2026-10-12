// The ONLY place the frontend talks to the FastAPI backend.
// Money is always integer paise on the wire; format it with formatINR() for display.

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

// The access token lives in memory only. The refresh token is an httpOnly cookie the JS never sees.
let accessToken = null;
let refreshing = null;

export const hasSession = () => accessToken !== null;

// Concurrent callers share one refresh (refresh tokens rotate, so a second parallel call would fail).
export function refreshSession() {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      accessToken = (await res.json()).access_token;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function request(path, { json, retry = true, ...init } = {}) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let body = init.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, body, credentials: "include" });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.");
  }

  // Access tokens expire after 15 minutes: refresh once and retry.
  if (res.status === 401 && retry && accessToken && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request(path, { json, retry: false, ...init });
  }

  if (!res.ok) {
    let msg = res.status >= 500 ? "Something went wrong on our side. Please try again." : `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* keep default */
    }
    throw new ApiError(msg, res.status);
  }
  return res.status === 204 ? undefined : res.json();
}

const post = (path, json = {}) => request(path, { method: "POST", json });
const patch = (path, json) => request(path, { method: "PATCH", json });

// ---- auth ------------------------------------------------------------------
export const signup = (b) => post("/auth/signup", b);
export async function login(email, password) {
  const r = await post("/auth/login", { email, password });
  accessToken = r.access_token;
  return r.user;
}
export async function logout() {
  try {
    await post("/auth/logout");
  } finally {
    accessToken = null;
  }
}
export const verifyEmail = (token) => post("/auth/verify-email", { token });
export const resendVerification = () => post("/auth/resend-verification");
export const forgotPassword = (email) => post("/auth/forgot-password", { email });
export const resetPassword = (token, password) => post("/auth/reset-password", { token, password });
export const getMe = () => request("/me");
export const updateMe = (b) => patch("/me", b);

// ---- catalog (public) ------------------------------------------------------
export const fetchCategories = () => request("/categories");
export function fetchListings({ category, q, page } = {}) {
  const qs = new URLSearchParams();
  if (category) qs.set("category", category);
  if (q) qs.set("q", q);
  if (page) qs.set("page", String(page));
  return request(`/listings?${qs}`);
}
export const fetchListing = (id) => request(`/listings/${id}`);
export const fetchSeller = (id) => request(`/sellers/${id}`);

// ---- buyer -----------------------------------------------------------------
export const createOrder = (listing_id) => post("/orders", { listing_id });
export const fetchOrders = () => request("/orders");
export const fetchOrder = (id) => request(`/orders/${id}`);
export const reviewOrder = (id, rating, comment) => post(`/orders/${id}/review`, { rating, comment });
export const simulatePayment = (id) => post(`/dev/simulate-payment/${id}`); // mock payment mode only

// ---- seller ----------------------------------------------------------------
export const sellerMe = () => request("/seller/me");
export const sellerApply = (b) => post("/seller/apply", b);
export const sellerListings = () => request("/seller/listings");
export const sellerListing = (id) => request(`/seller/listings/${id}`);
export const createListing = (b) => post("/seller/listings", b);
export const updateListing = (id, b) => patch(`/seller/listings/${id}`, b);
export const archiveListing = (id) => post(`/seller/listings/${id}/archive`);
export function uploadImage(listingId, file) {
  const form = new FormData();
  form.append("file", file);
  return request(`/seller/listings/${listingId}/images`, { method: "POST", body: form });
}
export const deleteImage = (listingId, imageId) =>
  request(`/seller/listings/${listingId}/images/${imageId}`, { method: "DELETE" });
export const sellerOrders = () => request("/seller/orders");
export const sellerPayouts = () => request("/seller/payouts");

// ---- admin -----------------------------------------------------------------
const withStatus = (path, status) => (status ? `${path}?status=${status}` : path);
export const adminSellers = (status) => request(withStatus("/admin/sellers", status));
export const adminSellerDecision = (id, decision, reason) =>
  post(`/admin/sellers/${id}/decision`, { decision, reason: reason || null });
export const adminListings = (status) => request(withStatus("/admin/listings", status));
export const adminListingDecision = (id, decision, reason) =>
  post(`/admin/listings/${id}/decision`, { decision, reason: reason || null });
export const adminOrders = (status) => request(withStatus("/admin/orders", status));
export const adminOrderAction = (id, action) => post(`/admin/orders/${id}/${action}`); // fulfill | cancel | refund
export const adminPayouts = (status) => request(withStatus("/admin/payouts", status));
export const adminMarkPaid = (id, upi_txn_ref) => post(`/admin/payouts/${id}/mark-paid`, { upi_txn_ref });
export const adminMetrics = () => request("/admin/metrics");
