import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchListing, fetchSeller } from "../lib/api";
import { formatDate, formatINR } from "../lib/format";
import { useWishlist } from "../lib/wishlist";
import { useCart } from "../lib/cart";
import { showToast } from "../lib/toast";
import { RatingStars } from "../components/RatingStars";
import { ListingCard } from "../components/ListingCard";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Product() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToCart, isInCart } = useCart();
  const [listing, setListing] = useState(undefined); // undefined = loading, null = not found
  const [sellerProfile, setSellerProfile] = useState(null);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setListing(undefined);
    setActivePhoto(0);
    fetchListing(id)
      .then((l) => {
        if (cancelled) return;
        setListing(l);
        fetchSeller(l.seller.id)
          .then((s) => !cancelled && setSellerProfile(s))
          .catch(() => {});
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 404 || e.status === 422) setListing(null);
        else setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const wishlisted = listing ? isWishlisted(listing.id) : false;
  const inCart = listing ? isInCart(listing.id) : false;

  const reviews = sellerProfile?.reviews || [];
  const otherCrafts = useMemo(() => {
    if (!sellerProfile?.listings || !listing) return [];
    return sellerProfile.listings.filter((item) => item.id !== listing.id).slice(0, 4);
  }, [sellerProfile, listing]);

  // Review star breakdown
  const ratingBreakdown = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      counts[star] = (counts[star] || 0) + 1;
    });
    return counts;
  }, [reviews]);

  function handleShare() {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        showToast("Link copied to clipboard!", "📋");
      }
    } catch {
      showToast("Link: " + window.location.href, "📋");
    }
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Notice kind="error">{error}</Notice>
      </div>
    );
  }
  if (listing === undefined) return <Spinner label="Loading craft details…" />;
  if (listing === null) {
    return (
      <EmptyState title="This craft isn't available" hint="It may have sold or been archived by the artisan.">
        <Link to="/" className="btn-primary no-underline">
          Back to browse
        </Link>
      </EmptyState>
    );
  }

  const { seller } = listing;
  const images = listing.images || [];
  const initials = (seller.display_name || "SM")
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      {/* Breadcrumbs & Navigation Bar */}
      <div className="flex items-center justify-between gap-4 text-xs sm:text-sm text-earth-muted mb-6">
        <div className="flex items-center gap-2 truncate">
          <button
            onClick={() => navigate("/")}
            className="hover:text-brand-terracotta flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>All Crafts</span>
          </button>
          <span>/</span>
          <Link to={`/?category=${listing.category_slug || ""}`} className="text-earth-muted hover:text-earth-slate no-underline">
            {listing.category}
          </Link>
          <span>/</span>
          <span className="text-earth-slate font-medium truncate max-w-[220px]">{listing.title}</span>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-earth-border bg-white text-xs font-semibold text-earth-slate hover:bg-stone-50 transition-colors shadow-xs shrink-0"
          title="Share this craft"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-brand-clayLight border border-earth-border shadow-xs group">
            {images[activePhoto] ? (
              <img
                src={images[activePhoto]}
                alt={`${listing.title} — photo ${activePhoto + 1}`}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-earth-muted/40">🧺</div>
            )}

            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/95 text-earth-slate shadow-xs border border-earth-border">
                {listing.category}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                ✨ 1-of-1 Handmade
              </span>
            </div>
          </div>

          {/* Thumbnail Carousel */}
          {images.length > 1 && (
            <div className="flex items-center gap-3">
              {images.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === activePhoto}
                  className={`w-20 h-20 rounded-2xl overflow-hidden border-2 cursor-pointer transition-all p-0 bg-transparent shadow-xs ${
                    i === activePhoto
                      ? "border-brand-terracotta ring-2 ring-brand-terracotta/20 scale-105 opacity-100"
                      : "border-earth-border opacity-70 hover:opacity-100 hover:border-earth-slate"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Privacy & Safe Handoff Notice */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 mt-2">
            <span className="text-lg shrink-0">🔒</span>
            <div>
              <span className="font-bold">Campus Artisan Privacy Protected:</span> Personal contact details (WhatsApp, phone &amp; hostel room) are strictly masked until payment is completed to prevent unsolicited campus outreach.
            </div>
          </div>
        </div>

        {/* Right Column: Craft Details & Actions */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="pb-6 border-b border-earth-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-block text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
                Original Student Creation
              </span>
              <span className="text-xs text-earth-muted">
                Listed {formatDate(listing.created_at)}
              </span>
            </div>

            <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-earth-slate leading-tight">
              {listing.title}
            </h1>

            {/* Price section */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-editorial text-3xl sm:text-4xl font-bold text-brand-clayDark">
                {formatINR(listing.price_paise)}
              </span>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Free Campus Pickup
              </span>
            </div>
          </div>

          {/* Artisan Profile Card */}
          <Link
            to={`/seller/${seller.id}`}
            className="my-6 p-4 rounded-2xl bg-white border border-earth-border shadow-xs flex items-center justify-between no-underline hover:border-brand-terracotta/60 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-clayLight text-brand-terracotta flex items-center justify-center font-bold font-editorial text-lg border border-earth-border group-hover:scale-105 transition-transform">
                {initials}
              </div>
              <div>
                <span className="font-bold text-sm text-earth-slate group-hover:text-brand-terracotta transition-colors">
                  {seller.display_name}
                </span>
                <div className="mt-0.5">
                  <RatingStars value={seller.avg_rating} count={seller.review_count} />
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-terracotta flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>View Shop</span>
              <span>→</span>
            </span>
          </Link>

          {/* Description & Story */}
          <div className="space-y-4 text-sm text-earth-slate">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-earth-muted mb-1.5">
                Maker's Story & Materials
              </h3>
              <p className="text-earth-slate leading-relaxed whitespace-pre-wrap bg-white/50 p-4 rounded-2xl border border-earth-border/60">
                {listing.description}
              </p>
            </div>

            <div className="rounded-2xl border border-earth-border bg-[#FAF7F2] p-4 text-xs space-y-2">
              <div className="font-bold text-earth-slate flex items-center gap-1.5">
                <svg className="w-4 h-4 text-accent-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span>Quad & Campus Handoff</span>
              </div>
              <p className="text-earth-muted leading-relaxed">
                Meet up comfortably at the Student Union, library foyer, or campus quad. Zero shipping fees or packaging waste.
              </p>
            </div>
          </div>

          {/* Action Row: Buy Now, Add to Bag & Wishlist Toggle */}
          <div className="mt-8 pt-4 border-t border-earth-border flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <Link
                to={`/checkout/${listing.id}`}
                className="flex-1 py-4 px-6 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 no-underline"
              >
                <span>Buy Now —</span>
                <span>{formatINR(listing.price_paise)}</span>
              </Link>

              <button
                type="button"
                onClick={() => addToCart(listing)}
                className={`py-4 px-5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 ${
                  inCart
                    ? "bg-brand-clayLight text-brand-clayDark border border-brand-terracotta/30"
                    : "bg-earth-slate hover:bg-stone-800 text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span>{inCart ? "In Bag ✓" : "Add to Bag"}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(listing)}
                aria-label={wishlisted ? "Remove from saved" : "Save craft"}
                className={`px-4 py-4 rounded-2xl border font-semibold text-sm transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                  wishlisted
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-white text-earth-slate border-earth-border hover:bg-stone-50 hover:border-earth-slate"
                }`}
              >
                <svg
                  className="w-4 h-4 transition-transform"
                  viewBox="0 0 24 24"
                  fill={wishlisted ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={wishlisted ? "0" : "2"}
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>{wishlisted ? "Saved" : "Save"}</span>
              </button>
            </div>
            <p className="text-[11px] text-center text-earth-muted">
              Secure checkout via Razorpay • 100% money-back guarantee if unfulfilled.
            </p>
          </div>
        </div>
      </div>

      {/* "More from this Artisan" Section */}
      {otherCrafts.length > 0 && (
        <section className="mt-16 pt-10 border-t border-earth-border">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-brand-terracotta">
                From the Same Studio
              </span>
              <h2 className="font-editorial text-2xl font-bold text-earth-slate mt-1">
                More Crafts by {seller.display_name}
              </h2>
            </div>
            <Link
              to={`/seller/${seller.id}`}
              className="text-xs font-bold text-brand-terracotta hover:underline no-underline"
            >
              View All ({sellerProfile?.listings?.length || 0}) →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {otherCrafts.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      {/* Customer Reviews & Ratings Breakdown */}
      <section className="mt-16 pt-10 border-t border-earth-border">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Review Score Summary */}
          <div className="md:col-span-4 p-6 rounded-3xl bg-white border border-earth-border shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-editorial text-xl font-bold text-earth-slate mb-1">
                Artisan Rating & Reviews
              </h3>
              <p className="text-xs text-earth-muted">Verified feedback from campus handoffs</p>

              <div className="mt-5 flex items-baseline gap-3">
                <span className="font-editorial text-5xl font-bold text-earth-slate">
                  {seller.avg_rating ? seller.avg_rating.toFixed(1) : "5.0"}
                </span>
                <div>
                  <RatingStars value={seller.avg_rating} count={seller.review_count} />
                  <span className="text-xs text-earth-muted block mt-0.5">
                    Based on {seller.review_count} {seller.review_count === 1 ? "review" : "reviews"}
                  </span>
                </div>
              </div>

              {/* Star Distribution Bars */}
              <div className="mt-6 space-y-2 text-xs text-earth-muted">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingBreakdown[stars] || 0;
                  const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : stars === 5 ? 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="w-6 font-medium text-earth-slate">{stars}★</span>
                      <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-medium text-[11px]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-earth-border text-[11px] text-earth-muted">
              Buyers can submit an official review once their order is marked fulfilled by the seller.
            </div>
          </div>

          {/* Individual Reviews List */}
          <div className="md:col-span-8 flex flex-col">
            <h3 className="font-editorial text-xl font-bold text-earth-slate mb-4">
              Recent Reviews ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-dashed border-earth-border text-center text-earth-muted text-sm">
                <p className="font-semibold text-earth-slate">No written reviews yet</p>
                <p className="text-xs mt-1">Be the first to review {seller.display_name} after picking up your craft!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-clayLight text-brand-terracotta font-bold flex items-center justify-center text-xs">
                          {r.buyer_name[0]?.toUpperCase() || "B"}
                        </div>
                        <span className="font-bold text-sm text-earth-slate">{r.buyer_name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                          ✓ Verified Buyer
                        </span>
                      </div>
                      <RatingStars value={r.rating} showCount={false} />
                    </div>

                    {r.comment ? (
                      <p className="text-earth-slate text-sm leading-relaxed">{r.comment}</p>
                    ) : (
                      <p className="italic text-earth-muted text-xs">Rated without written feedback.</p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-earth-muted/80 pt-1 border-t border-earth-border/40">
                      <span>Craft: “{r.listing_title}”</span>
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile Sticky Quick Buy Bar (Elevated above bottom navigation) */}
      <div className="md:hidden fixed bottom-14 inset-x-0 bg-white/95 backdrop-blur-md border-t border-earth-border px-4 py-2.5 z-30 flex items-center justify-between gap-3 shadow-lg">
        <div>
          <span className="text-[10px] text-earth-muted uppercase tracking-wider block font-semibold">
            Campus Price
          </span>
          <span className="font-editorial text-lg font-bold text-brand-clayDark leading-none">
            {formatINR(listing.price_paise)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => addToCart(listing)}
            className={`p-2.5 rounded-xl border font-bold text-xs transition-all shadow-xs ${
              inCart
                ? "bg-brand-clayLight text-brand-clayDark border-brand-terracotta/40"
                : "bg-white text-earth-slate border-earth-border"
            }`}
            aria-label="Add to bag"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </button>
          <Link
            to={`/checkout/${listing.id}`}
            className="px-5 py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-xs shadow-md transition-all active:scale-95 no-underline flex items-center gap-1.5"
          >
            <span>Instant Buy</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
