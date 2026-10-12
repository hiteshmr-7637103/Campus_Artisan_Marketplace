import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchListing } from "../lib/api";
import type { Listing } from "../lib/types";
import { ApiError } from "../lib/api";
import { formatINR } from "../lib/format";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Product() {
  const { id = "" } = useParams();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetchListing(id)
      .then(setListing)
      .catch((e: ApiError) => (e.status === 404 ? setListing(null) : setError(e.message)));
  }, [id]);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (listing === undefined) return <Spinner />;
  if (listing === null) return <EmptyState title="Item not found" hint="It may have sold or been removed." />;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="aspect-square overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
          {listing.images[active] && (
            <img src={listing.images[active]} alt={`${listing.title} — photo ${active + 1}`} className="h-full w-full object-cover" />
          )}
        </div>
        {listing.images.length > 1 && (
          <div className="mt-2 flex gap-2">
            {listing.images.map((u, i) => (
              <button key={u} onClick={() => setActive(i)} aria-label={`View photo ${i + 1}`} aria-pressed={i === active}
                className={`h-16 w-16 overflow-hidden rounded-lg border ${i === active ? "border-ink" : "border-ink/15"}`}>
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50">{listing.category}</p>
        <h1 className="mt-1 text-2xl font-semibold">{listing.title}</h1>
        <p className="mt-2 text-xl font-semibold">{formatINR(listing.price_paise)}</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-ink/70">
          <span>By <Link to={`/seller/${listing.seller.id}`}>{listing.seller.display_name}</Link></span>
          <RatingStars value={listing.seller.avg_rating} count={listing.seller.review_count} />
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{listing.description}</p>
        <div className="mt-6">
          <Link to={`/checkout/${listing.id}`} className="btn-primary w-full no-underline">Buy now</Link>
          <p className="mt-2 text-xs text-ink/50">
            Payment is handled on the platform. The seller's contact details are shared with you after payment is confirmed.
          </p>
        </div>
      </div>
    </div>
  );
}
