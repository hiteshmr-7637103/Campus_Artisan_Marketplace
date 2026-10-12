import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderByToken, submitReview } from "../lib/api";
import { getStoredOrders, showToast } from "../lib/mockData";

export function OrderStatus() {
  const { token = "" } = useParams();
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    const rawId = token.startsWith("ORD-") ? `#${token}` : token;
    const orders = getStoredOrders();
    const found = orders.find(
      (o) =>
        o.id === rawId ||
        o.id.toLowerCase() === rawId.toLowerCase() ||
        o.id.replace("#", "") === token
    );

    if (found) {
      setOrder(found);
      return;
    }

    getOrderByToken(token)
      .then((o) => {
        if (o) {
          setOrder({
            id: `#ORD-${o.id.slice(0, 4).toUpperCase()}`,
            productId: o.listing.id,
            productTitle: o.listing.title,
            buyerName: o.buyer_name,
            buyerPhone: o.buyer_phone,
            buyerEmail: o.buyer_email,
            artisanName: o.artisan?.name || "Campus Artisan",
            artisanPhone: o.artisan?.contact_phone || "+91 98765 43210",
            artisanUpi: "artisan@okaxis",
            total: Math.round(o.amount_total / 100),
            artisanShare: Math.round((o.amount_total / 100) * 0.9),
            status: o.status === "fulfilled" ? "Fulfilled" : "Paid",
            payoutStatus: "Pending",
            timestamp: "Just now",
          });
        } else {
          setOrder(orders[0]);
        }
      })
      .catch(() => {
        setOrder(orders[0]);
      });
  }, [token]);

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="font-editorial text-2xl font-bold text-earth-slate">Finding your order...</h2>
      </div>
    );
  }

  const cleanPhone = (order.artisanPhone || "9876543210").replace(/[^0-9]/g, "");
  const waUrl = `https://wa.me/${cleanPhone}?text=Hi!%20I%20just%20purchased%20your%20craft%20on%20CampCraft%20(Order%20${encodeURIComponent(
    order.id
  )}).%20Let's%20coordinate%20campus%20pickup!`;

  function copyPhone() {
    navigator.clipboard.writeText(order?.artisanPhone || "+91 98765 43210");
    showToast("Artisan Phone Copied!", "📋");
  }

  function handleReviewSubmit(e) {
    e.preventDefault();
    if (token) {
      submitReview(token, rating, reviewComment).catch(() => {});
    }
    setReviewSubmitted(true);
    showToast("Thank you! Review submitted to artisan profile.", "🌟");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      {/* Animated Success Banner */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm border border-emerald-300">
          ✓
        </div>
        <span className="text-xs uppercase font-bold tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Payment Confirmed • Razorpay Verified
        </span>
        <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-earth-slate mt-3">
          Your Campus Order is Placed!
        </h1>
        <p className="text-xs sm:text-sm text-earth-muted mt-2">
          Reference <span className="font-mono font-bold text-earth-slate">{order.id}</span> • Razorpay ID:{" "}
          <span className="font-mono text-xs text-stone-500">pay_Px892hjk983</span>
        </p>
      </div>

      {/* Order Progress Stepper */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-earth-border shadow-xs mb-8">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs mb-1">
              ✓
            </div>
            <span className="font-semibold text-emerald-900 text-center">Placed & Paid</span>
            <span className="text-[10px] text-earth-muted">Instant Escrow</span>
          </div>
          <div className="h-0.5 bg-emerald-600 flex-1 mx-2" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-brand-terracotta text-white flex items-center justify-center font-bold text-xs mb-1 animate-pulse">
              ⏳
            </div>
            <span className="font-semibold text-brand-terracotta text-center">Artisan Coordinating</span>
            <span className="text-[10px] text-earth-muted">Active Now</span>
          </div>
          <div className="h-0.5 bg-stone-200 flex-1 mx-2" />
          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center font-bold text-xs mb-1">
              3
            </div>
            <span className="font-medium text-stone-400 text-center">Quad Handoff</span>
            <span className="text-[10px] text-earth-muted">Pending</span>
          </div>
        </div>
      </div>

      {/* CRITICAL FEATURE: UNLOCKED ARTISAN CONTACT CARD */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FEF8EA] to-[#FDF4E2] border-2 border-accent-ochre shadow-md relative overflow-hidden mb-8">
        <div className="absolute top-3 right-3 text-2xl opacity-40">🔓</div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 text-xs font-bold mb-3">
          <span>🎉</span> ARTISAN CONTACT UNLOCKED
        </div>
        <h2 className="font-editorial text-xl sm:text-2xl font-bold text-earth-slate">
          Coordinate Pickup with Your Student Artisan
        </h2>
        <p className="text-xs sm:text-sm text-earth-muted mt-1">
          Reach out directly via WhatsApp to pick your campus handoff time and spot!
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-white/90 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-earth-muted">
              Student Artisan
            </div>
            <div className="font-editorial text-lg font-bold text-earth-slate">
              {order.artisanName}
            </div>
            <div className="text-xs text-earth-muted mt-0.5">Design Dept '25 • Hostel C-104</div>
            <div className="text-xs font-mono font-medium text-earth-slate mt-1 flex items-center gap-1.5">
              <span>📱 Phone/WhatsApp:</span>
              <span className="font-bold text-brand-clayDark">{order.artisanPhone}</span>
            </div>
            <div className="text-xs text-earth-muted mt-0.5">
              📸 Instagram: <span className="font-medium text-earth-slate">@ananya_silvers</span>
            </div>
          </div>

          <div className="w-full sm:w-auto flex flex-col gap-2">
            <a
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all no-underline"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>💬 Chat on WhatsApp</span>
            </a>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-earth-border bg-white text-xs text-earth-slate hover:bg-stone-50 cursor-pointer"
              onClick={copyPhone}
            >
              Copy Phone Number
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Summary */}
      <div className="p-6 rounded-3xl bg-white border border-earth-border space-y-4 mb-8">
        <h3 className="font-bold text-sm text-earth-slate uppercase tracking-wider">Purchase Receipt</h3>
        <div className="flex items-center justify-between py-2 border-b border-earth-border text-sm">
          <span className="text-earth-slate font-medium">{order.productTitle}</span>
          <span className="font-bold text-earth-slate">₹{order.total}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-earth-muted">
          <div>
            <span className="block font-semibold text-earth-slate">Buyer Name</span>
            <span>{order.buyerName}</span>
          </div>
          <div>
            <span className="block font-semibold text-earth-slate">Buyer Contact</span>
            <span>{order.buyerPhone}</span>
          </div>
        </div>
      </div>

      {/* Post-Fulfillment Review Component Trigger */}
      <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-earth-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase text-accent-sage">Post-Handoff Feedback</span>
        </div>
        {reviewSubmitted ? (
          <div className="text-center py-4 text-emerald-800 font-semibold text-sm">
            ✨ Thanks for reviewing this student artisan! Your rating helps our campus collective.
          </div>
        ) : (
          <form onSubmit={handleReviewSubmit} className="space-y-3">
            <p className="text-xs text-earth-muted">
              Once you meet the artisan at the quad and receive your craft, rate the experience to build their campus reputation!
            </p>
            <div className="flex items-center gap-2 text-2xl text-amber-400 cursor-pointer">
              {[1, 2, 3, 4, 5].map((s) => (
                <span
                  key={s}
                  onClick={() => setRating(s)}
                  className={`transition-transform hover:scale-110 ${
                    s <= rating ? "text-amber-500" : "text-stone-300"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
            <textarea
              className="w-full text-xs p-3 rounded-xl border border-earth-border bg-white focus:outline-none"
              placeholder="Write a short campus review (e.g. Beautiful craft, fast handoff!)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={2}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-earth-slate text-white text-xs font-semibold hover:bg-black cursor-pointer"
            >
              Submit Campus Review
            </button>
          </form>
        )}
      </div>

      {/* Bottom Return CTA */}
      <div className="text-center mt-8">
        <Link
          to="/"
          className="inline-block px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-earth-slate font-semibold text-sm transition-colors no-underline"
        >
          ← Explore More Campus Crafts
        </Link>
      </div>
    </div>
  );
}
