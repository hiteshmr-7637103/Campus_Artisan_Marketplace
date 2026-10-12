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
      <EmptyState title="Artisan not found">
        <Link to="/" className="btn-primary no-underline">
          Back to browse
        </Link>
      </EmptyState>
    );
  }
  if (!s) return <Spinner />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-earth-border shadow-xs">
        <span className="text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
          Student Artisan
        </span>
        <h1 className="mt-3 font-editorial text-3xl font-bold text-earth-slate">{s.display_name}</h1>
        <div className="mt-1">
          <RatingStars value={s.avg_rating} count={s.review_count} size="md" />
        </div>
        {s.bio && <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm text-earth-muted">{s.bio}</p>}
      </div>

      <h2 className="mt-10 mb-4 font-editorial text-xl font-bold text-earth-slate">Available crafts</h2>
      {s.listings.length === 0 ? (
        <p className="text-sm text-earth-muted">Nothing listed right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {s.listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}

      {s.reviews.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 font-editorial text-xl font-bold text-earth-slate">Reviews</h2>
          <ul className="space-y-3">
            {s.reviews.map((r) => (
              <li key={r.id} className="p-4 rounded-2xl bg-white border border-earth-border text-sm">
                <div className="flex items-center justify-between">
                  <RatingStars value={r.rating} showCount={false} />
                  <span className="text-xs text-earth-muted">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-earth-muted">
                  {r.buyer_name} on “{r.listing_title}”
                </p>
                {r.comment && <p className="mt-1 text-earth-slate">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
