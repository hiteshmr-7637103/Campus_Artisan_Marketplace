import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createOrder, fetchListing } from "../lib/api";
import type { FulfillmentMethod, PublicListing } from "../lib/types";
import { formatINR } from "../lib/format";
import { EmptyState, Notice, Spinner } from "../components/ui";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-() ]{6,20}$/;

export function Checkout() {
  const { listingId = "" } = useParams();

  const [listing, setListing] = useState<PublicListing | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<FulfillmentMethod>("pickup");
  const [point, setPoint] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchListing(listingId)
      .then(setListing)
      .catch((e) => setLoadError(e.message));
  }, [listingId]);

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if (listing === undefined) return <Spinner />;
  if (listing === null) return <EmptyState title="Item not found" />;
  if (listing.status !== "active") {
    return (
      <EmptyState
        title="This item is no longer available"
        hint="It looks like it just sold."
      />
    );
  }

  const clientError = (): string | null => {
    if (name.trim().length < 1) return "Please enter your name.";
    if (!PHONE_RE.test(phone.trim())) return "Please enter a valid phone number.";
    if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
    if (method === "delivery" && point.trim().length < 1) {
      return "Please say where on campus to deliver.";
    }
    return null;
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const err = clientError();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrder({
        listing_id: listingId,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_email: email.trim(),
        fulfillment_method: method,
        delivery_point: point.trim() || undefined,
        delivery_time: time.trim() || undefined,
        delivery_notes: notes.trim() || undefined,
      });
      // remember so the buyer can find their order again on this device
      try {
        const seen = JSON.parse(localStorage.getItem("orderTokens") ?? "[]");
        localStorage.setItem("orderTokens", JSON.stringify([res.access_token, ...seen].slice(0, 20)));
      } catch { /* ignore */ }
      window.location.href = res.short_url;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link to={`/listing/${listing.id}`} className="text-sm no-underline hover:underline">
        ← Back to item
      </Link>

      <div className="card mt-3 flex items-center gap-3 p-3">
        <img
          src={listing.photo_urls[0]}
          alt={listing.title}
          className="h-16 w-16 rounded-lg object-cover"
        />
        <div className="flex-1">
          <p className="font-medium">{listing.title}</p>
          <p className="text-sm text-ink/60">By {listing.artisan_name ?? "a campus artisan"}</p>
        </div>
        <p className="text-lg font-semibold">{formatINR(listing.price_buyer)}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="field-label">Your name</label>
          <input id="name" className="field-input" value={name}
            onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="field-label">Phone</label>
            <input id="phone" className="field-input" value={phone} inputMode="tel"
              onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" type="email" className="field-input" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">How do you want it?</legend>
          <div className="flex gap-2">
            {(["pickup", "delivery"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={`btn flex-1 ${method === m ? "bg-ink text-white" : "border border-ink/20"}`}>
                {m === "pickup" ? "Campus pickup" : "Campus delivery"}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="point" className="field-label">
            {method === "delivery" ? "Delivery point on campus" : "Pickup preference (optional)"}
          </label>
          <input id="point" className="field-input" value={point}
            onChange={(e) => setPoint(e.target.value)}
            placeholder={method === "delivery" ? "e.g. Hostel B, room 214" : "e.g. near the library"} />
          <p className="mt-1 text-xs text-ink/50">
            A campus map picker is coming soon — free text is fine for now.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="time" className="field-label">Preferred time (optional)</label>
            <input id="time" className="field-input" value={time}
              onChange={(e) => setTime(e.target.value)} placeholder="e.g. after 5pm weekdays" />
          </div>
          <div>
            <label htmlFor="notes" className="field-label">Notes (optional)</label>
            <input id="notes" className="field-input" value={notes}
              onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {submitError && <Notice kind="error">{submitError}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Starting secure checkout…" : `Pay ${formatINR(listing.price_buyer)} with Razorpay`}
        </button>
        <p className="text-center text-xs text-ink/50">
          You'll be taken to Razorpay's secure page. No account needed.
        </p>
      </form>
    </div>
  );
}
