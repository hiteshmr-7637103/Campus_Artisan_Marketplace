import { useState } from "react";
import { Link } from "react-router-dom";
import { archiveListing, sellerListings, sellerOrders, sellerPayouts } from "../../lib/api";
import { formatDate, formatINR } from "../../lib/format";
import { LISTING_STATUS_LABEL, ORDER_STATUS_LABEL } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { EmptyState, Notice, PageHeader, Spinner, StatusBadge, useLoad } from "../../components/ui";

const TABS = [
  ["listings", "My Crafts"],
  ["orders", "Orders"],
  ["payouts", "Payouts"],
];

export function SellerStudio() {
  const [tab, setTab] = useState("listings");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <PageHeader eyebrow="Seller Studio" title="Your craft shop" subtitle="Manage listings, track orders and see your payouts.">
        <Link to="/sell/listings/new" className="btn-primary no-underline">
          + New listing
        </Link>
      </PageHeader>

      <div className="flex items-center gap-3 border-b border-earth-border mb-6">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm transition-all border-b-2 ${
              tab === key
                ? "border-brand-terracotta text-brand-terracotta font-bold"
                : "border-transparent text-earth-muted hover:text-earth-slate font-medium"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "listings" && <ListingsTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "payouts" && <PayoutsTab />}
    </div>
  );
}

function ListingsTab() {
  const { data: listings, error, reload } = useLoad(sellerListings);
  const [busyId, setBusyId] = useState(null);

  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!listings) return <Spinner />;
  if (listings.length === 0) {
    return (
      <EmptyState title="No crafts listed yet" hint="Add your first craft — it goes live after a quick review.">
        <Link to="/sell/listings/new" className="btn-primary no-underline">
          + List your first craft
        </Link>
      </EmptyState>
    );
  }

  async function archive(l) {
    if (!window.confirm(`Remove “${l.title}” from the shop? This can't be undone.`)) return;
    setBusyId(l.id);
    try {
      await archiveListing(l.id);
      showToast("Listing archived", "🗄️");
      await reload();
    } catch (e) {
      showToast(e.message, "⚠️");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {listings.map((l) => {
        const editable = !["sold", "archived"].includes(l.status);
        return (
          <li key={l.id} className="card p-4 flex gap-4">
            {l.images[0] ? (
              <img src={l.images[0].url} alt="" className="w-20 h-20 rounded-xl object-cover bg-brand-clayLight" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-brand-clayLight flex items-center justify-center text-2xl">📸</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-earth-slate truncate">{l.title}</p>
                <StatusBadge status={l.status} label={LISTING_STATUS_LABEL[l.status]} />
              </div>
              <p className="text-xs text-earth-muted">
                {l.category} · {formatINR(l.price_paise)}
              </p>
              {l.status === "rejected" && l.reject_reason && (
                <p className="mt-1 text-xs text-red-700">Reason: {l.reject_reason} — edit it to resubmit.</p>
              )}
              {l.images.length === 0 && editable && <p className="mt-1 text-xs text-amber-700">Add at least one photo.</p>}
              {editable && (
                <div className="mt-2 flex gap-3 text-xs font-semibold">
                  <Link to={`/sell/listings/${l.id}/edit`}>Edit</Link>
                  {l.status === "active" && <Link to={`/listing/${l.id}`}>View live</Link>}
                  <button type="button" className="text-earth-muted hover:text-red-700" disabled={busyId === l.id} onClick={() => archive(l)}>
                    Archive
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OrdersTab() {
  const { data: orders, error } = useLoad(sellerOrders);
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!orders) return <Spinner />;
  if (orders.length === 0) return <EmptyState title="No orders yet" hint="When someone buys your craft, it shows up here." />;

  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-earth-slate">{o.listing_title}</p>
            <div className="flex gap-2">
              <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
              {o.needs_refund && <StatusBadge status="rejected" label="Being refunded" />}
            </div>
          </div>
          <p className="text-xs text-earth-muted">
            #{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)} · buyer paid {formatINR(o.amount_paise)} · you get{" "}
            <span className="font-semibold text-emerald-800">{formatINR(o.seller_amount_paise)}</span>
          </p>
          {o.buyer_name ? (
            <p className="mt-2 text-xs">
              <span className="text-earth-muted">Buyer:</span> {o.buyer_name}
              {o.buyer_phone ? ` · ${o.buyer_phone}` : " · (no phone on file — they'll message you)"}
            </p>
          ) : (
            <p className="mt-2 text-xs text-earth-muted">Buyer details appear once payment is confirmed.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function PayoutsTab() {
  const { data: payouts, error } = useLoad(sellerPayouts);
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!payouts) return <Spinner />;
  if (payouts.length === 0) return <EmptyState title="No payouts yet" hint="Each paid order creates a payout to your UPI." />;

  const pending = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount_paise, 0);
  const paid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <span className="text-xs text-earth-muted font-medium">Pending</span>
          <div className="font-editorial text-2xl font-bold text-amber-600">{formatINR(pending)}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs text-earth-muted font-medium">Paid to you</span>
          <div className="font-editorial text-2xl font-bold text-emerald-700">{formatINR(paid)}</div>
        </div>
      </div>
      <ul className="divide-y divide-earth-border rounded-2xl border border-earth-border bg-white">
        {payouts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-earth-slate">{formatINR(p.amount_paise)}</p>
              <p className="text-xs text-earth-muted">
                Order #{p.order_id.slice(0, 8).toUpperCase()} · {formatDate(p.created_at)}
                {p.upi_txn_ref ? ` · UPI ref ${p.upi_txn_ref}` : ""}
              </p>
            </div>
            <StatusBadge status={p.status === "paid" ? "paid" : "pending"} label={p.status === "paid" ? "Paid" : "Pending"} />
          </li>
        ))}
      </ul>
    </div>
  );
}
