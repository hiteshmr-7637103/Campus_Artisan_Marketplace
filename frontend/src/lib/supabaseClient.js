import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.warn("[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
}

export const supabase = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-not-set",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

export const FUNCTIONS_BASE = `${(url ?? "").replace(/\/+$/, "")}/functions/v1`;
