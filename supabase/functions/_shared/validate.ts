import { HttpError } from "./http.ts";

// Hand-rolled server-side validation. Every field a human types is checked here
// as well as in the DB constraints — the frontend checks are UX only. (checklist #10)

const CONTROL_CHARS = new RegExp("[\\x00-\\x1F\\x7F]", "g");

export function str(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new HttpError(`${field} is required`, 422);
  const cleaned = value.replace(CONTROL_CHARS, " ").trim();
  if (cleaned.length < min) throw new HttpError(`${field} is too short`, 422);
  if (cleaned.length > max) throw new HttpError(`${field} must be at most ${max} characters`, 422);
  return cleaned;
}

export function optionalStr(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return str(value, field, 1, max);
}

export function email(value: unknown, field = "email"): string {
  const s = str(value, field, 3, 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) throw new HttpError(`${field} is not a valid email`, 422);
  return s;
}

export function phone(value: unknown, field = "phone"): string {
  const s = str(value, field, 6, 20);
  if (!/^[0-9+\-() ]{6,20}$/.test(s)) throw new HttpError(`${field} is not a valid phone number`, 422);
  return s;
}

// Positive number of rupees from the form -> integer paise.
export function priceToPaise(value: unknown, field = "price"): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(`${field} must be a positive number`, 422);
  if (n > 1_000_000) throw new HttpError(`${field} is too large`, 422);
  const paise = Math.round(n * 100);
  if (paise <= 0) throw new HttpError(`${field} must be a positive number`, 422);
  return paise;
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new HttpError(`${field} must be one of: ${allowed.join(", ")}`, 422);
  }
  return value as T;
}

// Photo URLs must point at our own public storage bucket, nowhere else. We match
// on the storage path (not the origin) so it holds across local, prod and any
// custom/CDN domain the public URL might use.
const BUCKET_PATH = "/storage/v1/object/public/product-photos/";
export function photoUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new HttpError("between 1 and 3 photos are required", 422);
  }
  const out: string[] = [];
  for (const u of value) {
    if (typeof u !== "string") throw new HttpError("invalid photo url", 422);
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      throw new HttpError("invalid photo url", 422);
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      throw new HttpError("photo url must be https", 422);
    }
    if (!parsed.pathname.startsWith(BUCKET_PATH) || parsed.pathname.includes("..")) {
      throw new HttpError("photo url is not from this site", 422);
    }
    out.push(u);
  }
  return out;
}

export const CATEGORIES = ["jewelry", "decor", "textiles", "pottery", "other"] as const;
export const FULFILLMENT = ["pickup", "delivery"] as const;

// Constant-time string compare for the shared artisan code.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
