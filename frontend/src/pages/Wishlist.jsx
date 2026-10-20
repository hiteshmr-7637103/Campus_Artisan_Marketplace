import { Link } from "react-router-dom";
import { useWishlist } from "../lib/wishlist";
import { formatINR } from "../lib/format";
import { PageHeader } from "../components/ui";

export function Wishlist() {
  const { items, removeFromWishlist, clearWishlist } = useWishlist();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-earth-border mb-8">
        <div>
          <span className="rounded-full bg-brand-clayLight px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-terracotta">
            Your Collection
          </span>
          <h1 className="mt-3 font-editorial text-3xl sm:text-4xl font-bold text-earth-slate">
            Saved Crafts
          </h1>
          <p className="mt-1 text-sm text-earth-muted">
            {items.length === 1
              ? "1 handmade piece saved for later"
              : `${items.length} handmade pieces saved for later`}
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearWishlist}
            className="text-xs text-earth-muted hover:text-red-600 transition-colors self-start sm:self-auto font-medium"
          >
            Clear all saved items
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-dashed border-earth-border">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-3xl shadow-xs">
            🤍
          </div>
          <h2 className="font-editorial text-2xl font-bold text-earth-slate">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-earth-muted max-w-md mx-auto mt-2 leading-relaxed">
            Spot a handmade ceramic cup or dorm tapestry you love? Click the heart icon on any craft to save it here while you decide.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg no-underline active:scale-95"
          >
            <span>Explore Campus Crafts</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const img = item.images?.[0];
            return (
              <div
                key={item.id}
                className="group relative flex flex-col bg-white rounded-3xl border border-earth-border overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300"
              >
                {/* Image */}
                <Link
                  to={`/listing/${item.id}`}
                  className="relative aspect-[4/5] bg-brand-clayLight overflow-hidden block"
                >
                  {img ? (
                    <img
                      src={img}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-earth-muted/40">
                      🧺
                    </div>
                  )}
                  {item.category && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/95 text-earth-slate shadow-xs border border-earth-border">
                      {item.category}
                    </span>
                  )}
                </Link>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeFromWishlist(item.id)}
                  aria-label="Remove from saved"
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-earth-muted hover:text-red-600 flex items-center justify-center shadow-sm border border-earth-border transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>

                {/* Info & Action */}
                <div className="p-4 flex flex-col flex-grow justify-between">
                  <div>
                    <span className="text-xs text-earth-muted block truncate mb-1">
                      by {item.seller?.display_name || "Student Maker"}
                    </span>
                    <Link
                      to={`/listing/${item.id}`}
                      className="font-editorial text-base font-bold text-earth-slate line-clamp-2 hover:text-brand-terracotta transition-colors no-underline"
                    >
                      {item.title}
                    </Link>
                  </div>

                  <div className="mt-4 pt-3 border-t border-earth-border flex items-center justify-between gap-2">
                    <span className="font-editorial text-lg font-bold text-brand-clayDark">
                      {formatINR(item.price_paise)}
                    </span>
                    <Link
                      to={`/checkout/${item.id}`}
                      className="px-3.5 py-2 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs font-bold transition-all shadow-xs no-underline"
                    >
                      Buy Now
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
