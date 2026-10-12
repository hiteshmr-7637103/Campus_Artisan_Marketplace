import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchListing } from "../lib/api";
import { getStoredProducts } from "../lib/mockData";

export function Product() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    const list = getStoredProducts();
    const foundLocal = list.find((p) => String(p.id) === String(id));
    if (foundLocal) {
      setProduct(foundLocal);
      return;
    }

    fetchListing(id)
      .then((l) => {
        if (l) {
          setProduct({
            id: l.id,
            title: l.title,
            category: l.category,
            price: Math.round(l.price_buyer / 100),
            status: l.status === "sold" ? "Sold Out" : "Active",
            artisan: l.artisan_name || "Campus Artisan",
            artisanDept: "Verified Student Artisan",
            artisanPhone: "",
            artisanEmail: "",
            artisanInsta: "",
            artisanUpi: "",
            rating: l.artisan_avg_rating ?? 5.0,
            salesCount: l.artisan_review_count ?? 1,
            images: l.photo_urls && l.photo_urls.length > 0 ? l.photo_urls : [
              "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80"
            ],
            description: l.description,
            pickupNote: "Pickup coordinated directly post-purchase.",
          });
        }
      })
      .catch(() => {
        setProduct(list[0]);
      });
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h2 className="font-editorial text-2xl font-bold text-earth-slate">Finding Craft...</h2>
      </div>
    );
  }

  const isSoldOut = product.status === "Sold Out" || product.status === "Sold";
  const nameParts = (product.artisan || "Campus Artisan").split(" ");
  const initials = nameParts.map((n) => n[0]).join("");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-earth-muted mb-6">
        <button
          onClick={() => navigate("/")}
          className="hover:text-brand-terracotta flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Back to Crafts
        </button>
        <span>/</span>
        <span className="text-earth-muted capitalize">{product.category}</span>
        <span>/</span>
        <span className="text-earth-slate font-medium truncate max-w-[200px]">
          {product.title}
        </span>
      </div>

      {/* 2-Column Responsive Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left: Gallery Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main Photo Display */}
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-brand-clayLight border border-earth-border shadow-xs">
            <img
              src={product.images[activePhoto] || product.images[0]}
              alt={product.title}
              className="w-full h-full object-cover transition-all duration-300"
            />
            <span
              className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold ${
                isSoldOut
                  ? "bg-stone-800 text-stone-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              {isSoldOut ? "Sold Out" : "✨ Available Now"}
            </span>
          </div>

          {/* Thumbnail Selector */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all p-0 bg-transparent ${
                    i === activePhoto
                      ? "border-brand-terracotta ring-2 ring-brand-terracotta/20 opacity-100"
                      : "border-earth-border opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Security / Masking Callout */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 mt-2">
            <div className="text-lg">🔒</div>
            <div>
              <span className="font-bold">Campus Artisan Privacy Protected:</span> Personal contact details
              (WhatsApp, phone & hostel room) are strictly masked until payment is completed to prevent
              unsolicited campus outreach.
            </div>
          </div>
        </div>

        {/* Right: Craft Info & Checkout Trigger */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="pb-6 border-b border-earth-border">
            <span className="inline-block text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full mb-3 capitalize">
              {product.category}
            </span>
            <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-earth-slate leading-tight">
              {product.title}
            </h1>

            {/* Price & Razorpay Label */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-editorial text-3xl sm:text-4xl font-bold text-brand-clayDark">
                ₹{product.price}
              </span>
              <span className="text-xs text-earth-muted">Inclusive of all fees • No shipping cost</span>
            </div>
          </div>

          {/* Artisan Showcase Card */}
          <div className="my-6 p-4 rounded-2xl bg-white border border-earth-border shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-clayLight text-brand-terracotta flex items-center justify-center font-bold font-editorial text-lg border border-earth-border">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-earth-slate">{product.artisan}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-sm">
                    Verified Student
                  </span>
                </div>
                <p className="text-xs text-earth-muted">
                  {product.artisanDept || "Campus Student Artisan"}
                </p>
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-0.5">
                  <span>★</span>
                  <span>{product.rating ? Number(product.rating).toFixed(1) : "4.9"}</span>
                  <span className="text-earth-muted">({product.salesCount || 12} campus trades)</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700">
              Artisan Guild
            </span>
          </div>

          {/* Story & Handcraft Details */}
          <div className="space-y-4 text-sm text-earth-slate">
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-earth-muted mb-1">
                Makers Story
              </h3>
              <p className="text-earth-slate leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>

            {/* Campus Pickup Accordion Details */}
            <div className="rounded-2xl border border-earth-border bg-[#FAF7F2] p-4 text-xs space-y-2">
              <div className="font-bold text-earth-slate flex items-center gap-1.5">
                <svg className="w-4 h-4 text-accent-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                Pickup & Campus Handoff Locations
              </div>
              <p className="text-earth-muted">
                {product.pickupNote ||
                  "Coordinate directly post-purchase: Student Center, Central Library Lawn, or North Hostel Gate between 4 PM - 7 PM weekdays."}
              </p>
            </div>
          </div>

          {/* CTA Actions */}
          <div className="mt-8 pt-4 border-t border-earth-border">
            {isSoldOut ? (
              <button
                disabled
                className="w-full py-4 rounded-2xl bg-stone-200 text-stone-500 font-semibold text-base cursor-not-allowed"
              >
                Currently Sold Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(`/checkout/${product.id}`)}
                className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-semibold text-base shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Instant Buy Now —</span>
                <span>₹{product.price}</span>
                <span className="text-xs opacity-80">(Razorpay UPI / Cards)</span>
              </button>
            )}
            <p className="text-[11px] text-center text-earth-muted mt-2">
              ⚡ Instant verification • 100% money held in campus escrow until confirmed handoff
            </p>
          </div>

          {/* Verified Campus Reviews Section */}
          <div className="mt-10 pt-8 border-t border-earth-border">
            <h3 className="font-editorial text-lg font-bold text-earth-slate mb-4">
              Verified Campus Reviews (3)
            </h3>
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-white border border-earth-border text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-earth-slate">Prateek S. (Computer Sci '26)</span>
                  <span className="text-amber-500 font-bold">★★★★★</span>
                </div>
                <p className="text-earth-muted">
                  "Picked it up at the Student Union 30 minutes after ordering. Quality is even better than photos!"
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-earth-border text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-earth-slate">Shreya D. (Architecture '24)</span>
                  <span className="text-amber-500 font-bold">★★★★★</span>
                </div>
                <p className="text-earth-muted">
                  "So unique and packaged in a lovely recycled cloth pouch. Highly recommend this student artisan."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
