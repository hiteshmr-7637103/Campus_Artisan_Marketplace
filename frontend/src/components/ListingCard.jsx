import { useState } from "react";
import { Link } from "react-router-dom";
import { formatINR } from "../lib/format";
import { useWishlist } from "../lib/wishlist";

// `listing` is a ListingOut from GET /listings (only active listings are public).
export function ListingCard({ listing }) {
  const images = listing.images ?? [];
  const { display_name, avg_rating, review_count } = listing.seller || {};
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(listing.id);
  const [popping, setPopping] = useState(false);

  function handleHeartClick(e) {
    e.preventDefault();
    e.stopPropagation();
    setPopping(true);
    toggleWishlist(listing);
    setTimeout(() => setPopping(false), 300);
  }

  return (
    <div className="group relative flex flex-col bg-white rounded-3xl border border-earth-border overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 hover:border-earth-border/70 transition-all duration-300">
      {/* Image Frame */}
      <Link
        to={`/listing/${listing.id}`}
        className="relative aspect-[4/5] bg-brand-clayLight overflow-hidden cursor-pointer block"
      >
        {images[0] ? (
          <img
            src={images[0]}
            alt={listing.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-earth-muted/40">🧺</div>
        )}

        {/* Top Badges (Category & Unique Craft Badge) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/95 text-earth-slate shadow-xs border border-earth-border backdrop-blur-xs">
            {listing.category}
          </span>
        </div>

        {/* Floating Heart / Wishlist Button */}
        <button
          type="button"
          onClick={handleHeartClick}
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md z-10 backdrop-blur-md ${
            wishlisted
              ? "bg-red-50 text-red-600 border border-red-200"
              : "bg-white/90 text-earth-muted hover:text-red-500 hover:bg-white border border-earth-border"
          } ${popping ? "animate-heart-pop scale-125" : "hover:scale-110 active:scale-95"}`}
        >
          <svg
            className="w-4 h-4 transition-transform"
            viewBox="0 0 24 24"
            fill={wishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={wishlisted ? "0" : "2"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Multi-photo indicator dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-white shadow" : "bg-white/60"}`} />
            ))}
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between">
        <div>
          {/* Artisan Attribution & Rating */}
          <div className="flex items-center justify-between gap-2 text-xs text-earth-muted mb-1.5">
            <Link
              to={`/seller/${listing.seller?.id}`}
              className="truncate font-medium text-earth-muted hover:text-brand-terracotta no-underline"
              onClick={(e) => e.stopPropagation()}
            >
              by {display_name || "Student Artisan"}
            </Link>
            {avg_rating != null ? (
              <span className="shrink-0 text-amber-600 font-bold flex items-center gap-0.5" aria-label={`${avg_rating} out of 5 from ${review_count} reviews`}>
                <span className="text-amber-500">★</span> {avg_rating.toFixed(1)}
              </span>
            ) : (
              <span className="shrink-0 font-semibold text-[11px] px-1.5 py-0.5 rounded-md bg-accent-sageLight text-accent-sage">
                New Maker
              </span>
            )}
          </div>

          <Link
            to={`/listing/${listing.id}`}
            className="font-editorial text-base sm:text-lg font-bold text-earth-slate line-clamp-2 hover:text-brand-terracotta transition-colors leading-snug no-underline block"
          >
            {listing.title}
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-earth-border/80 flex items-center justify-between gap-2">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-earth-muted font-medium block leading-none">
              Price
            </span>
            <span className="font-editorial text-lg sm:text-xl font-bold text-brand-clayDark">
              {formatINR(listing.price_paise)}
            </span>
          </div>
          <Link
            to={`/checkout/${listing.id}`}
            className="shrink-0 whitespace-nowrap px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs font-bold transition-all shadow-xs hover:shadow-md active:scale-95 no-underline flex items-center gap-1"
          >
            <span>Buy Now</span>
            <span className="text-[10px] opacity-75">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
