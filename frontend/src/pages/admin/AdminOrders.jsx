import { useState } from "react";
import { adminOrderAction, adminOrders } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { ORDER_STATUS_LABEL } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";

// "refund" is a pseudo-filter for paid orders flagged needs_refund.
const FILTERS = ["paid", "refund", "pending_payment", "fulfilled", "cancelled", "refunded", ""];

const CONFIRM = {
  fulfill: "Mark this order fulfilled? The buyer is emailed a link to leave a review.",
  cancel: "Cancel this unpaid order? Its payment link is cancelled too.",
  refund: "Only do this AFTER refunding the buyer in the Razorpay dashboard. Mark as refunded?",
};

export function AdminOrders() {
  const [filter, setFilter] = useState("paid");
  const { data: orders, error, reload } = useLoad(
    () => (filter === "refund" ? adminOrders("paid").then((os) => os.filter((o) => o.needs_refund)) : adminOrders(filter)),
    [filter],
  );

  async function act(o, action) {
    if (!window.confirm(CONFIRM[action])) return;
    try {
      const r = await adminOrderAction(o.id, action);
      showToast(r.message, "✅");
      await reload();
    } catch (e) {
      showToast(e.message, "⚠️");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${
              filter === f ? "bg-earth-slate text-white" : "bg-white text-earth-muted border border-earth-border"
            }`}
          >
            {f === "refund" ? "⚠️ Needs refund" : f ? ORDER_STATUS_LABEL[f] : "All"}
          </button>
        ))}
      </div>

      {error && <Notice kind="error">{error.message}</Notice>}
      {!error && !orders && <Spinner />}
      {orders?.length === 0 && <EmptyState title="No orders in this view" />}
      {orders && orders.length > 0 && (
        <div className="p-2 sm:p-4 rounded-2xl bg-white border border-earth-border shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-earth-border text-earth-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3">Order</th>
                <th className="py-3 px-3">Craft & buyer</th>
                <th className="py-3 px-3">Artisan</th>
                <th className="py-3 px-3">Split</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-earth-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-stone-50/80 transition-colors align-top">
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-earth-slate">#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-[11px] text-earth-muted">{formatDate(o.created_at)}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-earth-slate">{o.listing_title}</div>
                    <div className="text-[11px] text-earth-muted">
                      {o.buyer_name} · {o.buyer_email}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-earth-slate">{o.seller_name}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-bold text-earth-slate">{formatINR(o.amount_paise)}</span>
                    <span className="text-[11px] text-emerald-800 block">Artisan {formatINR(o.seller_amount_paise)}</span>
                    <span className="text-[11px] text-earth-muted block">Platform {formatINR(o.commission_paise)}</span>
                  </td>
                  <td className="py-3 px-3 space-y-1">
                    <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                    {o.needs_refund && (
                      <div>
                        <StatusBadge status="rejected" label="Needs refund" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                    {o.status === "paid" && !o.needs_refund && (
                      <button
                        type="button"
                        onClick={() => act(o, "fulfill")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px]"
                      >
                        Mark handoff done
                      </button>
                    )}
                    {o.status === "pending_payment" && (
                      <button
                        type="button"
                        onClick={() => act(o, "cancel")}
                        className="px-2.5 py-1.5 rounded-lg border border-earth-border bg-white text-stone-700 hover:bg-stone-100 text-[11px]"
                      >
                        Cancel
                      </button>
                    )}
                    {(o.status === "paid" || o.status === "fulfilled") && (
                      <button
                        type="button"
                        onClick={() => act(o, "refund")}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] ${
                          o.needs_refund
                            ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100 font-semibold"
                            : "border-earth-border bg-white text-stone-700 hover:bg-stone-100"
                        }`}
                      >
                        Mark refunded
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
