import { useState } from "react";
import { adminMarkPaid, adminPayouts } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";

export function AdminPayouts() {
  const [status, setStatus] = useState("pending");
  const { data: payouts, error, reload } = useLoad(() => adminPayouts(status), [status]);
  const owed = (payouts ?? []).filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_paise, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {["pending", "paid", ""].map((f) => (
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
        {status === "pending" && payouts && (
          <span className="text-sm text-earth-muted">
            Owed to artisans: <span className="font-editorial text-lg font-bold text-amber-600">{formatINR(owed)}</span>
          </span>
        )}
      </div>

      <Notice kind="info">
        Send each amount to the artisan's UPI ID from your UPI app, then record the transaction reference here.
      </Notice>

      <div className="mt-4">
        {error && <Notice kind="error">{error.message}</Notice>}
        {!error && !payouts && <Spinner />}
        {payouts?.length === 0 && <EmptyState title="Nothing here" />}
        {payouts && payouts.length > 0 && (
          <ul className="space-y-3">
            {payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} onDone={reload} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PayoutRow({ payout: p, onDone }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function markPaid(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminMarkPaid(p.id, ref.trim());
      showToast(`${formatINR(p.amount_paise)} to ${p.seller_name} recorded`, "💸");
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-earth-slate">
            {formatINR(p.amount_paise)} → {p.seller_name}
          </p>
          <p className="text-xs text-earth-muted">
            UPI <span className="font-mono text-earth-slate">{p.upi_id ?? "—"}</span> · order #{p.order_id.slice(0, 8).toUpperCase()} ·{" "}
            {formatDate(p.created_at)}
          </p>
          {p.status === "paid" && (
            <p className="text-xs text-emerald-800">
              Paid {p.paid_at ? formatDate(p.paid_at) : ""} · ref {p.upi_txn_ref}
            </p>
          )}
        </div>
        {p.status === "paid" ? (
          <StatusBadge status="paid" label="Paid" />
        ) : (
          <form onSubmit={markPaid} className="flex gap-2">
            <input
              className="field-input max-w-[200px] py-2"
              placeholder="UPI transaction ref"
              required
              minLength={3}
              maxLength={80}
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
            <button type="submit" className="btn-primary py-2" disabled={busy}>
              {busy ? "Saving…" : "Mark paid"}
            </button>
          </form>
        )}
      </div>
      {err && (
        <div className="mt-2">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </li>
  );
}
