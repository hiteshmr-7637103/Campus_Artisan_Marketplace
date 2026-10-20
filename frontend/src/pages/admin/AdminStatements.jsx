import { useState } from "react";
import { adminRegenerateStatement, adminStatements } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, useLoad } from "../../components/ui";

export function AdminStatements() {
  const { data: statements, error, reload } = useLoad(adminStatements);
  const [busyId, setBusyId] = useState(null);

  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!statements) return <Spinner />;
  if (statements.length === 0) return <EmptyState title="No statements yet" hint="Statements are generated automatically every Monday." />;

  async function regenerate(id) {
    setBusyId(id);
    try {
      await adminRegenerateStatement(id);
      showToast("Statement regenerated", "🔄");
      await reload();
    } catch (e) {
      showToast(e.message, "⚠️");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="space-y-3">
      {statements.map((s) => (
        <li key={s.id} className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-earth-slate">
                Seller #{s.seller_id.slice(0, 8).toUpperCase()} · {formatDate(s.period_start)} – {formatDate(s.period_end)}
              </p>
              <p className="text-xs text-earth-muted">
                Gross {formatINR(s.gross_paise)} · Commission {formatINR(s.commission_paise)} · Net {formatINR(s.net_paise)}
              </p>
              <p className="text-xs text-earth-muted">
                Paid {formatINR(s.paid_paise)} · Pending {formatINR(s.pending_paise)} · Held {formatINR(s.held_paise)}
              </p>
            </div>
            <button type="button" className="btn-primary py-2" disabled={busyId === s.id} onClick={() => regenerate(s.id)}>
              {busyId === s.id ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
