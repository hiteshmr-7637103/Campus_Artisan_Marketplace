import { useCallback, useEffect, useState, type ReactNode } from "react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/60" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
        aria-hidden
      />
      {label}
    </div>
  );
}

export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "info" | "success";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-900 border-blue-200",
    success: "bg-green-50 text-green-900 border-green-200",
  }[kind];
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-16 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
    </div>
  );
}

export function Field({
  label, children, hint,
}: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-green-100 text-green-800", paid: "bg-green-100 text-green-800", fulfilled: "bg-green-100 text-green-800",
    approved: "bg-green-100 text-green-800",
    pending_review: "bg-amber-100 text-amber-800", pending_payment: "bg-amber-100 text-amber-800", pending: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800", cancelled: "bg-ink/10 text-ink/70", refunded: "bg-ink/10 text-ink/70",
    archived: "bg-ink/10 text-ink/70", sold: "bg-ink text-white",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone[status] ?? "bg-ink/10"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

/** Tiny data-loading hook: { data, error, reload }. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    return fn().then(setData).catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}
