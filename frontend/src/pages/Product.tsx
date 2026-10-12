import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchArtisanReviews, fetchListing } from "../lib/api";
import type { PublicListing, PublicReview } from "../lib/types";
import { CATEGORY_LABEL } from "../lib/types";
import { formatINR, formatDate } from "../lib/format";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Product() {
  const { id = "" } = useParams();
  const [listing, setListing] = useState<PublicListing | null | undefined>(undefined);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchListing(id)
      .then((l) => {
        if (cancelled) return;
        setListing(l);
        if (l?.artisan_id) {
          fetchArtisanReviews(l.artisan_id).then((r) => !cancelled && setReviews(r)).catch(() => {});
        }
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (listing === undefined) return <Spinner />;
  if (listing === null) {
    return (
      <EmptyState title="Item not found" hint="It may have been removed." />
    );
  }

  const sold = listing.status === "sold";

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
          <img
            src={listing.photo_urls[activePhoto]}
            alt={`${listing.title} — photo ${activePhoto + 1}`}
            className="h-full w-full object-cover"
          />
        </div>
        {listing.photo_urls.length > 1 && (
          <div className="mt-2 flex gap-2">
            {listing.photo_urls.map((u, i) => (
              <button
                key={u}
                onClick={() => setActivePhoto(i)}
                aria-label={`View photo ${i + 1}`}
                aria-pressed={i === activePhoto}
                className={`h-16 w-16 overflow-hidden rounded-lg border ${
                  i === activePhoto ? "border-ink" : "border-ink/15"
                }`}
              >
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50">
          {CATEGORY_LABEL[listing.category]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{listing.title}</h1>
        <p className="mt-2 text-xl font-semibold">{formatINR(listing.price_buyer)}</p>

        <div className="mt-2 flex items-center gap-2 text-sm text-ink/70">
          <span>By {listing.artisan_name ?? "a campus artisan"}</span>
          <RatingStars value={listing.artisan_avg_rating} count={listing.artisan_review_count} />
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
          {listing.description}
        </p>

        <div className="mt-6">
          {sold ? (
            <button className="btn-ghost w-full" disabled>
              Sold
            </button>
          ) : (
            <Link to={`/checkout/${listing.id}`} className="btn-primary w-full no-underline">
              Buy now
            </Link>
          )}
          <p className="mt-2 text-xs text-ink/50">
            Payment is handled by Razorpay. The artisan's contact details are shared with you
            after payment is confirmed.
          </p>
        </div>

        {reviews.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold">
              Reviews for {listing.artisan_name ?? "this artisan"}
            </h2>
            <ul className="mt-3 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="card p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <RatingStars value={r.rating} showCount={false} />
                    <span className="text-xs text-ink/50">{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-ink/80">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
