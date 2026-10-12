import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Not fatal — the UI shows a clear "not configured yet" state instead of a
  // blank screen. See SETUP.md.
  console.warn("[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
}

export const supabase = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-not-set",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export const FUNCTIONS_BASE = `${(url ?? "").replace(/\/+$/, "")}/functions/v1`;
