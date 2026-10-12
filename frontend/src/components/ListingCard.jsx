import { Link, useNavigate } from "react-router-dom";

export function ListingCard({ listing }) {
  const navigate = useNavigate();
  const isSoldOut = listing.status === "Sold Out" || listing.status === "Sold";
  const artisanName = listing.artisan || "Campus Artisan";
  const nameParts = artisanName.split(" ");
  const shortName = `by ${nameParts[0]} ${nameParts[1] ? nameParts[1][0] + "." : ""}`;

  return (
    <div className="group relative flex flex-col bg-white rounded-3xl border border-earth-border overflow-hidden shadow-xs hover:shadow-md transition-all duration-300">
      {/* Image Frame */}
      <Link
        to={`/listing/${listing.id}`}
        className="relative aspect-[4/5] bg-brand-clayLight overflow-hidden cursor-pointer block"
      >
        <img
          src={listing.images[0]}
          alt={listing.title}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            isSoldOut ? "grayscale contrast-75" : ""
          }`}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              isSoldOut
                ? "bg-stone-800 text-stone-200"
                : "bg-white/95 text-accent-sage shadow-xs border border-earth-border"
            }`}
          >
            {isSoldOut ? "Sold Out" : listing.category}
          </span>
        </div>

        {/* Multi-photo indicator dots */}
        {listing.images && listing.images.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5">
            {listing.images.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-white shadow" : "bg-white/60"}`}
              />
            ))}
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-xl bg-black/80 text-white font-bold text-xs uppercase tracking-wider backdrop-blur-xs">
              Batch Claimed
            </span>
          </div>
        )}
      </Link>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between">
        <div>
          {/* Artisan Attribution */}
          <div className="flex items-center justify-between text-xs text-earth-muted mb-1.5">
            <span className="truncate font-medium text-stone-600">{shortName}</span>
            <span className="text-amber-600 font-bold flex items-center gap-0.5">
              ★ {listing.rating ? Number(listing.rating).toFixed(1) : "5.0"}
            </span>
          </div>

          <Link
            to={`/listing/${listing.id}`}
            className="font-editorial text-base sm:text-lg font-bold text-earth-slate line-clamp-2 hover:text-brand-terracotta transition-colors leading-snug no-underline block"
          >
            {listing.title}
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-earth-border flex items-center justify-between">
          <div>
            <span className="text-xs text-earth-muted block leading-none">Price</span>
            <span className="font-editorial text-lg sm:text-xl font-bold text-brand-clayDark">
              ₹{listing.price}
            </span>
          </div>

          {isSoldOut ? (
            <button
              disabled
              className="px-3.5 py-2 rounded-xl bg-stone-100 text-stone-400 text-xs font-semibold cursor-not-allowed"
            >
              Sold Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/checkout/${listing.id}`)}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              Buy Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
