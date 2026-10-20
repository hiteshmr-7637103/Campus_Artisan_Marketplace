import { Link, useParams } from "react-router-dom";
import { fetchSeller } from "../lib/api";
import { formatDate } from "../lib/format";
import { ListingCard } from "../components/ListingCard";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, Spinner, useLoad } from "../components/ui";

export function SellerProfile() {
  const { id = "" } = useParams();
  const { data: s, error } = useLoad(() => fetchSeller(id), [id]);

  if (error) {
    return (
      <EmptyState title="Artisan not found" hint="This student profile may have been removed or is inactive.">
        <Link to="/" className="btn-primary no-underline">
          Back to browse
        </Link>
      </EmptyState>
    );
  }
  if (!s) return <Spinner label="Loading artisan studio…" />;

  const initials = (s.display_name || "SM")
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {/* Artisan Storefront Header Banner */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-white via-white to-brand-clayLight/40 border border-earth-border shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-brand-clayLight text-brand-terracotta border border-earth-border flex items-center justify-center font-editorial font-bold text-2xl sm:text-3xl shadow-xs shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
                  Verified Student Maker
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Campus Pickup Active
                </span>
              </div>
              <h1 className="mt-2 font-editorial text-2xl sm:text-4xl font-bold text-earth-slate">
                {s.display_name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <RatingStars value={s.avg_rating} count={s.review_count} size="md" />
              </div>
            </div>
          </div>

          {/* Quick Stats Pill Box */}
          <div className="flex items-center gap-4 sm:gap-6 bg-white/80 p-3 sm:p-4 rounded-2xl border border-earth-border/80 shadow-xs self-stretch sm:self-auto justify-around">
            <div className="text-center">
              <span className="block font-editorial text-lg sm:text-xl font-bold text-earth-slate">
                {s.listings.length}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-earth-muted font-medium">
                Active Crafts
              </span>
            </div>
            <div className="w-px h-8 bg-earth-border" />
            <div className="text-center">
              <span className="block font-editorial text-lg sm:text-xl font-bold text-earth-slate">
                {s.review_count}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-earth-muted font-medium">
                Reviews
              </span>
            </div>
            <div className="w-px h-8 bg-earth-border" />
            <div className="text-center">
              <span className="block font-editorial text-lg sm:text-xl font-bold text-amber-600">
                {s.avg_rating ? s.avg_rating.toFixed(1) : "5.0"}★
              </span>
              <span className="text-[11px] uppercase tracking-wider text-earth-muted font-medium">
                Rating
              </span>
            </div>
          </div>
        </div>

        {s.bio && (
          <div className="mt-6 pt-6 border-t border-earth-border/60">
            <h3 className="font-bold text-xs uppercase tracking-wider text-earth-muted mb-1">
              About the Artisan & Studio
            </h3>
            <p className="max-w-3xl whitespace-pre-wrap text-sm text-earth-slate leading-relaxed">
              {s.bio}
            </p>
          </div>
        )}
      </div>

      {/* Available Crafts Section */}
      <section className="mt-12">
        <div className="flex items-center justify-between gap-4 mb-6 pb-3 border-b border-earth-border">
          <h2 className="font-editorial text-2xl font-bold text-earth-slate">
            Shop Collection ({s.listings.length})
          </h2>
          <span className="text-xs text-earth-muted font-medium">
            100% Original Handmade Pieces
          </span>
        </div>

        {s.listings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-earth-border">
            <p className="font-editorial text-lg font-bold text-earth-slate">All caught up!</p>
            <p className="text-xs text-earth-muted mt-1">
              {s.display_name} doesn't have any active pieces listed right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {s.listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      {s.reviews.length > 0 && (
        <section className="mt-16 pt-8 border-t border-earth-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-editorial text-2xl font-bold text-earth-slate">
              Buyer Reviews ({s.reviews.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.reviews.map((r) => (
              <div key={r.id} className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-earth-slate">{r.buyer_name}</span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Verified Campus Buyer
                    </span>
                  </div>
                  <RatingStars value={r.rating} showCount={false} />
                </div>
                {r.comment && <p className="text-earth-slate text-xs leading-relaxed">{r.comment}</p>}
                <div className="flex items-center justify-between text-[11px] text-earth-muted pt-2 border-t border-earth-border/40">
                  <span>Purchased “{r.listing_title}”</span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
