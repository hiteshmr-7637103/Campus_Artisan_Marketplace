import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOrder, fetchOrders, reviewOrder } from "../lib/api";
import { formatDate, formatINR } from "../lib/format";
import { ORDER_STATUS_LABEL } from "../lib/types";
import { showToast } from "../lib/toast";
import { RatingInput } from "../components/RatingStars";
import { EmptyState, Notice, PageHeader, Spinner, StatusBadge, useLoad } from "../components/ui";

export function Orders() {
  const { data: orders, error } = useLoad(fetchOrders);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <PageHeader eyebrow="Purchases" title="My Orders" />
      {error && <Notice kind="error">{error.message}</Notice>}
      {!error && !orders && <Spinner />}
      {orders?.length === 0 && (
        <EmptyState title="No orders yet" hint="Crafts you buy will show up here.">
          <Link to="/" className="btn-primary no-underline">
            Browse crafts
          </Link>
        </EmptyState>
      )}
      {orders && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-earth-border shadow-xs no-underline hover:border-brand-terracotta/40 transition-colors"
              >
                {o.listing_image ? (
                  <img src={o.listing_image} alt="" className="w-16 h-16 rounded-xl object-cover bg-brand-clayLight" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-brand-clayLight" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-earth-slate truncate">{o.listing_title}</p>
                  <p className="text-xs text-earth-muted">
                    by {o.seller_name} · {formatDate(o.created_at)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                    {o.needs_refund && <StatusBadge status="rejected" label="Refund due" />}
                  </div>
                </div>
                <span className="font-editorial text-lg font-bold text-brand-clayDark">{formatINR(o.amount_paise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function whatsappUrl(phone, title) {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) digits = `91${digits}`; // assume an Indian mobile number
  const text = `Hi! I just bought "${title}" on CampCraft. When can we meet for the handoff?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Stepper({ status }) {
  const done = { paid: 1, fulfilled: 3 }[status] ?? 0;
  const steps = [
    ["Paid", "Payment confirmed"],
    ["Handoff", "Meet the artisan"],
    ["Fulfilled", "Confirmed by admin"],
  ];
  return (
    <div className="p-4 sm:p-6 rounded-3xl bg-white border border-earth-border shadow-xs mb-8">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        {steps.map(([label, sub], i) => {
          const complete = i < done;
          const current = i === done;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                    complete ? "bg-emerald-700 text-white" : current ? "bg-brand-terracotta text-white" : "bg-stone-100 text-stone-400"
                  }`}
                >
                  {complete ? "✓" : i + 1}
                </div>
                <span className={`font-semibold text-center ${complete ? "text-emerald-900" : current ? "text-brand-terracotta" : "text-stone-400"}`}>
                  {label}
                </span>
                <span className="text-[10px] text-earth-muted text-center">{sub}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${complete ? "bg-emerald-600" : "bg-stone-200"}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewForm({ orderId, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!rating) {
      setError("Pick a rating from 1 to 5 stars.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await reviewOrder(orderId, rating, comment.trim());
      showToast(r.message, "🌟");
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-earth-muted">How was the craft and the handoff? Your rating builds the artisan's campus reputation.</p>
      <RatingInput value={rating} onChange={setRating} />
      <textarea
        className="field-input"
        placeholder="Write a short review (optional)…"
        maxLength={1000}
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <Notice kind="error">{error}</Notice>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const { data: order, error, reload } = useLoad(() => fetchOrder(id), [id]);

  if (error) {
    return (
      <EmptyState title="Order not found">
        <Link to="/orders" className="btn-primary no-underline">
          My orders
        </Link>
      </EmptyState>
    );
  }
  if (!order) return <Spinner label="Finding your order…" />;

  const contact = order.seller_contact;
  const ref = order.id.slice(0, 8).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center mb-8">
        <StatusBadge status={order.status} label={ORDER_STATUS_LABEL[order.status]} />
        <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-earth-slate mt-3">{order.listing_title}</h1>
        <p className="text-xs sm:text-sm text-earth-muted mt-2">
          Order <span className="font-mono font-bold text-earth-slate">#{ref}</span> · placed {formatDate(order.created_at)}
        </p>
      </div>

      {order.status === "pending_payment" && (
        <div className="mb-8 space-y-3">
          <Notice kind="warn">
            This order isn't paid yet. Unpaid orders expire 30 minutes after checkout.
          </Notice>
          {order.payment_url && (
            <a href={order.payment_url} className="btn-primary w-full py-3 no-underline">
              Complete payment — {formatINR(order.amount_paise)}
            </a>
          )}
        </div>
      )}
      {order.needs_refund && (
        <div className="mb-8">
          <Notice kind="warn">
            Your payment was received, but the item had already sold or the checkout had expired. You'll be refunded to
            your original payment method — no action needed.
          </Notice>
        </div>
      )}
      {order.status === "cancelled" && (
        <div className="mb-8">
          <Notice kind="info">This checkout was cancelled or expired without payment.</Notice>
        </div>
      )}
      {order.status === "refunded" && (
        <div className="mb-8">
          <Notice kind="info">This order was refunded.</Notice>
        </div>
      )}

      {(order.status === "paid" || order.status === "fulfilled") && !order.needs_refund && <Stepper status={order.status} />}

      {/* Unlocked artisan contact */}
      {contact && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FEF8EA] to-[#FDF4E2] border-2 border-accent-ochre shadow-md relative overflow-hidden mb-8">
          <div className="absolute top-3 right-3 text-2xl opacity-40">🔓</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold mb-3">
            <span>🎉</span> ARTISAN CONTACT UNLOCKED
          </div>
          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-earth-slate">Arrange your campus handoff</h2>
          <p className="text-xs sm:text-sm text-earth-muted mt-1">Message the artisan to agree a time and spot.</p>

          <div className="mt-6 p-4 rounded-2xl bg-white/90 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-earth-muted">Student Artisan</div>
              <div className="font-editorial text-lg font-bold text-earth-slate">{contact.display_name}</div>
              <div className="text-xs font-mono font-medium text-earth-slate mt-1">
                📱 <span className="font-bold text-brand-clayDark">{contact.phone}</span>
              </div>
              {contact.instagram && <div className="text-xs text-earth-muted mt-0.5">📸 Instagram: {contact.instagram}</div>}
            </div>
            <div className="w-full sm:w-auto flex flex-col gap-2">
              <a
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all no-underline"
                href={whatsappUrl(contact.phone, order.listing_title)}
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Chat on WhatsApp
              </a>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-earth-border bg-white text-xs text-earth-slate hover:bg-stone-50"
                onClick={() => {
                  navigator.clipboard?.writeText(contact.phone).catch(() => {});
                  showToast("Phone number copied", "📋");
                }}
              >
                Copy phone number
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt */}
      <div className="p-6 rounded-3xl bg-white border border-earth-border space-y-4 mb-8">
        <h3 className="font-bold text-sm text-earth-slate uppercase tracking-wider">Receipt</h3>
        <div className="flex items-center gap-3 py-2 border-b border-earth-border text-sm">
          {order.listing_image && <img src={order.listing_image} alt="" className="w-12 h-12 rounded-lg object-cover" />}
          <Link to={`/listing/${order.listing_id}`} className="flex-1 text-earth-slate font-medium">
            {order.listing_title}
          </Link>
          <span className="font-bold text-earth-slate">{formatINR(order.amount_paise)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-earth-muted">
          <div>
            <span className="block font-semibold text-earth-slate">Artisan</span>
            <Link to={`/seller/${order.seller_id}`}>{order.seller_name}</Link>
          </div>
          <div>
            <span className="block font-semibold text-earth-slate">Paid on</span>
            {order.paid_at ? formatDate(order.paid_at) : "—"}
          </div>
        </div>
      </div>

      {/* Review */}
      {order.status === "fulfilled" && (
        <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-earth-border">
          <span className="text-xs font-bold uppercase text-accent-sage">Post-handoff feedback</span>
          <div className="mt-3">
            {order.reviewed ? (
              <p className="text-center py-2 text-emerald-800 font-semibold text-sm">✨ Thanks for reviewing this artisan!</p>
            ) : (
              <ReviewForm orderId={order.id} onDone={reload} />
            )}
          </div>
        </div>
      )}

      <div className="text-center mt-8">
        <Link
          to="/orders"
          className="inline-block px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-earth-slate font-semibold text-sm transition-colors no-underline"
        >
          ← All my orders
        </Link>
      </div>
    </div>
  );
}
