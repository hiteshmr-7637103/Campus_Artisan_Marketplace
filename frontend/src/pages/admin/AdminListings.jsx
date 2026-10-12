import { useState } from "react";
import { Link } from "react-router-dom";
import { adminListingDecision, adminListings } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { LISTING_STATUS_LABEL } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";

const FILTERS = ["pending_review", "active", "rejected", "sold", "archived", ""];

export function AdminListings() {
  const [status, setStatus] = useState("pending_review");
  const { data: listings, error, reload } = useLoad(() => adminListings(status), [status]);

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
            {f ? LISTING_STATUS_LABEL[f] : "All"}
          </button>
        ))}
      </div>
      {error && <Notice kind="error">{error.message}</Notice>}
      {!error && !listings && <Spinner />}
      {listings?.length === 0 && <EmptyState title="Nothing here" />}
      {listings && listings.length > 0 && (
        <ul className="space-y-4">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} onDone={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingRow({ listing: l, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function decide(decision) {
    if (decision === "archive" && !window.confirm(`Archive “${l.title}”? It disappears from the shop.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await adminListingDecision(l.id, decision, reason.trim());
      showToast(`${r.message}: ${l.title}`, decision === "approve" ? "✅" : "🗂️");
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <li className="card p-5 text-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 gap-2">
          {l.images.length === 0 ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-amber-400 bg-amber-50 text-center text-[10px] font-semibold text-amber-800">
              No photos
            </div>
          ) : (
            l.images.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                <img src={u} alt={`${l.title} ${i + 1}`} className="h-20 w-20 rounded-lg border border-earth-border object-cover" />
              </a>
            ))
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold text-earth-slate">{l.title}</h3>
            <StatusBadge status={l.status} label={LISTING_STATUS_LABEL[l.status]} />
          </div>
          <p className="text-xs text-earth-muted">
            {l.category} · {formatINR(l.price_paise)} · by{" "}
            <Link to={`/seller/${l.seller_id}`}>{l.seller_name}</Link> · {formatDate(l.created_at)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-earth-slate">{l.description}</p>
          {l.reject_reason && <p className="mt-1 text-xs text-red-700">Rejected: {l.reject_reason}</p>}
        </div>
      </div>

      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}

      {l.status === "pending_review" && l.images.length === 0 && (
        <div className="mt-3">
          <Notice kind="warn">This listing has no photos yet — consider rejecting until the seller adds some.</Notice>
        </div>
      )}

      {(l.status === "pending_review" || l.status === "active") && (
        <div className="mt-4 border-t border-earth-border pt-4">
          {rejecting ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field-input"
                placeholder="Reason (shown to the seller)"
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
            <div className="flex flex-wrap gap-2">
              {l.status === "pending_review" && (
                <>
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => decide("approve")}>
                    Approve & publish
                  </button>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => setRejecting(true)}>
                    Reject…
                  </button>
                </>
              )}
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => decide("archive")}>
                Archive
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
