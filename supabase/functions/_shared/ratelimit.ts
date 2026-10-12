import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

// Light fixed-window rate limiter backed by the `ratelimit` table. Sized for a
// campus pilot — enough to stop accidental double-submits and cheap spam, not a
// full abuse system. (spec 9b / 9c)

export async function rateLimit(
  svc: SupabaseClient,
  key: string,
  opts: { max: number; windowSeconds: number },
): Promise<void> {
  const now = new Date();
  const bucketId = key;

  const { data: row } = await svc
    .from("ratelimit")
    .select("window_start, count")
    .eq("bucket", bucketId)
    .maybeSingle();

  const windowMs = opts.windowSeconds * 1000;

  if (!row) {
    await svc.from("ratelimit").upsert({
      bucket: bucketId,
      window_start: now.toISOString(),
      count: 1,
    });
    return;
  }

  const started = new Date(row.window_start).getTime();
  if (now.getTime() - started > windowMs) {
    // window expired -> reset
    await svc.from("ratelimit").update({
      window_start: now.toISOString(),
      count: 1,
    }).eq("bucket", bucketId);
    return;
  }

  if (row.count >= opts.max) {
    throw new HttpError("too many requests — please slow down and try again shortly", 429);
  }

  await svc.from("ratelimit").update({ count: row.count + 1 }).eq("bucket", bucketId);
}
