import { useParams } from "react-router-dom";
import { fetchSeller } from "../lib/api";
import { formatDate } from "../lib/format";
import { ListingCard } from "../components/ListingCard";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, Notice, Spinner, useLoad } from "../components/ui";

export function SellerProfile() {
  const { id = "" } = useParams();
  const { data: s, error } = useLoad(() => fetchSeller(id), [id]);
  if (error) return <EmptyState title="Seller not found" />;
  if (!s) return <Spinner />;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{s.display_name}</h1>
      <div className="mt-1"><RatingStars value={s.avg_rating} count={s.review_count} size="md" /></div>
      {s.bio && <p className="mt-3 max-w-prose whitespace-pre-wrap text-sm text-ink/80">{s.bio}</p>}

      <h2 className="mb-3 mt-8 font-semibold">Available items</h2>
      {s.listings.length === 0 ? <Notice kind="info">Nothing listed right now.</Notice> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {s.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}

      {s.reviews.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-semibold">Reviews</h2>
          <ul className="space-y-3">
            {s.reviews.map((r) => (
              <li key={r.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <RatingStars value={r.rating} showCount={false} />
                  <span className="text-xs text-ink/50">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-ink/50">{r.buyer_name} on “{r.listing_title}”</p>
                {r.comment && <p className="mt-1 text-ink/80">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
