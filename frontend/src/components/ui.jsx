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
  }[kind];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="py-16 text-center">
      <p className="font-medium text-earth-slate">{title}</p>
      {hint && <p className="mt-1 text-sm text-earth-muted">{hint}</p>}
    </div>
  );
}
