import { useState } from "react";
import { adminExportPayoutsCsv, adminMarkPaid, adminPayoutTotals, adminPayouts, adminReleasePayout } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";
import { Kpi } from "./Admin";

const FILTERS = ["pending", "eligible", "on_hold", "paid", "failed", ""];

export function AdminPayouts() {
  const [status, setStatus] = useState("pending");
  const { data: payouts, error, reload } = useLoad(() => adminPayouts({ status }), [status]);
  const { data: totals } = useLoad(() => adminPayoutTotals({ status }), [status]);
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      await adminExportPayoutsCsv({ status });
    } catch (e) {
      showToast(e.message, "⚠️");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
              {(f || "all").replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-earth-muted border border-earth-border"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Kpi label="Orders (this view)" value={totals.orders} />
          <Kpi label="Gross" value={formatINR(totals.gross_paise)} />
          <Kpi label="Commission" value={formatINR(totals.commission_paise)} />
          <Kpi label="Net paid" value={formatINR(totals.net_paid_paise)} tone="text-emerald-700" />
          <Kpi label="Pending" value={formatINR(totals.pending_paise)} tone="text-amber-600" sub={totals.on_hold_paise ? `${formatINR(totals.on_hold_paise)} on hold` : undefined} />
        </div>
      )}

      <Notice kind="info">
        Send each amount to the artisan's UPI ID from your UPI app, then record the transaction reference and your 2FA code here.
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

function MarkPaidForm({ p, onDone }) {
  const [ref, setRef] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function markPaid(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminMarkPaid(p.id, ref.trim(), code.trim());
      showToast(`${formatINR(p.amount_paise)} to ${p.seller_name} recorded`, "💸");
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={markPaid} className="flex flex-wrap gap-2">
        <input
          className="field-input max-w-[200px] py-2"
          placeholder="UPI transaction ref"
          required
          minLength={3}
          maxLength={80}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
        <input
          className="field-input max-w-[140px] py-2"
          placeholder="2FA code"
          required
          minLength={6}
          maxLength={24}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn-primary py-2" disabled={busy}>
          {busy ? "Saving…" : "Mark paid"}
        </button>
      </form>
      {err && (
        <div className="mt-2">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </>
  );
}

function ReleaseForm({ p, onDone }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function release(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await adminReleasePayout(p.id, code.trim());
      showToast("Payout released", "✅");
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <Notice kind="warn">{p.exception_reason ?? "Held for manual review."}</Notice>
      <form onSubmit={release} className="mt-2 flex flex-wrap gap-2">
        <input
          className="field-input max-w-[140px] py-2"
          placeholder="2FA code"
          required
          minLength={6}
          maxLength={24}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn-primary py-2" disabled={busy}>
          {busy ? "Releasing…" : "Release"}
        </button>
      </form>
      {err && (
        <div className="mt-2">
          <Notice kind="error">{err}</Notice>
        </div>
      )}
    </div>
  );
}

function PayoutRow({ payout: p, onDone }) {
  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-earth-slate">
            {formatINR(p.amount_paise)} → {p.seller_name}
          </p>
          <p className="text-xs text-earth-muted">
            Gross {formatINR(p.gross_paise)} · Commission {formatINR(p.commission_paise)}
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
        <StatusBadge status={p.status} />
      </div>
      {p.status === "eligible" && <MarkPaidForm p={p} onDone={onDone} />}
      {p.status === "on_hold" && <ReleaseForm p={p} onDone={onDone} />}
    </li>
  );
}
