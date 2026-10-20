import { adminFinance } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { Notice, Spinner, useLoad } from "../../components/ui";
import { Kpi } from "./Admin";

export function AdminFinance() {
  const { data: f, error } = useLoad(adminFinance);
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!f) return <Spinner />;

  const alerts = [];
  if (f.payouts_failed) alerts.push(`${f.payouts_failed} payout(s) failed`);
  if (f.payouts_stuck) alerts.push(`${f.payouts_stuck} payout(s) stuck over 24h`);
  if (f.payouts_large_pending) alerts.push(`${f.payouts_large_pending} unusually large payout(s) pending`);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Collected" value={formatINR(f.collected_paise)} />
        <Kpi label="Commission earned" value={formatINR(f.commission_earned_paise)} tone="text-emerald-700" />
        <Kpi label="Paid out to sellers" value={formatINR(f.paid_out_paise)} />
        <Kpi label="Outstanding to sellers" value={formatINR(f.outstanding_to_sellers_paise)} tone="text-amber-600" />
      </div>
      {alerts.length > 0 && (
        <Notice kind="warn">
          <ul className="list-disc pl-5">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}
