import { Link } from "react-router-dom";
import type { PublicListing } from "../lib/types";
import { CATEGORY_LABEL } from "../lib/types";
import { formatINR } from "../lib/format";
import { RatingStars } from "./RatingStars";

export function ListingCard({ listing }: { listing: PublicListing }) {
  const sold = listing.status === "sold";
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="card group block overflow-hidden no-underline transition hover:shadow-md"
    >
      <div className="relative aspect-square bg-ink/5">
        <img
          src={listing.photo_urls[0]}
          alt={listing.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {sold && (
          <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-medium text-white">
            Sold
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wide text-ink/50">
          {CATEGORY_LABEL[listing.category]}
        </p>
        <h3 className="mt-0.5 line-clamp-1 font-medium">{listing.title}</h3>
        <p className="mt-1 font-semibold">{formatINR(listing.price_buyer)}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="line-clamp-1 text-xs text-ink/60">
            {listing.artisan_name ?? "Campus artisan"}
          </span>
          <RatingStars
            value={listing.artisan_avg_rating}
            count={listing.artisan_review_count}
          />
        </div>
      </div>
    </Link>
  );
}
