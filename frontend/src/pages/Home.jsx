import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, fetchListings } from "../lib/api";
import { CATEGORY_EMOJI } from "../lib/types";
import { ListingCard } from "../components/ListingCard";
import { Notice, Spinner } from "../components/ui";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest Arrivals" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Top Rated" },
];

const PRICE_RANGES = [
  { id: "all", label: "All Prices" },
  { id: "under_500", label: "Under ₹500", min: 0, max: 50000 },
  { id: "500_1500", label: "₹500 – ₹1,500", min: 50000, max: 150000 },
  { id: "above_1500", label: "Above ₹1,500", min: 150000, max: Infinity },
];

export function Home() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState("all");
  const [page, setPage] = useState(1);
  const [rawItems, setRawItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchListings({ category, q: query, page })
      .then((r) => {
        if (cancelled) return;
        setRawItems((prev) => (page === 1 || !prev ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [category, query, page]);

  function restart(update) {
    setRawItems(null);
    setPage(1);
    update();
  }

  function resetAllFilters() {
    setCategory("");
    setQ("");
    setQuery("");
    setPriceRange("all");
    setSortBy("newest");
    setPage(1);
  }

  // Filter & Sort client-side over loaded items for instant responsiveness
  const filteredAndSortedItems = useMemo(() => {
    if (!rawItems) return null;
    let list = [...rawItems];

    // Price range filter
    const activeRange = PRICE_RANGES.find((r) => r.id === priceRange);
    if (activeRange && activeRange.id !== "all") {
      list = list.filter(
        (item) => item.price_paise >= activeRange.min && item.price_paise <= activeRange.max
      );
    }

    // Sort
    if (sortBy === "price_asc") {
      list.sort((a, b) => a.price_paise - b.price_paise);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.price_paise - a.price_paise);
    } else if (sortBy === "rating_desc") {
      list.sort((a, b) => (b.seller?.avg_rating || 0) - (a.seller?.avg_rating || 0));
    } else {
      // newest
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return list;
  }, [rawItems, priceRange, sortBy]);

  const pills = [{ slug: "", name: "All Categories" }, ...categories];
  const hasActiveFilters = Boolean(category || query || priceRange !== "all" || sortBy !== "newest");
  const selectedCategoryObj = categories.find((c) => c.slug === category);

  return (
    <div>
      {/* Hero Showcase Section */}
      <section className="relative bg-gradient-to-b from-brand-clayLight/80 via-brand-clayLight/40 to-[#FDFBF7] border-b border-earth-border py-12 sm:py-20 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-earth-border shadow-xs text-xs font-semibold text-accent-sage mb-4 backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-accent-sage animate-pulse" />
            <span>Spring Semester Makers Market Open</span>
          </div>

          <h1 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-earth-slate max-w-3xl leading-[1.15]">
            Handcrafted on Campus by{" "}
            <span className="italic text-brand-terracotta underline decoration-accent-ochre/40 decoration-wavy underline-offset-8">
              Fellow Students
            </span>.
          </h1>

          <p className="text-base sm:text-lg text-earth-muted mt-4 max-w-2xl font-normal leading-relaxed">
            Support local student makers. Discover handmade silver jewelry, ceramic planters, dorm decor, and crochet art—picked up easily right between classes.
          </p>

          {/* Value Badges */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 sm:mt-8 w-full max-w-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 p-2 sm:p-3 rounded-2xl bg-white/90 border border-earth-border text-[11px] sm:text-sm font-semibold text-earth-slate shadow-xs text-center sm:text-left hover:border-earth-slate/40 transition-colors">
              <span className="text-amber-500 text-sm sm:text-base">✨</span>
              <span>100% Student Made</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 p-2 sm:p-3 rounded-2xl bg-white/90 border border-earth-border text-[11px] sm:text-sm font-semibold text-earth-slate shadow-xs text-center sm:text-left hover:border-earth-slate/40 transition-colors">
              <span className="text-accent-sage text-sm sm:text-base">⚡</span>
              <span>Zero Shipping Pickup</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 p-2 sm:p-3 rounded-2xl bg-white/90 border border-earth-border text-[11px] sm:text-sm font-semibold text-earth-slate shadow-xs text-center sm:text-left hover:border-earth-slate/40 transition-colors">
              <span className="text-blue-600 text-sm sm:text-base">🔒</span>
              <span>Secure Razorpay</span>
            </div>
          </div>
        </div>

        {/* Subtle decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-brand-terracotta/5 rounded-full blur-3xl pointer-events-none -z-0" />
      </section>

      {/* Filter & Search Bar Strip */}
      <section className="sticky top-16 sm:top-20 z-30 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-earth-border py-3 px-4 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          {/* Top row: Categories & Search */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            {/* Category scrollable tabs (edge-to-edge scroll on mobile) */}
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 lg:pb-0 custom-scroll -mx-4 px-4 sm:mx-0 sm:px-0">
              {pills.map((cat) => {
                const isActive = category === cat.slug;
                return (
                  <button
                    key={cat.slug || "all"}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => restart(() => setCategory(cat.slug))}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-earth-slate text-white shadow-sm scale-[1.02]"
                        : "bg-white text-earth-slate/80 border border-earth-border hover:border-earth-slate hover:text-earth-slate"
                    }`}
                  >
                    {cat.slug && CATEGORY_EMOJI[cat.slug] ? `${CATEGORY_EMOJI[cat.slug]} ` : ""}
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <form
              role="search"
              className="flex w-full lg:w-auto items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                restart(() => setQuery(q.trim()));
              }}
            >
              <div className="relative w-full sm:w-64">
                <input
                  type="search"
                  aria-label="Search crafts"
                  placeholder="Search jewelry, decor, pottery…"
                  maxLength={100}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-white border border-earth-border rounded-xl pl-9 pr-3 py-2 text-xs text-earth-slate focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/10 shadow-xs"
                />
                <svg
                  className="w-4 h-4 text-earth-muted absolute left-3 top-2.5 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-earth-slate hover:bg-stone-800 text-white text-xs font-semibold transition-all active:scale-95 shadow-xs shrink-0"
              >
                Search
              </button>
            </form>
          </div>

          {/* Bottom row: Price Filters & Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-earth-border/60 text-xs">
            {/* Price filter chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-earth-muted font-medium mr-1 hidden sm:inline">Price:</span>
              {PRICE_RANGES.map((pr) => {
                const isSelected = priceRange === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => setPriceRange(pr.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      isSelected
                        ? "bg-brand-clayLight text-brand-clayDark font-bold border border-brand-terracotta/30"
                        : "bg-white text-earth-muted hover:text-earth-slate border border-earth-border/80"
                    }`}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-2 ml-auto">
              <label htmlFor="sort-select" className="text-earth-muted font-medium">
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-earth-border rounded-lg px-2.5 py-1 text-xs text-earth-slate font-medium focus:outline-none focus:border-brand-terracotta shadow-xs cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Feed Section */}
      <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Results Bar & Active Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-earth-border/70">
          <div className="flex items-center gap-2">
            <h2 className="font-editorial text-xl sm:text-2xl font-bold text-earth-slate">
              {selectedCategoryObj ? selectedCategoryObj.name : "All Handcrafted Items"}
            </h2>
            {filteredAndSortedItems && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-earth-border/50 text-earth-muted">
                {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? "craft" : "crafts"}
              </span>
            )}
          </div>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-earth-border text-xs text-earth-slate font-medium shadow-xs">
                  <span>Category: {selectedCategoryObj?.name || category}</span>
                  <button
                    type="button"
                    onClick={() => restart(() => setCategory(""))}
                    className="hover:text-red-600 font-bold ml-0.5"
                    aria-label="Remove category filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {query && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-earth-border text-xs text-earth-slate font-medium shadow-xs">
                  <span>Search: “{query}”</span>
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      restart(() => setQuery(""));
                    }}
                    className="hover:text-red-600 font-bold ml-0.5"
                    aria-label="Remove search filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {priceRange !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-earth-border text-xs text-earth-slate font-medium shadow-xs">
                  <span>{PRICE_RANGES.find((r) => r.id === priceRange)?.label}</span>
                  <button
                    type="button"
                    onClick={() => setPriceRange("all")}
                    className="hover:text-red-600 font-bold ml-0.5"
                    aria-label="Remove price filter"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-brand-terracotta hover:underline font-semibold ml-1"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {error && <Notice kind="error">{error}</Notice>}
        {!error && filteredAndSortedItems === null && <Spinner label="Loading campus crafts…" />}

        {/* Empty state */}
        {!error && filteredAndSortedItems?.length === 0 && (
          <div className="text-center py-20 px-4 bg-white rounded-3xl border border-dashed border-earth-border shadow-xs my-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-clayLight flex items-center justify-center text-3xl">
              🔍
            </div>
            <h3 className="font-editorial text-2xl font-bold text-earth-slate">
              {query ? `No items found matching “${query}”` : "No crafts match the selected filters"}
            </h3>
            <p className="text-sm text-earth-muted max-w-md mx-auto mt-2 leading-relaxed">
              Try adjusting your price range or search terms, or explore other student-made categories.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetAllFilters}
                className="btn-primary"
              >
                Clear All Filters
              </button>
              <Link
                to="/sell/apply"
                className="btn-ghost no-underline"
              >
                + Become a Student Seller
              </Link>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {filteredAndSortedItems && filteredAndSortedItems.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredAndSortedItems.map((item) => (
                <ListingCard key={item.id} listing={item} />
              ))}
            </div>

            {rawItems && rawItems.length < total && (
              <div className="mt-12 text-center">
                <button
                  type="button"
                  className="px-6 py-3 rounded-2xl bg-white border border-earth-border hover:border-earth-slate text-earth-slate font-semibold text-sm transition-all shadow-xs hover:shadow-md active:scale-95"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load More Crafts ({total - rawItems.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Campus Trust & Safety Banner */}
      <section className="max-w-6xl mx-auto px-4 mb-16">
        <div className="bg-gradient-to-br from-accent-sage via-[#3D5B45] to-[#2E4634] text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div className="max-w-xl z-10">
            <span className="text-[11px] uppercase tracking-widest text-emerald-200 font-bold bg-white/10 px-3 py-1 rounded-full">
              Safe & Direct Campus Commerce
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold mt-3 leading-snug">
              Handcrafted Locally, Exchanged in Person
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-6 text-xs text-emerald-50">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="font-bold text-white text-sm block mb-1">1. Buy Online</span>
                Secure payment held safely until your handoff is arranged.
              </div>
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="font-bold text-white text-sm block mb-1">2. Contact Maker</span>
                Instant access to WhatsApp/Instagram after checkout confirmation.
              </div>
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="font-bold text-white text-sm block mb-1">3. Meet at the Quad</span>
                Pick up right on campus—zero shipping fees, zero postal wait.
              </div>
            </div>
          </div>
          <div className="z-10 shrink-0">
            <Link
              to="/terms"
              className="inline-block px-6 py-3.5 rounded-2xl bg-white text-accent-sage font-bold text-sm hover:bg-emerald-50 transition-all shadow-lg active:scale-95 no-underline"
            >
              How It Works & Guidelines →
            </Link>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        </div>
      </section>
    </div>
  );
}
