import type { ReactNode } from "react";

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
