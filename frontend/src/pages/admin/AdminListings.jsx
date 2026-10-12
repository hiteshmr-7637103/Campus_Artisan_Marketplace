import { useCallback, useEffect, useState } from "react";
import {
  approveListing,
  createArtisan,
  listArtisans,
  listPendingListings,
  listRecentListings,
  rejectListing,
} from "../../lib/admin";
import { CATEGORY_LABEL } from "../../lib/types";
import { formatINR, formatDate } from "../../lib/format";
import { EmptyState, Notice, Spinner } from "../../components/ui";

export function AdminListings() {
  const [pending, setPending] = useState(null);
  const [recent, setRecent] = useState([]);
  const [artisans, setArtisans] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [p, r, a] = await Promise.all([
        listPendingListings(),
        listRecentListings(),
        listArtisans(),
      ]);
      setPending(p);
      setRecent(r);
      setArtisans(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load listings.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (pending === null) return <Spinner />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-lg font-semibold">Pending listings ({pending.length})</h1>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting for review" />
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((l) => (
              <PendingRow
                key={l.id}
                listing={l}
                artisans={artisans}
                onDone={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-earth-muted">Recently processed</h2>
        <ul className="mt-3 divide-y divide-earth-border text-sm">
          {recent.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2">
              <span className="line-clamp-1">{l.title}</span>
              <span className="text-earth-muted">
                {l.status}
                {l.reject_reason ? ` — ${l.reject_reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PendingRow({ listing, artisans, onDone }) {
  const [mode, setMode] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [artisanChoice, setArtisanChoice] = useState("new");
  const [aName, setAName] = useState(listing.submitted_artisan_name);
  const [aPhone, setAPhone] = useState("");
  const [aEmail, setAEmail] = useState("");
  const [aInsta, setAInsta] = useState("");
  const [reason, setReason] = useState("");

  async function doApprove() {
    setBusy(true);
    setErr(null);
    try {
      let artisanId = artisanChoice;
      if (artisanChoice === "new") {
        if (aName.trim().length < 1) throw new Error("Artisan name is required.");
        if (!aPhone && !aEmail && !aInsta) throw new Error("Add at least one contact method.");
        artisanId = await createArtisan({
          name: aName.trim(),
          contact_phone: aPhone.trim(),
          contact_email: aEmail.trim(),
          instagram: aInsta.trim(),
        });
      }
      await approveListing(listing.id, artisanId);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Approve failed.");
      setBusy(false);
    }
  }

  async function doReject() {
    if (reason.trim().length < 1) {
      setErr("Give a short reason.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await rejectListing(listing.id, reason.trim());
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reject failed.");
      setBusy(false);
    }
  }

  return (
    <li className="card p-4">
      <div className="flex gap-4">
        <div className="flex shrink-0 gap-2">
          {listing.photo_urls.map((u, i) => (
            <img
              key={u}
              src={u}
              alt={`${listing.title} ${i + 1}`}
              className="h-20 w-20 rounded-lg border border-earth-border object-cover"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-medium">{listing.title}</h3>
            <span className="text-xs text-earth-muted">{formatDate(listing.created_at)}</span>
          </div>
          <p className="text-xs uppercase tracking-wide text-earth-muted">
            {CATEGORY_LABEL[listing.category] || listing.category} · artisan wants {formatINR(listing.price_artisan)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-earth-slate">{listing.description}</p>
          <p className="mt-2 text-sm">
            <span className="text-earth-muted">Submitted as:</span> {listing.submitted_artisan_name}
            {" · "}
            <span className="text-earth-muted">contact:</span> {listing.submitted_artisan_contact}
          </p>
        </div>
      </div>

      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}

      {mode === "idle" && (
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={() => setMode("approve")}>
            Approve…
          </button>
          <button className="btn-ghost" onClick={() => setMode("reject")}>
            Reject…
          </button>
        </div>
      )}

      {mode === "approve" && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <label className="field-label">Link to artisan</label>
          <select
            className="field-input"
            value={artisanChoice}
            onChange={(e) => setArtisanChoice(e.target.value)}
          >
            <option value="new">➕ Create new artisan</option>
            {artisans.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {artisanChoice === "new" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label">Name</label>
                <input className="field-input" value={aName} onChange={(e) => setAName(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="field-input" value={aPhone} onChange={(e) => setAPhone(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input className="field-input" value={aEmail} onChange={(e) => setAEmail(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">Instagram</label>
                <input className="field-input" value={aInsta} onChange={(e) => setAInsta(e.target.value)} />
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={doApprove} disabled={busy}>
              {busy ? "Approving…" : "Confirm approve"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3">
          <label className="field-label">Reason</label>
          <input className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={doReject} disabled={busy}>
              {busy ? "Rejecting…" : "Confirm reject"}
            </button>
            <button className="btn-ghost" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
