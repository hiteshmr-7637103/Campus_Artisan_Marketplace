import type {
  AdminListing, AdminOrder, AdminPayout, AdminSeller, Category, Listing, ListingPage, Metrics, Order,
  SellerListing, SellerMe, SellerOrder, SellerPayout, SellerProfile, User,
} from "./types";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

// Access token lives in memory only. The refresh token is an httpOnly cookie the JS never sees.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}

interface AuthResponse { access_token: string; user: User }

// Concurrent callers share one refresh (refresh tokens rotate, so a second parallel call would fail).
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      accessToken = ((await res.json()) as AuthResponse).access_token;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, body, credentials: "include" });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 401 && retry && accessToken && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(path, init, false);
  }
  if (!res.ok) {
    let msg = res.status >= 500 ? "Something went wrong on our side. Please try again." : `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* keep default */ }
    throw new ApiError(msg, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const post = <T>(path: string, json?: unknown) => request<T>(path, { method: "POST", json: json ?? {} });
const patch = <T>(path: string, json: unknown) => request<T>(path, { method: "PATCH", json });

// ---- auth ----
export const signup = (b: { email: string; password: string; full_name: string; phone?: string }) =>
  post<{ message: string }>("/auth/signup", b);
export async function login(email: string, password: string): Promise<User> {
  const r = await post<AuthResponse>("/auth/login", { email, password });
  accessToken = r.access_token;
  return r.user;
}
export async function logout(): Promise<void> {
  try { await post("/auth/logout"); } finally { accessToken = null; }
}
export const verifyEmail = (token: string) => post<{ message: string }>("/auth/verify-email", { token });
export const resendVerification = () => post<{ message: string }>("/auth/resend-verification");
export const forgotPassword = (email: string) => post<{ message: string }>("/auth/forgot-password", { email });
export const resetPassword = (token: string, password: string) =>
  post<{ message: string }>("/auth/reset-password", { token, password });
export const getMe = () => request<User>("/me");
export const updateMe = (b: { full_name?: string; phone?: string }) => patch<User>("/me", b);

// ---- catalog ----
export const fetchCategories = () => request<Category[]>("/categories");
export function fetchListings(p: { category?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (p.category) qs.set("category", p.category);
  if (p.q) qs.set("q", p.q);
  if (p.page) qs.set("page", String(p.page));
  return request<ListingPage>(`/listings?${qs}`);
}
export const fetchListing = (id: string) => request<Listing>(`/listings/${id}`);
export const fetchSeller = (id: string) => request<SellerProfile>(`/sellers/${id}`);

// ---- buyer ----
export const createOrder = (listing_id: string) => post<Order>("/orders", { listing_id });
export const fetchOrders = () => request<Order[]>("/orders");
export const fetchOrder = (id: string) => request<Order>(`/orders/${id}`);
export const reviewOrder = (id: string, rating: number, comment: string) =>
  post<{ message: string }>(`/orders/${id}/review`, { rating, comment });
export const simulatePayment = (id: string) => post<{ status: string }>(`/dev/simulate-payment/${id}`);

// ---- seller ----
export interface ApplyInput { display_name: string; bio: string; phone: string; instagram?: string; upi_id: string }
export const sellerMe = () => request<SellerMe>("/seller/me");
export const sellerApply = (b: ApplyInput) => post<SellerMe>("/seller/apply", b);
export const sellerListings = () => request<SellerListing[]>("/seller/listings");
export const sellerListing = (id: string) => request<SellerListing>(`/seller/listings/${id}`);
export interface ListingInput { title: string; category_id: string; description: string; price_paise: number }
export const createListing = (b: ListingInput) => post<SellerListing>("/seller/listings", b);
export const updateListing = (id: string, b: Partial<ListingInput>) => patch<SellerListing>(`/seller/listings/${id}`, b);
export const archiveListing = (id: string) => post<SellerListing>(`/seller/listings/${id}/archive`);
export function uploadImage(listingId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ id: string; url: string; position: number }>(`/seller/listings/${listingId}/images`, { method: "POST", body: form });
}
export const deleteImage = (listingId: string, imageId: string) =>
  request<{ message: string }>(`/seller/listings/${listingId}/images/${imageId}`, { method: "DELETE" });
export const sellerOrders = () => request<SellerOrder[]>("/seller/orders");
export const sellerPayouts = () => request<SellerPayout[]>("/seller/payouts");

// ---- admin ----
export const adminSellers = () => request<AdminSeller[]>("/admin/sellers");
export const adminSellerDecision = (id: string, decision: "approve" | "reject", reason?: string) =>
  post(`/admin/sellers/${id}/decision`, { decision, reason });
export const adminListings = (status?: string) => request<AdminListing[]>(`/admin/listings${status ? `?status=${status}` : ""}`);
export const adminListingDecision = (id: string, decision: "approve" | "reject" | "archive", reason?: string) =>
  post(`/admin/listings/${id}/decision`, { decision, reason });
export const adminOrders = () => request<AdminOrder[]>("/admin/orders");
export const adminOrderAction = (id: string, action: "fulfill" | "cancel" | "refund") => post(`/admin/orders/${id}/${action}`);
export const adminPayouts = () => request<AdminPayout[]>("/admin/payouts");
export const adminMarkPaid = (id: string, upi_txn_ref: string) => post(`/admin/payouts/${id}/mark-paid`, { upi_txn_ref });
export const adminMetrics = () => request<Metrics>("/admin/metrics");
