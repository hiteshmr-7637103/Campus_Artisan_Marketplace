import { useState } from "react";
import * as api from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../../components/ui";

function useAction(reload: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); await reload(); } catch (e) { setError((e as Error).message); }
  };
  return { error, run };
}

export function AdminMetrics() {
  const { data: m, error } = useLoad(api.adminMetrics);
  if (error) return <Notice>{error}</Notice>;
  if (!m) return <Spinner />;
  const rows: [string, string | number][] = [
    ["Signups", m.signups], ["Verified signups", m.verified_signups], ["Sellers with active listings", m.active_sellers],
    ["Active listings", m.listings_active], ["All listings", m.listings_total], ["Checkouts started", m.checkouts_started],
    ["Paid orders", m.paid_orders], ["GMV", formatINR(m.gmv_paise)], ["Commission earned", formatINR(m.commission_paise)],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="card p-4"><p className="text-xs text-ink/60">{k}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
      ))}
    </div>
  );
}

export function AdminSellers() {
  const { data, error, reload } = useLoad(api.adminSellers);
  const act = useAction(reload);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No seller applications" />;
  return (
    <div className="space-y-3">
      {act.error && <Notice>{act.error}</Notice>}
      {data.map((s) => (
        <div key={s.id} className="card p-4 text-sm">
          <div className="flex items-center justify-between"><p className="font-medium">{s.display_name} <span className="font-normal text-ink/60">({s.full_name}, {s.email})</span></p><StatusBadge status={s.seller_status} /></div>
          <p className="mt-1 whitespace-pre-wrap text-ink/70">{s.bio}</p>
          <p className="mt-1 text-xs text-ink/60">Phone {s.phone} · Instagram {s.instagram ?? "—"} · UPI {s.upi_id} · applied {formatDate(s.created_at)}</p>
          {s.seller_status === "pending" && (
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={() => act.run(() => api.adminSellerDecision(s.id, "approve"))}>Approve</button>
              <button className="btn-ghost" onClick={() => { const r = prompt("Reason (optional)") ?? undefined; void act.run(() => api.adminSellerDecision(s.id, "reject", r)); }}>Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminListings() {
  const { data, error, reload } = useLoad(() => api.adminListings());
  const act = useAction(reload);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner />;
  const sorted = [...data].sort((a, b) => Number(b.status === "pending_review") - Number(a.status === "pending_review"));
  if (!sorted.length) return <EmptyState title="No listings" />;
  return (
    <div className="space-y-3">
      {act.error && <Notice>{act.error}</Notice>}
      {sorted.map((l) => (
        <div key={l.id} className="card flex gap-3 p-3 text-sm">
          {l.images[0] && <img src={l.images[0]} alt="" className="h-20 w-20 rounded-lg object-cover" />}
          <div className="flex-1">
            <div className="flex items-center justify-between"><p className="font-medium">{l.title} · {formatINR(l.price_paise)}</p><StatusBadge status={l.status} /></div>
            <p className="text-xs text-ink/60">{l.category} · by {l.seller_name}</p>
            <p className="mt-1 line-clamp-2 text-ink/70">{l.description}</p>
            <div className="mt-2 flex gap-2">
              {l.status === "pending_review" && (
                <>
                  <button className="btn-primary px-3 py-1.5" onClick={() => act.run(() => api.adminListingDecision(l.id, "approve"))}>Approve</button>
                  <button className="btn-ghost px-3 py-1.5" onClick={() => { const r = prompt("Reason for rejection") ?? undefined; void act.run(() => api.adminListingDecision(l.id, "reject", r)); }}>Reject</button>
                </>
              )}
              {(l.status === "active" || l.status === "pending_review") && (
                <button className="btn-ghost px-3 py-1.5" onClick={() => act.run(() => api.adminListingDecision(l.id, "archive"))}>Archive</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminOrders() {
  const { data, error, reload } = useLoad(api.adminOrders);
  const act = useAction(reload);
  const [filter, setFilter] = useState("");
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner />;
  const rows = data.filter((o) => !filter || o.status === filter);
  return (
    <div className="space-y-3">
      {act.error && <Notice>{act.error}</Notice>}
      <select className="field-input w-auto" aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All statuses</option>
        {["pending_payment", "paid", "fulfilled", "cancelled", "refunded"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      {!rows.length && <EmptyState title="No orders" />}
      {rows.map((o) => (
        <div key={o.id} className={`card p-3 text-sm ${o.needs_refund ? "border-red-400 bg-red-50" : ""}`}>
          <div className="flex items-center justify-between"><p className="font-medium">{o.listing_title} · {formatINR(o.amount_paise)}</p><StatusBadge status={o.status} /></div>
          <p className="text-xs text-ink/60">Buyer {o.buyer_name} ({o.buyer_email}) · seller {o.seller_name} · commission {formatINR(o.commission_paise)} · {formatDate(o.created_at)}</p>
          {o.needs_refund && <p className="mt-1 font-medium text-red-700">Needs refund — refund in the Razorpay dashboard, then mark refunded.</p>}
          <div className="mt-2 flex gap-2">
            {o.status === "paid" && !o.needs_refund && <button className="btn-primary px-3 py-1.5" onClick={() => act.run(() => api.adminOrderAction(o.id, "fulfill"))}>Mark fulfilled</button>}
            {o.status === "pending_payment" && <button className="btn-ghost px-3 py-1.5" onClick={() => act.run(() => api.adminOrderAction(o.id, "cancel"))}>Cancel</button>}
            {(o.status === "paid" || o.status === "fulfilled") && <button className="btn-ghost px-3 py-1.5" onClick={() => confirm("Only mark refunded after refunding in Razorpay. Continue?") && act.run(() => api.adminOrderAction(o.id, "refund"))}>Mark refunded</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminPayouts() {
  const { data, error, reload } = useLoad(api.adminPayouts);
  const act = useAction(reload);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner />;
  if (!data.length) return <EmptyState title="No payouts yet" />;
  return (
    <div className="space-y-3">
      {act.error && <Notice>{act.error}</Notice>}
      {data.map((p) => (
        <div key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div>
            <p className="font-medium">{formatINR(p.amount_paise)} to {p.seller_name}</p>
            <p className="text-xs text-ink/60">UPI {p.upi_id} · {p.status === "paid" ? `ref ${p.upi_txn_ref}` : `since ${formatDate(p.created_at)}`}</p>
          </div>
          {p.status === "pending" ? (
            <button className="btn-primary px-3 py-1.5" onClick={() => { const ref = prompt("UPI transaction reference"); if (ref) void act.run(() => api.adminMarkPaid(p.id, ref)); }}>Mark paid</button>
          ) : <StatusBadge status="paid" />}
        </div>
      ))}
    </div>
  );
}
