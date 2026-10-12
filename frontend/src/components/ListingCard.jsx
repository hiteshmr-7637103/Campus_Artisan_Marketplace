import { Link } from "react-router-dom";
import { formatINR } from "../lib/format";

// `listing` is a ListingOut from GET /listings (only active listings are public).
export function ListingCard({ listing }) {
  const images = listing.images ?? [];
  const { display_name, avg_rating, review_count } = listing.seller;

  return (
    <div className="group relative flex flex-col bg-white rounded-3xl border border-earth-border overflow-hidden shadow-xs hover:shadow-md transition-all duration-300">
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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-earth-muted/40">🧺</div>
        )}

        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/95 text-accent-sage shadow-xs border border-earth-border">
            {listing.category}
          </span>
        </div>

        {/* Multi-photo indicator dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-white shadow" : "bg-white/60"}`} />
            ))}
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between">
        <div>
          {/* Artisan Attribution */}
          <div className="flex items-center justify-between gap-2 text-xs text-earth-muted mb-1.5">
            <span className="truncate font-medium text-stone-600">by {display_name}</span>
            {avg_rating != null ? (
              <span className="shrink-0 text-amber-600 font-bold" aria-label={`${avg_rating} out of 5 from ${review_count} reviews`}>
                ★ {avg_rating.toFixed(1)}
              </span>
            ) : (
              <span className="shrink-0 font-semibold text-accent-sage">New</span>
            )}
          </div>

          <Link
            to={`/listing/${listing.id}`}
            className="font-editorial text-base sm:text-lg font-bold text-earth-slate line-clamp-2 hover:text-brand-terracotta transition-colors leading-snug no-underline block"
          >
            {listing.title}
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-earth-border flex items-center justify-between gap-2">
          <div>
            <span className="text-xs text-earth-muted block leading-none">Price</span>
            <span className="font-editorial text-lg sm:text-xl font-bold text-brand-clayDark">
              {formatINR(listing.price_paise)}
            </span>
          </div>
          <Link
            to={`/checkout/${listing.id}`}
            className="shrink-0 whitespace-nowrap px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs font-bold transition-all shadow-xs active:scale-95 no-underline"
          >
            Buy Now
          </Link>
        </div>
      </div>
    </div>
  );
}
