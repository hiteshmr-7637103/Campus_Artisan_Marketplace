import { corsHeaders } from "./cors.ts";

// Uniform JSON responses + structured logging (so the required "edge function
// failed" alert has something to fire on — see SETUP.md § Monitoring).

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function ok(body: Record<string, unknown> = {}): Response {
  return json({ ok: true, ...body }, 200);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function logError(fn: string, err: unknown, context?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      level: "error",
      fn,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ...context,
    }),
  );
}

export function logInfo(fn: string, message: string, context?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", fn, message, ...context }));
}

// Best-effort client IP for rate-limit bucketing.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
