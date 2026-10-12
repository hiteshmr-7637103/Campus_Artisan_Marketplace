import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { claimOrders, getOrderByToken, submitReview } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import type { OrderView } from "../lib/types";
import { formatINR } from "../lib/format";
import { RatingInput } from "../components/RatingStars";
import { EmptyState, Notice, Spinner } from "../components/ui";

const STEPS: Array<{ key: OrderView["status"]; label: string }> = [
  { key: "placed", label: "Placed" },
  { key: "paid", label: "Paid" },
  { key: "fulfilled", label: "Fulfilled" },
];

export function OrderStatus() {
  const { token = "" } = useParams();
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const o = await getOrderByToken(token);
      setOrder(o);
      return o;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this order.");
      return null;
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // If we just came back from a magic-link login, attach guest orders.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) claimOrders().catch(() => {});
    });
  }, []);

  // Poll while payment is still pending (webhook may be seconds behind the redirect).
  useEffect(() => {
    if (order?.status === "placed") {
      pollRef.current = window.setInterval(() => void load(), 4000);
      return () => {
        if (pollRef.current) window.clearInterval(pollRef.current);
      };
    }
  }, [order?.status, load]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (order === undefined) return <Spinner label="Loading your order…" />;
  if (order === null) {
    return <EmptyState title="Order not found" hint="Double-check the link from your email." />;
  }

  const currentIdx = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">Your order</h1>
      <p className="mt-1 text-sm text-ink/60">Ref {order.id.slice(0, 8)}</p>

      {order.status === "cancelled" ? (
        <div className="mt-4">
          <Notice kind="info">This checkout was cancelled or expired. You were not charged.</Notice>
        </div>
      ) : (
        <ol className="mt-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i <= currentIdx ? "bg-ink text-white" : "bg-ink/10 text-ink/50"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${i <= currentIdx ? "font-medium" : "text-ink/50"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-ink/15" />}
            </li>
          ))}
        </ol>
      )}

      <div className="card mt-5 flex items-center gap-3 p-3">
        <img
          src={order.listing.photo_urls[0]}
          alt={order.listing.title}
          className="h-16 w-16 rounded-lg object-cover"
        />
        <div className="flex-1">
          <p className="font-medium">{order.listing.title}</p>
          <p className="text-sm text-ink/60">
            {order.fulfillment_method === "delivery" ? "Campus delivery" : "Campus pickup"}
            {order.delivery_point ? ` · ${order.delivery_point}` : ""}
          </p>
        </div>
        <p className="font-semibold">{formatINR(order.amount_total)}</p>
      </div>

      {order.status === "placed" && (
        <div className="mt-4 space-y-2">
          <Notice kind="info">
            Waiting for payment confirmation. If you've just paid, this updates automatically
            within a minute.
          </Notice>
          <button className="btn-ghost w-full" onClick={() => void load()}>
            Check again
          </button>
        </div>
      )}

      {order.artisan && (
        <div className="card mt-4 p-4">
          <h2 className="text-sm font-semibold">Artisan contact</h2>
          <p className="mt-1 text-sm">{order.artisan.name}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink/80">
            {order.artisan.contact_phone && <li>Phone: {order.artisan.contact_phone}</li>}
            {order.artisan.contact_email && <li>Email: {order.artisan.contact_email}</li>}
            {order.artisan.instagram && <li>Instagram: {order.artisan.instagram}</li>}
            {order.artisan.contact_raw && <li>{order.artisan.contact_raw}</li>}
          </ul>
          <p className="mt-2 text-xs text-ink/50">
            The founders will also coordinate the handoff and settle the artisan's share.
          </p>
        </div>
      )}

      {(order.status === "paid" || order.status === "fulfilled") && <SaveOrderCta email={order.buyer_email} />}

      {order.can_review && (
        <ReviewForm token={token} onDone={() => void load()} />
      )}
      {order.has_review && (
        <div className="mt-4">
          <Notice kind="success">Thanks for your review!</Notice>
        </div>
      )}
    </div>
  );
}

function SaveOrderCta({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSent(false);
    });
  }, []);

  async function send() {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-4">
        <Notice kind="success">
          Check {email} for a one-tap link to see all your orders in one place.
        </Notice>
      </div>
    );
  }

  return (
    <div className="card mt-4 p-4">
      <h2 className="text-sm font-semibold">Keep track of your orders (optional)</h2>
      <p className="mt-1 text-sm text-ink/70">
        We can email {email} a magic link — no password — that ties your orders together.
      </p>
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <button className="btn-ghost mt-3" onClick={send} disabled={busy}>
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </div>
  );
}

function ReviewForm({ token, onDone }: { token: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setErr("Please pick a star rating.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await submitReview(token, rating, comment.trim());
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit your review.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-4 p-4">
      <h2 className="text-sm font-semibold">Rate this artisan</h2>
      <div className="mt-2">
        <RatingInput value={rating} onChange={setRating} />
      </div>
      <label htmlFor="comment" className="field-label mt-3">Comment (optional)</label>
      <textarea
        id="comment"
        className="field-input"
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {err && <div className="mt-2"><Notice kind="error">{err}</Notice></div>}
      <button type="submit" className="btn-primary mt-3" disabled={busy}>
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
