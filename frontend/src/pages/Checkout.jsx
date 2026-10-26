import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createOrder, fetchListing, fetchOrder, simulatePayment } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatINR } from "../lib/format";
import { CAMPUS_PICKUP_LOCATIONS, VALID_COUPONS } from "../lib/cart";
import { showToast } from "../lib/toast";
import { EmptyState, Notice, Spinner, useLoad } from "../components/ui";

// Send the buyer to the payment page. In mock mode it's one of our own routes, so stay inside the SPA.
function goToPayment(url, navigate) {
  if (url.includes("/mock-pay/")) {
    const path = url.slice(url.indexOf("/mock-pay/"));
    navigate(path);
  } else if (url.startsWith(window.location.origin)) {
    navigate(url.slice(window.location.origin.length));
  } else {
    window.location.assign(url);
  }
}

export function Checkout() {
  const { listingId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: listing, error: loadError } = useLoad(() => fetchListing(listingId), [listingId]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Phase 2: Campus Pickup & Coupon State
  const [pickupLoc, setPickupLoc] = useState(CAMPUS_PICKUP_LOCATIONS[0].id);
  const [pickupNotes, setPickupNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState(null);

  if (loadError) {
    return (
      <EmptyState title="This craft isn't available" hint="It may have sold or been removed.">
        <Link to="/" className="btn-primary no-underline">
          Back to browse
        </Link>
      </EmptyState>
    );
  }
  if (!listing) return <Spinner label="Loading checkout…" />;

  const isOwnListing = listing.seller.id === user.id;
  const canPay = !isOwnListing;

  // Coupon calculations
  let discountPaise = 0;
  if (appliedCoupon && listing) {
    if (appliedCoupon.type === "percent") {
      discountPaise = Math.round((listing.price_paise * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === "flat") {
      discountPaise = Math.min(listing.price_paise, appliedCoupon.value);
    }
  }
  const totalPayable = Math.max(0, listing.price_paise - discountPaise);

  function handleApplyCoupon(e) {
    e.preventDefault();
    const code = (couponInput || "").trim().toUpperCase();
    if (!code) {
      setCouponMsg({ success: false, message: "Please enter a coupon code." });
      return;
    }
    const found = VALID_COUPONS[code];
    if (!found) {
      setCouponMsg({ success: false, message: `Coupon “${code}” is not valid.` });
      return;
    }
    if (found.minOrderPaise && listing.price_paise < found.minOrderPaise) {
      setCouponMsg({
        success: false,
        message: `Requires minimum order of ₹${(found.minOrderPaise / 100).toLocaleString("en-IN")}.`,
      });
      return;
    }
    setAppliedCoupon(found);
    setCouponMsg({ success: true, message: `Coupon applied: ${found.label}!` });
    showToast(`Saved ₹${Math.round((found.type === "percent" ? (listing.price_paise * found.value) / 100 : found.value) / 100)}!`, "🎉");
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponMsg(null);
    setCouponInput("");
    showToast("Coupon removed", "🏷️");
  }

  async function handlePay() {
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(listing.id);
      if (!order.payment_url) throw new Error("Could not start the payment. Please try again.");
      goToPayment(order.payment_url, navigate);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  const selectedLoc = CAMPUS_PICKUP_LOCATIONS.find((l) => l.id === pickupLoc);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-earth-border">
        <Link
          to={`/listing/${listing.id}`}
          className="text-xs sm:text-sm font-medium text-earth-muted hover:text-earth-slate flex items-center gap-1 no-underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Cancel & Return
        </Link>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
          🔒 Secure Razorpay Checkout
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Who's buying + Campus Handoff Location + Pay */}
        <div className="md:col-span-7 space-y-6">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-earth-slate">Confirm & Pay</h2>
            <p className="text-xs text-earth-muted mt-1 leading-relaxed">
              You'll complete payment securely via Razorpay. Once verified, the artisan's contact details unlock immediately on your order receipt.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-earth-border text-sm space-y-1 shadow-xs">
            <span className="block text-xs font-bold uppercase tracking-wider text-earth-muted">Buyer Profile</span>
            <p className="font-semibold text-earth-slate">{user.full_name}</p>
            <p className="text-xs text-earth-muted">{user.email}</p>
            <p className="text-[11px] text-earth-muted pt-1">
              The maker sees your name and phone number only after payment is confirmed.{" "}
              {!user.phone && (
                <>
                  <Link to="/account" className="text-brand-terracotta hover:underline">Add your phone</Link> so they can message you on WhatsApp.
                </>
              )}
            </p>
          </div>

          {/* Campus Pickup Spot Selector */}
          <div className="p-4 rounded-2xl bg-white border border-earth-border space-y-3 shadow-xs">
            <label htmlFor="checkout-pickup" className="block text-xs font-bold uppercase tracking-wider text-earth-slate">
              📍 Preferred Campus Handoff Spot
            </label>
            <select
              id="checkout-pickup"
              value={pickupLoc}
              onChange={(e) => setPickupLoc(e.target.value)}
              className="w-full bg-[#FAF7F2] border border-earth-border rounded-xl px-3.5 py-2.5 text-xs text-earth-slate font-medium focus:outline-none focus:border-brand-terracotta cursor-pointer"
            >
              {CAMPUS_PICKUP_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
            {selectedLoc?.hint && (
              <p className="text-[11px] text-earth-muted">
                💡 {selectedLoc.hint}
              </p>
            )}

            <div className="pt-2">
              <label htmlFor="checkout-notes" className="block text-xs font-bold uppercase tracking-wider text-earth-slate mb-1">
                Note for Maker <span className="font-normal text-earth-muted lowercase">(optional)</span>
              </label>
              <input
                id="checkout-notes"
                type="text"
                placeholder="e.g. Can meet after 2 PM chemistry lecture"
                maxLength={100}
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                className="w-full bg-white border border-earth-border rounded-xl px-3.5 py-2 text-xs text-earth-slate focus:outline-none focus:border-brand-terracotta"
              />
            </div>
          </div>

          {isOwnListing && <Notice kind="info">This is your own listing — you can't buy it.</Notice>}
          {error && <Notice kind="error">{error}</Notice>}

          <div className="p-4 rounded-2xl bg-[#F5EFEB] border border-earth-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-earth-slate flex items-center gap-1.5">
                <span className="text-blue-700 font-black">Razorpay</span> Secure Gateway
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">UPI Ready</span>
            </div>
            <p className="text-xs text-earth-muted">Google Pay, PhonePe, Paytm, all UPI apps, debit/credit cards & NetBanking.</p>
          </div>

          <button
            type="button"
            onClick={handlePay}
            disabled={submitting || !canPay}
            className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {submitting ? (
              "Starting secure payment…"
            ) : (
              <>
                <span>Proceed to Pay</span>
                <span>{formatINR(totalPayable)}</span>
                <span>via Razorpay →</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Order Summary Card */}
        <div className="md:col-span-5">
          <div className="p-5 rounded-3xl bg-white border border-earth-border shadow-xs sticky top-28 space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate">Order Summary</h3>
            <div className="flex gap-3 pb-4 border-b border-earth-border">
              {listing.images[0] && (
                <img
                  alt={listing.title}
                  className="w-16 h-16 rounded-2xl object-cover bg-brand-clayLight border border-earth-border shadow-xs"
                  src={listing.images[0]}
                />
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-xs sm:text-sm text-earth-slate truncate">{listing.title}</h4>
                <p className="text-xs text-earth-muted mt-0.5">by {listing.seller.display_name}</p>
                <span className="inline-block mt-1 text-[10px] bg-accent-sageLight text-accent-sage font-semibold px-2 py-0.5 rounded">
                  One of a kind
                </span>
              </div>
            </div>

            {/* Promo Code Box */}
            <div className="pb-3 border-b border-earth-border space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-earth-slate">
                Discount Code
              </span>
              {appliedCoupon ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                  <span>🏷️ {appliedCoupon.code}</span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-red-600 hover:underline text-[11px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. STUDENT10"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="flex-1 uppercase bg-white border border-earth-border rounded-xl px-2.5 py-1.5 text-xs text-earth-slate focus:outline-none focus:border-brand-terracotta"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-earth-slate hover:bg-stone-800 text-white text-xs font-semibold shadow-xs"
                  >
                    Apply
                  </button>
                </form>
              )}
              {couponMsg && !appliedCoupon && (
                <p className={`text-[11px] ${couponMsg.success ? "text-emerald-700" : "text-red-600"}`}>
                  {couponMsg.message}
                </p>
              )}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-earth-muted">
                <span>Handmade Item</span>
                <span className="font-medium text-earth-slate">{formatINR(listing.price_paise)}</span>
              </div>

              {discountPaise > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Promo ({appliedCoupon?.code})</span>
                  <span>-{formatINR(discountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between text-earth-muted">
                <span>Campus Handoff</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">FREE</span>
              </div>

              <div className="pt-3 border-t border-earth-border flex justify-between text-sm font-bold text-earth-slate">
                <span>Total payable</span>
                <span className="text-brand-clayDark font-editorial text-xl">{formatINR(totalPayable)}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 text-[11px] text-earth-muted flex items-start gap-2">
              <span>🛡️</span>
              <span>Unpaid checkouts expire after 30 minutes. If someone else buys the item first, you're refunded.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mock payment mode only: stands in for the Razorpay page during development. */
export function MockPay() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const { data: order, error } = useLoad(() => fetchOrder(orderId), [orderId]);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState(null);

  if (error) return <EmptyState title="Order not found" />;
  if (!order) return <Spinner />;

  async function pay() {
    setBusy(true);
    setPayError(null);
    try {
      await simulatePayment(order.id);
      navigate(`/checkout/return?order_id=${order.id}`, { replace: true });
    } catch (e) {
      setPayError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-6 sm:p-8 text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-3 py-1 rounded-full">
          Test mode — no real money
        </span>
        <h1 className="font-editorial text-2xl font-bold text-earth-slate mt-4">Mock Razorpay</h1>
        <p className="text-sm text-earth-muted mt-1">{order.listing_title}</p>
        <p className="font-editorial text-3xl font-bold text-brand-clayDark mt-4">{formatINR(order.amount_paise)}</p>
        {order.status !== "pending_payment" ? (
          <Notice kind="info">This order is already {order.status.replace("_", " ")}.</Notice>
        ) : (
          <button type="button" className="btn-primary w-full mt-6 py-3" disabled={busy} onClick={pay}>
            {busy ? "Paying…" : "Simulate successful payment"}
          </button>
        )}
        {payError && (
          <div className="mt-4">
            <Notice kind="error">{payError}</Notice>
          </div>
        )}
        <Link to={`/orders/${order.id}`} className="block mt-4 text-xs text-earth-muted">
          Cancel and view order
        </Link>
      </div>
    </div>
  );
}

/** Razorpay sends the buyer here. The webhook (not this page) marks the order paid, so wait for it. */
export function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order_id") || params.get("razorpay_payment_link_reference_id") || "";
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setError("No order reference provided. Please check My Orders to see your active orders.");
      return;
    }
    let cancelled = false;
    let tries = 0;
    async function poll() {
      try {
        const o = await fetchOrder(orderId);
        if (cancelled) return;
        if (o.status !== "pending_payment") {
          navigate(`/orders/${o.id}`, { replace: true });
          return;
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
        return;
      }
      if (++tries >= 15) setTimedOut(true);
      else setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [orderId, navigate]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <Notice kind="error">{error}</Notice>
      </div>
    );
  }
  if (timedOut) {
    return (
      <EmptyState
        title="Still waiting for payment confirmation"
        hint="If you completed the payment, it usually confirms within a minute. Your order page will update."
      >
        <Link to={`/orders/${orderId}`} className="btn-primary no-underline">
          View order
        </Link>
      </EmptyState>
    );
  }
  return <Spinner label="Confirming your payment…" />;
}
