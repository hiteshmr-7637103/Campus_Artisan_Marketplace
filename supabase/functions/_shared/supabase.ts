import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new HttpError(`server misconfigured: ${name} is not set`, 500);
  return v;
}

// Service-role client — bypasses RLS. Never expose this key to the browser.
export function serviceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Resolve the caller from their bearer token and assert they are an admin.
// Used by notify-fulfilled. Throws HttpError(401/403) otherwise.
export async function requireAdmin(req: Request): Promise<{ userId: string; email: string | null }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError("missing bearer token", 401);

  const svc = serviceClient();
  const { data: userData, error } = await svc.auth.getUser(token);
  if (error || !userData?.user) throw new HttpError("invalid session", 401);

  const { data: admin } = await svc
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!admin) throw new HttpError("not authorized", 403);

  return { userId: userData.user.id, email: userData.user.email ?? null };
}
