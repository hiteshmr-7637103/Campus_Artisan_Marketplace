import { Link } from "react-router-dom";
import type { Listing } from "../lib/types";
import { formatINR } from "../lib/format";
import { RatingStars } from "./RatingStars";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link to={`/listing/${listing.id}`} className="card group block overflow-hidden no-underline transition hover:shadow-md">
      <div className="relative aspect-square bg-ink/5">
        {listing.images[0] && (
          <img src={listing.images[0]} alt={listing.title} loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-ink/50">{listing.category}</p>
        <h3 className="mt-0.5 line-clamp-1 font-medium">{listing.title}</h3>
        <p className="mt-1 font-semibold">{formatINR(listing.price_paise)}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="line-clamp-1 text-xs text-ink/60">{listing.seller.display_name}</span>
          <RatingStars value={listing.seller.avg_rating} count={listing.seller.review_count} />
        </div>
      </div>
    </Link>
  );
}
