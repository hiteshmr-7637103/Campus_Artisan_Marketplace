// The ONLY place the frontend talks to the FastAPI backend.
// Money is always integer paise on the wire; format it with formatINR() for display.

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = "campcraft_access_token";
let accessToken = typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
let refreshing = null;

export const hasSession = () => accessToken !== null;

export function setAccessToken(token) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }
}

// Concurrent callers share one refresh (refresh tokens rotate, so a second parallel call would fail).
export function refreshSession() {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) setAccessToken(null);
        return false;
      }
      const data = await res.json();
      setAccessToken(data.access_token);
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
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
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
  if (r.mfa_required) return { mfaRequired: true, mfaToken: r.mfa_token };
  setAccessToken(r.access_token);
  return { user: r.user };
}
export async function verifyAdmin2fa(mfaToken, code) {
  const r = await post("/auth/admin/2fa/verify", { mfa_token: mfaToken, code });
  setAccessToken(r.access_token);
  return r.user;
}
export const admin2faEnroll = () => post("/auth/admin/2fa/enroll");
export async function admin2faConfirm(code) {
  const r = await post("/auth/admin/2fa/confirm", { code });
  setAccessToken(r.access_token); // the enrolling session predates 2FA; this one carries mfa=true
  return r; // { user, recovery_codes, ... }
}
export const googleLoginUrl = () => `${API_URL}/auth/google/login`;
export async function logout() {
  try {
    await post("/auth/logout");
  } finally {
    setAccessToken(null);
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
export const requestUpiChange = (password, new_upi_id) => post("/seller/upi/request-change", { password, new_upi_id });
export const confirmUpiChange = (token) => post("/seller/upi/confirm-change", { token });
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
export const sellerStatements = () => request("/seller/statements");
export const sellerStatement = (id) => request(`/seller/statements/${id}`);

// ---- admin -----------------------------------------------------------------
const withStatus = (path, status) => (status ? `${path}?status=${status}` : path);
const withParams = (path, params = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, v);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
};
export const adminSellers = (status) => request(withStatus("/admin/sellers", status));
export const adminSellerDecision = (id, decision, reason) =>
  post(`/admin/sellers/${id}/decision`, { decision, reason: reason || null });
export const adminListings = (status) => request(withStatus("/admin/listings", status));
export const adminListingDecision = (id, decision, reason) =>
  post(`/admin/listings/${id}/decision`, { decision, reason: reason || null });
export const adminOrders = (status) => request(withStatus("/admin/orders", status));
export const adminOrderAction = (id, action) => post(`/admin/orders/${id}/${action}`); // fulfill | cancel | refund
export const adminPayouts = (params) => request(withParams("/admin/payouts", params));
export const adminPayoutTotals = (params) => request(withParams("/admin/payouts/totals", params));
export const adminMarkPaid = (id, upi_txn_ref, totp_code) => post(`/admin/payouts/${id}/mark-paid`, { upi_txn_ref, totp_code });
export const adminReleasePayout = (id, totp_code) => post(`/admin/payouts/${id}/release`, { totp_code });
export const adminPayoutsBySeller = (sellerId) => request(`/admin/payouts/sellers/${sellerId}`);
export const adminFinance = () => request("/admin/finance");
export const adminStatements = (sellerId) => request(withParams("/admin/statements", { seller_id: sellerId }));
export const adminStatement = (id) => request(`/admin/statements/${id}`);
export const adminRegenerateStatement = (id) => post(`/admin/statements/${id}/regenerate`);
export const adminMetrics = () => request("/admin/metrics");

// Authenticated file download (the generic request() always parses JSON, which a CSV isn't).
export async function downloadCsv(path, filename) {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(`${API_URL}${path}`, { headers, credentials: "include" });
  if (!res.ok) throw new ApiError(`Could not download (${res.status})`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export const adminExportPayoutsCsv = (params) => downloadCsv(withParams("/admin/payouts/export.csv", params), "payouts.csv");
