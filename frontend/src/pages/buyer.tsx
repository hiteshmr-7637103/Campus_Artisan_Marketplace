import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatINR } from "../lib/format";
import { RatingInput } from "../components/RatingStars";
import { EmptyState, Notice, Spinner, StatusBadge, useLoad } from "../components/ui";
import type { Listing, Order } from "../lib/types";

export function Checkout() {
  const { listingId = "" } = useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fetchListing(listingId).then(setListing).catch((e: api.ApiError) => (e.status === 404 ? setListing(null) : setError(e.message)));
  }, [listingId]);

  if (loading || listing === undefined) return error ? <Notice>{error}</Notice> : <Spinner />;
  if (listing === null) return <EmptyState title="This item is no longer available" hint="It may have just sold." />;
  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <Notice kind="info">Please <Link to="/login" state={{ from: `/checkout/${listingId}` }}>log in</Link> or <Link to="/signup">sign up</Link> to buy.</Notice>
      </div>
    );
  }

  async function pay() {
    setBusy(true); setError(null);
    try {
      const order = await api.createOrder(listingId);
      if (order.payment_url?.startsWith(window.location.origin)) nav(new URL(order.payment_url).pathname);
      else window.location.assign(order.payment_url ?? `/orders/${order.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Order summary</h1>
      <div className="card flex gap-3 p-3">
        {listing.images[0] && <img src={listing.images[0]} alt="" className="h-20 w-20 rounded-lg object-cover" />}
        <div>
          <p className="font-medium">{listing.title}</p>
          <p className="text-sm text-ink/60">by {listing.seller.display_name}</p>
          <p className="mt-1 font-semibold">{formatINR(listing.price_paise)}</p>
        </div>
      </div>
      {!user.email_verified && <div className="mt-4"><Notice kind="info">Verify your email before paying — check your inbox.</Notice></div>}
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}
      <button className="btn-primary mt-4 w-full" disabled={busy || !user.email_verified} onClick={pay}>
        {busy ? "Starting payment…" : `Pay ${formatINR(listing.price_paise)}`}
      </button>
      <p className="mt-2 text-xs text-ink/50">You'll be taken to a secure payment page. Seller contact details unlock once payment is confirmed.</p>
    </div>
  );
}

/** Polls the API for the real order status. Never trusts anything in the URL. */
export function CheckoutReturn() {
  const [params] = useSearchParams();
  const id = params.get("order_id") ?? "";
  const [order, setOrder] = useState<Error | Order | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const o = await api.fetchOrder(id);
        if (stop) return;
        setOrder(o);
        if (o.status !== "pending_payment") return;
      } catch (e) { if (!stop) setOrder(e as api.ApiError); return; }
      tries.current += 1;
      if (tries.current < 30) setTimeout(tick, 2000);
    };
    void tick();
    return () => { stop = true; };
  }, [id]);

  if (!order) return <Spinner label="Confirming your payment…" />;
  if (order instanceof Error) return <Notice>{order.message}</Notice>;
  if (order.status === "pending_payment") {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <Notice kind="info">Payment is still processing. This can take a minute. You can safely leave this page — we'll email you when it's confirmed.</Notice>
        <Link to={`/orders/${order.id}`} className="btn-ghost no-underline">View order</Link>
      </div>
    );
  }
  return <Navigate to={`/orders/${order.id}`} replace />;
}

/** Fake checkout page; only works when the API runs with PAYMENT_MODE=mock. */
export function MockPay() {
  const { orderId = "" } = useParams();
  const nav = useNavigate();
  const { data: order, error } = useLoad(() => api.fetchOrder(orderId), [orderId]);
  const [err, setErr] = useState<string | null>(null);
  if (error) return <Notice>{error}</Notice>;
  if (!order) return <Spinner />;
  return (
    <div className="mx-auto max-w-sm">
      <Notice kind="info">Demo payment page — no real money moves.</Notice>
      <div className="card mt-4 p-4">
        <p className="font-medium">{order.listing_title}</p>
        <p className="mt-1 text-xl font-semibold">{formatINR(order.amount_paise)}</p>
        {err && <div className="mt-3"><Notice>{err}</Notice></div>}
        <button className="btn-primary mt-4 w-full" onClick={async () => {
          try { await api.simulatePayment(order.id); nav(`/checkout/return?order_id=${order.id}`); } catch (e) { setErr((e as Error).message); }
        }}>Simulate successful payment</button>
      </div>
    </div>
  );
}

export function Orders() {
  const { data, error } = useLoad(api.fetchOrders);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <Spinner />;
  if (data.length === 0) return <EmptyState title="No orders yet" hint="Items you buy will show up here." />;
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My orders</h1>
      <ul className="space-y-3">
        {data.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="card flex items-center gap-3 p-3 no-underline">
              {o.listing_image && <img src={o.listing_image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-medium">{o.listing_title}</p>
                <p className="text-xs text-ink/60">{formatDate(o.created_at)} · {formatINR(o.amount_paise)}</p>
              </div>
              <StatusBadge status={o.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OrderDetail() {
  const { id = "" } = useParams();
  const { data: o, error, reload } = useLoad(() => api.fetchOrder(id), [id]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (error) return <EmptyState title="Order not found" />;
  if (!o) return <Spinner />;

  async function submitReview(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try { setMsg((await api.reviewOrder(id, rating, comment.trim())).message); await reload(); }
    catch (x) { setErr((x as Error).message); }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Order</h1>
      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between"><p className="font-medium">{o.listing_title}</p><StatusBadge status={o.status} /></div>
        <p className="text-sm text-ink/70">{formatINR(o.amount_paise)} · sold by <Link to={`/seller/${o.seller_id}`}>{o.seller_name}</Link></p>
        <p className="text-xs text-ink/50">Placed {formatDate(o.created_at)}{o.paid_at ? ` · paid ${formatDate(o.paid_at)}` : ""}</p>
      </div>

      {o.status === "pending_payment" && o.payment_url && (
        <a href={o.payment_url} className="btn-primary w-full no-underline">Continue to payment</a>
      )}
      {o.needs_refund && <Notice kind="info">This item sold to someone else first (or the amount didn't match). We'll refund you manually — contact us if it takes more than a few days.</Notice>}
      {o.seller_contact && (
        <div className="card p-4 text-sm">
          <h2 className="mb-1 font-semibold">Seller contact</h2>
          <p>{o.seller_contact.display_name}</p>
          <p>Phone: <a href={`tel:${o.seller_contact.phone}`}>{o.seller_contact.phone}</a></p>
          {o.seller_contact.instagram && <p>Instagram: {o.seller_contact.instagram}</p>}
          <p className="mt-2 text-xs text-ink/50">Arrange the handover directly with the seller.</p>
        </div>
      )}
      {o.status === "fulfilled" && !o.reviewed && (
        <form onSubmit={submitReview} className="card space-y-3 p-4">
          <h2 className="font-semibold">How was it?</h2>
          {err && <Notice>{err}</Notice>}
          <RatingInput value={rating} onChange={setRating} />
          <textarea className="field-input" rows={3} maxLength={1000} placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-primary">Submit review</button>
        </form>
      )}
      {(o.reviewed || msg) && <Notice kind="success">{msg ?? "Thanks — you've reviewed this order."}</Notice>}
    </div>
  );
}
