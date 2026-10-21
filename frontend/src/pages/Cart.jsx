import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, CAMPUS_PICKUP_LOCATIONS } from "../lib/cart";
import { useWishlist } from "../lib/wishlist";
import { useAuth } from "../lib/auth";
import { formatINR } from "../lib/format";

export function Cart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    removeFromCart,
    clearCart,
    subtotalPaise,
    discountPaise,
    totalPayablePaise,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    pickupLocation,
    setPickupLocation,
    pickupNotes,
    setPickupNotes,
  } = useCart();

  const { toggleWishlist, isWishlisted } = useWishlist();
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState(null);

  function handleApplyCoupon(e) {
    e.preventDefault();
    const res = applyCoupon(couponInput);
    setCouponMsg(res);
  }

  function handleSaveForLater(item) {
    if (!isWishlisted(item.id)) {
      toggleWishlist(item);
    }
    removeFromCart(item.id);
  }

  function handleProceedToCheckout() {
    if (items.length === 0) return;
    if (!user) {
      navigate("/login", { state: { from: `/checkout/${items[0].id}` } });
      return;
    }
    // Proceed to checkout with the craft
    navigate(`/checkout/${items[0].id}`);
  }

  const selectedLocObj = CAMPUS_PICKUP_LOCATIONS.find((l) => l.id === pickupLocation);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-earth-border mb-8">
        <div>
          <span className="rounded-full bg-brand-clayLight px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-terracotta">
            Your Bag
          </span>
          <h1 className="mt-3 font-editorial text-3xl sm:text-4xl font-bold text-earth-slate">
            Shopping Cart
          </h1>
          <p className="mt-1 text-sm text-earth-muted">
            {items.length === 1
              ? "1 unique craft ready for campus handoff"
              : `${items.length} unique crafts ready for campus handoff`}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-xs text-earth-muted hover:text-red-600 transition-colors self-start sm:self-auto font-medium"
          >
            Empty bag
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-dashed border-earth-border shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-clayLight text-brand-terracotta flex items-center justify-center text-3xl shadow-xs">
            🛍️
          </div>
          <h2 className="font-editorial text-2xl font-bold text-earth-slate">
            Your shopping bag is empty
          </h2>
          <p className="text-sm text-earth-muted max-w-md mx-auto mt-2 leading-relaxed">
            Looking for something special? Discover authentic handmade jewelry, planters, and artwork created by fellow students.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg no-underline active:scale-95"
            >
              <span>Browse Campus Crafts</span>
              <span>→</span>
            </Link>
            <Link
              to="/wishlist"
              className="btn-ghost no-underline text-sm"
            >
              View Saved Wishlist
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Cart Items List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-3 rounded-2xl bg-accent-sageLight border border-accent-sage/20 text-xs text-accent-sage flex items-center gap-2">
              <span className="text-base">📍</span>
              <span>All items are exchanged directly in person between classes. Zero shipping fees.</span>
            </div>

            {items.map((item) => {
              const img = item.images?.[0];
              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-3xl bg-white border border-earth-border shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Link
                      to={`/listing/${item.id}`}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-brand-clayLight overflow-hidden shrink-0 border border-earth-border block"
                    >
                      {img ? (
                        <img src={img} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🧺</div>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-earth-muted uppercase tracking-wider block">
                        by {item.seller?.display_name || "Student Maker"}
                      </span>
                      <Link
                        to={`/listing/${item.id}`}
                        className="font-editorial text-base sm:text-lg font-bold text-earth-slate hover:text-brand-terracotta transition-colors truncate block no-underline"
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          1-of-1 Unique
                        </span>
                        {item.category && (
                          <span className="text-[10px] text-earth-muted">
                            • {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-earth-border/60 gap-2 shrink-0">
                    <span className="font-editorial text-lg sm:text-xl font-bold text-brand-clayDark">
                      {formatINR(item.price_paise)}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => handleSaveForLater(item)}
                        className="text-earth-muted hover:text-brand-terracotta font-medium transition-colors"
                      >
                        Save for later
                      </button>
                      <span className="text-earth-border">•</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-earth-muted hover:text-red-600 font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Order Summary, Pickup Selector, and Coupon Box */}
          <div className="lg:col-span-5">
            <div className="p-6 rounded-3xl bg-white border border-earth-border shadow-xs sticky top-28 space-y-6">
              <h3 className="font-editorial text-xl font-bold text-earth-slate">
                Order Summary
              </h3>

              {/* Campus Meeting Spot Selector */}
              <div className="space-y-1.5">
                <label htmlFor="pickup-loc" className="block text-xs font-bold uppercase tracking-wider text-earth-slate">
                  Campus Pickup Spot
                </label>
                <select
                  id="pickup-loc"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-earth-border rounded-xl px-3.5 py-2.5 text-xs text-earth-slate font-medium focus:outline-none focus:border-brand-terracotta shadow-xs cursor-pointer"
                >
                  {CAMPUS_PICKUP_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.label}
                    </option>
                  ))}
                </select>
                {selectedLocObj?.hint && (
                  <p className="text-[11px] text-earth-muted mt-1 leading-normal">
                    💡 {selectedLocObj.hint}
                  </p>
                )}
              </div>

              {/* Optional Handoff Notes */}
              <div className="space-y-1.5">
                <label htmlFor="pickup-notes" className="block text-xs font-bold uppercase tracking-wider text-earth-slate">
                  Handoff Note for Maker <span className="font-normal text-earth-muted lowercase">(optional)</span>
                </label>
                <input
                  id="pickup-notes"
                  type="text"
                  placeholder="e.g. Free after 3 PM near foyer"
                  maxLength={100}
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  className="w-full bg-white border border-earth-border rounded-xl px-3.5 py-2 text-xs text-earth-slate focus:outline-none focus:border-brand-terracotta shadow-xs"
                />
              </div>

              {/* Promo Coupon Box */}
              <div className="pt-4 border-t border-earth-border space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-earth-slate">
                  Discount Code
                </label>
                {appliedCoupon ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>
                        {appliedCoupon.code} ({appliedCoupon.label})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-red-600 hover:underline font-bold text-[11px]"
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
                      className="flex-1 uppercase bg-white border border-earth-border rounded-xl px-3 py-2 text-xs text-earth-slate font-medium focus:outline-none focus:border-brand-terracotta shadow-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-earth-slate hover:bg-stone-800 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all"
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
                <p className="text-[10px] text-earth-muted">
                  Tip: Use <strong className="text-earth-slate">STUDENT10</strong> for 10% off your campus craft!
                </p>
              </div>

              {/* Price Breakdown */}
              <div className="pt-4 border-t border-earth-border space-y-2.5 text-xs">
                <div className="flex justify-between text-earth-muted">
                  <span>Crafts Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                  <span className="font-semibold text-earth-slate">{formatINR(subtotalPaise)}</span>
                </div>

                {discountPaise > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span>-{formatINR(discountPaise)}</span>
                  </div>
                )}

                <div className="flex justify-between text-earth-muted">
                  <span>Campus In-Person Handoff</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">FREE</span>
                </div>

                <div className="pt-3 border-t border-earth-border flex justify-between text-base font-bold text-earth-slate">
                  <span>Total Payable</span>
                  <span className="text-brand-clayDark font-editorial text-2xl">
                    {formatINR(totalPayablePaise)}
                  </span>
                </div>
              </div>

              {/* Checkout CTA */}
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Pay</span>
                <span>•</span>
                <span>{formatINR(totalPayablePaise)}</span>
              </button>

              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/60 text-[11px] text-earth-muted space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-earth-slate">
                  <span>🛡️</span>
                  <span>Direct Collegiate Protection</span>
                </div>
                <p>
                  Payments are processed on Razorpay. Funds are held safely until you coordinate and complete the handoff with your fellow student.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
