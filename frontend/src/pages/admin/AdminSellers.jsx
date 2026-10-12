import { useState } from "react";
import { adminSellerDecision, adminSellers } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";

const FILTERS = ["pending", "approved", "rejected", ""];

export function AdminSellers() {
  const [status, setStatus] = useState("pending");
  const { data: sellers, error, reload } = useLoad(() => adminSellers(status), [status]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={status === f}
            onClick={() => setStatus(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${
              status === f ? "bg-earth-slate text-white" : "bg-white text-earth-muted border border-earth-border"
            }`}
          >
            {f || "all"}
          </button>
        ))}
      </div>
      {error && <Notice kind="error">{error.message}</Notice>}
      {!error && !sellers && <Spinner />}
      {sellers?.length === 0 && <EmptyState title="Nothing here" />}
      {sellers && sellers.length > 0 && (
        <ul className="space-y-4">
          {sellers.map((s) => (
            <SellerRow key={s.id} seller={s} onDone={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SellerRow({ seller: s, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function decide(decision) {
    setBusy(true);
    setErr(null);
    try {
      await adminSellerDecision(s.id, decision, reason.trim());
      showToast(decision === "approve" ? `${s.display_name} approved` : "Application rejected", decision === "approve" ? "✅" : "🚫");
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <li className="card p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-editorial text-lg font-bold text-earth-slate">{s.display_name ?? "—"}</p>
          <p className="text-xs text-earth-muted">
            {s.full_name} · {s.email} · joined {formatDate(s.created_at)}
          </p>
        </div>
        <StatusBadge status={s.seller_status} />
      </div>
      {s.bio && <p className="mt-2 whitespace-pre-wrap text-earth-slate">{s.bio}</p>}
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <p>
          <span className="text-earth-muted">Phone:</span> {s.phone ?? "—"}
        </p>
        <p>
          <span className="text-earth-muted">Instagram:</span> {s.instagram ?? "—"}
        </p>
        <p>
          <span className="text-earth-muted">UPI:</span> <span className="font-mono">{s.upi_id ?? "—"}</span>
        </p>
      </div>

      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}

      {s.seller_status === "pending" && (
        <div className="mt-4 border-t border-earth-border pt-4">
          {rejecting ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field-input"
                placeholder="Reason (emailed to the applicant)"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button type="button" className="btn-primary" disabled={busy || !reason.trim()} onClick={() => decide("reject")}>
                Confirm reject
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setRejecting(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={() => decide("approve")}>
                Approve seller
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setRejecting(true)}>
                Reject…
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
