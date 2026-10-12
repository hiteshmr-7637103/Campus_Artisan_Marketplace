import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createOrder, fetchListing } from "../lib/api";
import {
  getStoredOrders,
  getStoredProducts,
  saveStoredOrders,
  showToast,
} from "../lib/mockData";

export function Checkout() {
  const { listingId = "" } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [name, setName] = useState("Aditya Verma");
  const [phone, setPhone] = useState("9876543210");
  const [email, setEmail] = useState("aditya.v@campus.edu");
  const [pickup, setPickup] = useState("Student Union / Activity Quad (Center Campus)");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const list = getStoredProducts();
    const found = list.find((p) => String(p.id) === String(listingId));
    if (found) {
      setProduct(found);
    } else {
      fetchListing(listingId)
        .then((l) => {
          if (l) {
            setProduct({
              id: l.id,
              title: l.title,
              category: l.category,
              price: Math.round(l.price_buyer / 100),
              status: l.status === "sold" ? "Sold Out" : "Active",
              artisan: l.artisan_name || "Campus Artisan",
              artisanDept: "Design Dept",
              artisanPhone: "+91 98765 43210",
              artisanEmail: "artisan@campus.edu",
              artisanInsta: "@artisan_crafts",
              artisanUpi: "artisan@upi",
              rating: 5.0,
              salesCount: 1,
              images: l.photo_urls,
              description: l.description,
              pickupNote: "Quad pickup",
            });
          }
        })
        .catch(() => {
          setProduct(list[0]);
        });
    }
  }, [listingId]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-editorial text-2xl font-bold text-earth-slate">Loading checkout...</h2>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    showToast("Initiating Razorpay Escrow Session...", "🔒");

    const orderId = `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await createOrder({
        listing_id: String(product?.id || listingId),
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_email: email.trim(),
        fulfillment_method: "pickup",
        delivery_point: pickup,
        delivery_notes: note || undefined,
      });

      if (res && res.short_url) {
        window.location.href = res.short_url;
        return;
      }
    } catch {
      // Local fallback
    }

    setTimeout(() => {
      const orders = getStoredOrders();
      const newOrder = {
        id: orderId,
        productId: product?.id || 1,
        productTitle: product?.title || "Handcrafted Craft",
        buyerName: name.trim(),
        buyerPhone: `+91 ${phone.trim()}`,
        buyerEmail: email.trim(),
        artisanName: product?.artisan || "Ananya Mishra",
        artisanPhone: product?.artisanPhone || "+91 98765 43210",
        artisanUpi: product?.artisanUpi || "ananya@okaxis",
        total: product?.price || 550,
        artisanShare: Math.round((product?.price || 550) * 0.9),
        status: "Paid",
        payoutStatus: "Pending",
        timestamp: "Just now",
      };

      saveStoredOrders([newOrder, ...orders]);
      setSubmitting(false);
      navigate(`/order/${orderId.replace("#", "")}`);
    }, 1000);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Header & Back Button */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-earth-border">
        <Link
          to={`/listing/${product.id}`}
          className="text-xs sm:text-sm font-medium text-earth-muted hover:text-earth-slate flex items-center gap-1 no-underline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          Cancel & Return
        </Link>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          Zero-Login Express Checkout
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Buyer Details Form */}
        <div className="md:col-span-7 space-y-6">
          <div>
            <h2 className="font-editorial text-2xl font-bold text-earth-slate">
              Campus Buyer Details
            </h2>
            <p className="text-xs text-earth-muted mt-1">
              No registration needed. Information is strictly used for order handoff coordination.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                placeholder="e.g. Maya Krishnan"
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Mobile / WhatsApp Number *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-earth-border bg-stone-50 text-xs font-semibold text-earth-muted">
                  +91
                </span>
                <input
                  className="w-full px-4 py-3 rounded-r-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  pattern="[0-9]{10}"
                  placeholder="10-digit number"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <span className="text-[11px] text-earth-muted mt-1 block">
                Artisan will WhatsApp you at this number after checkout.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                College Email ID *
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                placeholder="name@college.edu"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Preferred Campus Pickup Spot
              </label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              >
                <option value="Student Union / Activity Quad (Center Campus)">
                  Student Union / Activity Quad (Center Campus)
                </option>
                <option value="Central Library Steps">Central Library Steps</option>
                <option value="Hostel Block A / C Entrance Gate">
                  Hostel Block A / C Entrance Gate
                </option>
                <option value="Design & Architecture Dept Studio">
                  Design & Architecture Dept Studio
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Note for Artisan (Optional)
              </label>
              <textarea
                className="w-full px-4 py-2.5 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                placeholder="e.g. Free today after 4:30 PM"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Payment Method Preview */}
            <div className="p-4 rounded-2xl bg-[#F5EFEB] border border-earth-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-earth-slate flex items-center gap-1.5">
                  <span className="text-blue-700 font-black">Razorpay</span> Secure Gateway
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  UPI Ready
                </span>
              </div>
              <p className="text-xs text-earth-muted">
                Supports Google Pay, PhonePe, Paytm UPI, Debit/Credit cards & NetBanking. Zero convenience surcharge.
              </p>
            </div>

            <button
              className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Initiating Razorpay Escrow Session...
                </>
              ) : (
                <>
                  <span>Proceed to Pay</span>
                  <span>₹{product.price}</span>
                  <span>via Razorpay →</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Order Summary Card */}
        <div className="md:col-span-5">
          <div className="p-5 rounded-3xl bg-white border border-earth-border shadow-xs sticky top-28 space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate">Order Summary</h3>

            {/* Item Preview */}
            <div className="flex gap-3 pb-4 border-b border-earth-border">
              <img
                alt={product.title}
                className="w-16 h-16 rounded-xl object-cover bg-brand-clayLight border border-earth-border"
                src={product.images[0]}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-xs sm:text-sm text-earth-slate truncate">
                  {product.title}
                </h4>
                <p className="text-xs text-earth-muted mt-0.5">by {product.artisan}</p>
                <span className="inline-block mt-1 text-[10px] bg-accent-sageLight text-accent-sage font-semibold px-2 py-0.5 rounded">
                  Single Artisan Edition
                </span>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-earth-muted">
                <span>Item Subtotal</span>
                <span className="font-medium text-earth-slate">₹{product.price}</span>
              </div>
              <div className="flex justify-between text-earth-muted">
                <span>Campus Pickup / Hand-off</span>
                <span className="text-emerald-700 font-semibold">FREE (₹0)</span>
              </div>
              <div className="flex justify-between text-earth-muted">
                <span>Razorpay Platform Fee</span>
                <span className="text-emerald-700 font-semibold">Included (₹0)</span>
              </div>
              <div className="pt-3 border-t border-earth-border flex justify-between text-sm font-bold text-earth-slate">
                <span>Total Payable</span>
                <span className="text-brand-clayDark font-editorial text-xl">₹{product.price}</span>
              </div>
            </div>

            {/* Guarantee */}
            <div className="p-3 rounded-xl bg-stone-50 text-[11px] text-earth-muted flex items-start gap-2">
              <span>🛡️</span>
              <span>
                CampCraft Campus Guarantee: Funds are only paid out to the student artisan after both
                buyer and seller verify the campus exchange.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
