import { useCallback, useEffect, useState } from "react";

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-earth-muted" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-earth-border border-t-brand-terracotta"
        aria-hidden
      />
      {label}
    </div>
  );
}

export function Notice({ kind = "error", children }) {
  const styles = {
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-900 border-blue-200",
    success: "bg-green-50 text-green-900 border-green-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
  }[kind];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="py-16 text-center">
      <p className="font-editorial text-lg font-bold text-earth-slate">{title}</p>
      {hint && <p className="mt-1 text-sm text-earth-muted">{hint}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-earth-muted">{hint}</span>}
    </label>
  );
}

const TONE = {
  active: "bg-emerald-100 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-800",
  fulfilled: "bg-indigo-100 text-indigo-800",
  approved: "bg-emerald-100 text-emerald-800",
  pending_review: "bg-amber-100 text-amber-800",
  pending_payment: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-stone-100 text-stone-600",
  refunded: "bg-stone-100 text-stone-600",
  archived: "bg-stone-100 text-stone-600",
  sold: "bg-stone-800 text-stone-100",
  eligible: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  on_hold: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  reversed: "bg-stone-100 text-stone-600",
};

export function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${TONE[status] ?? "bg-stone-100 text-stone-700"}`}>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 border-b border-earth-border pb-6 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <span className="rounded-full bg-brand-clayLight px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-terracotta">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-3 font-editorial text-2xl font-bold text-earth-slate sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-earth-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Tiny data-loading hook: { data, error, reload }. */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return fn().then(setData).catch((e) => setError(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, reload: load };
}
