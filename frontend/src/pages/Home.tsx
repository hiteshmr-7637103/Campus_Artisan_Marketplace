import { useEffect, useState } from "react";
import { fetchListings } from "../lib/api";
import type { Category, PublicListing } from "../lib/types";
import { ListingCard } from "../components/ListingCard";
import { CategoryFilter } from "../components/CategoryFilter";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Home() {
  const [listings, setListings] = useState<PublicListing[] | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setListings(null);
    setError(null);
    fetchListings(category)
      .then((rows) => !cancelled && setListings(rows))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Handmade by campus artisans</h1>
        <p className="mt-1 text-sm text-ink/60">
          Pay safely on the platform — no DMs, no chasing UPI.
        </p>
      </div>

      <div className="mb-5">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {!error && listings === null && <Spinner label="Loading listings…" />}
      {!error && listings?.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          hint="Check back soon, or if you make things — list them from “Sell your work”."
        />
      )}

      {listings && listings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
