import { useCallback, useEffect, useMemo, useState } from "react";
import {
  artisansById,
  listOrders,
  markFulfilled,
  setPayout,
} from "../../lib/admin";
import { formatINR, formatDate } from "../../lib/format";
import { EmptyState, Notice, Spinner } from "../../components/ui";

const STATUS_FILTERS = ["all", "paid", "fulfilled", "placed", "cancelled"];

export function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [artisans, setArtisans] = useState({});
  const [filter, setFilter] = useState("paid");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [o, a] = await Promise.all([listOrders(), artisansById()]);
      setOrders(o);
      setArtisans(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load orders.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const all = orders ?? [];
    const started = all.filter((o) => o.status !== "cancelled" || o.paid_at).length;
    const paid = all.filter((o) => o.status === "paid" || o.status === "fulfilled").length;
    return {
      total: all.length,
      started,
      paid,
      fulfilled: all.filter((o) => o.status === "fulfilled").length,
      conversion: started ? Math.round((paid / started) * 100) : 0,
      revenue: all
        .filter((o) => o.status === "paid" || o.status === "fulfilled")
        .reduce((s, o) => s + o.amount_commission, 0),
      owed: all
        .filter((o) => (o.status === "paid" || o.status === "fulfilled") && !o.payout_done)
        .reduce((s, o) => s + o.amount_artisan, 0),
    };
  }, [orders]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (orders === null) return <Spinner />;

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orders started" value={String(stats.started)} />
        <Stat label="Paid" value={`${stats.paid} (${stats.conversion}%)`} />
        <Stat label="Commission earned" value={formatINR(stats.revenue)} />
        <Stat label="Owed to artisans" value={formatINR(stats.owed)} />
      </div>

      {notice && (
        <div className="mt-4">
          <Notice kind="success">{notice}</Notice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`btn px-3 py-1.5 text-sm ${
              filter === f ? "bg-earth-slate text-white" : "border border-earth-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No orders in this view" />
      ) : (
        <ul className="mt-4 space-y-4">
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              artisan={o.listings?.artisan_id ? artisans[o.listings.artisan_id] : undefined}
              onChange={refresh}
              onNotice={setNotice}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-earth-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}

function OrderRow({ order, artisan, onChange, onNotice }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [payoutRef, setPayoutRef] = useState(order.payout_reference ?? "");
  const paidOrLater = order.status === "paid" || order.status === "fulfilled";

  async function fulfil() {
    setBusy(true);
    setErr(null);
    try {
      const { emailed } = await markFulfilled(order.id);
      onNotice(
        emailed
          ? "Marked fulfilled — review prompt emailed."
          : "Marked fulfilled (email not sent — check Resend config)."
      );
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not mark fulfilled.");
      setBusy(false);
    }
  }

  async function savePayout(done) {
    setBusy(true);
    setErr(null);
    try {
      await setPayout(order.id, done, payoutRef.trim());
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save payout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium">{order.listings?.title ?? "—"}</h3>
        <span className="rounded bg-earth-border/40 px-2 py-0.5 text-xs font-medium">
          {order.status}
        </span>
      </div>
      <p className="text-xs text-earth-muted">
        Ref {order.id.slice(0, 8)} · {formatDate(order.created_at)}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-earth-muted">Buyer</p>
          <p>{order.buyer_name}</p>
          <p>
            {order.buyer_phone} · {order.buyer_email}
          </p>
          <p className="mt-1 text-earth-muted">
            {order.fulfillment_method === "delivery" ? "Delivery" : "Pickup"}
            {order.delivery_point ? ` · ${order.delivery_point}` : ""}
            {order.delivery_time ? ` · ${order.delivery_time}` : ""}
          </p>
          {order.delivery_notes && <p className="text-earth-muted">Note: {order.delivery_notes}</p>}
        </div>
        <div>
          <p className="text-earth-muted">Artisan</p>
          {paidOrLater ? (
            artisan ? (
              <>
                <p>{artisan.name}</p>
                {artisan.contact_phone && <p>{artisan.contact_phone}</p>}
                {artisan.contact_email && <p>{artisan.contact_email}</p>}
                {artisan.instagram && <p>{artisan.instagram}</p>}
              </>
            ) : (
              <p className="text-earth-muted">Not linked</p>
            )
          ) : (
            <p className="text-earth-muted/60">Revealed after payment</p>
          )}
          <div className="mt-2">
            <p className="text-earth-muted">Amounts</p>
            <p>
              Buyer paid {formatINR(order.amount_total)} · commission {formatINR(order.amount_commission)} · artisan{" "}
              {formatINR(order.amount_artisan)}
            </p>
            {order.razorpay_payment_id && (
              <p className="text-earth-muted">Razorpay: {order.razorpay_payment_id}</p>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-3">
          <Notice kind="error">{err}</Notice>
        </div>
      )}

      {paidOrLater && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-earth-border pt-3">
          {order.status === "paid" && (
            <button className="btn-primary" onClick={fulfil} disabled={busy}>
              {busy ? "Working…" : "Mark fulfilled"}
            </button>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={order.payout_done}
              disabled={busy}
              onChange={(e) => savePayout(e.target.checked)}
            />
            Artisan paid
          </label>
          <input
            className="field-input max-w-[200px]"
            placeholder="payout ref (UPI txn)"
            value={payoutRef}
            onChange={(e) => setPayoutRef(e.target.value)}
            onBlur={() => {
              if ((order.payout_reference ?? "") !== payoutRef.trim()) savePayout(order.payout_done);
            }}
          />
        </div>
      )}
    </li>
  );
}
