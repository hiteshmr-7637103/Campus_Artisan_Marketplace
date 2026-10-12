import { useEffect, useState } from "react";
import { fetchCategories, fetchListings } from "../lib/api";
import type { Category, Listing } from "../lib/types";
import { ListingCard } from "../components/ListingCard";
import { CategoryFilter } from "../components/CategoryFilter";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Listing[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}); }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchListings({ category, q: query, page })
      .then((r) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 || !prev ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [category, query, page]);

  const reset = () => { setItems(null); setPage(1); };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Handmade by campus artisans</h1>
        <p className="mt-1 text-sm text-ink/60">Pay safely on the platform — no DMs, no chasing UPI.</p>
      </div>

      <form className="mb-4 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); reset(); setQuery(q.trim()); }}>
        <input className="field-input" type="search" placeholder="Search by title…" aria-label="Search listings" value={q} maxLength={100} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>

      <div className="mb-5">
        <CategoryFilter categories={categories} value={category} onChange={(c) => { reset(); setCategory(c); }} />
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {!error && items === null && <Spinner label="Loading listings…" />}
      {!error && items?.length === 0 && (
        <EmptyState title="Nothing here yet" hint="Check back soon, or if you make things — list them from “Sell your work”." />
      )}
      {items && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
          {items.length < total && (
            <div className="mt-6 text-center">
              <button className="btn-ghost" onClick={() => setPage((p) => p + 1)}>Load more</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
