import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCategories, fetchListings } from "../lib/api";
import { CATEGORY_EMOJI } from "../lib/types";
import { ListingCard } from "../components/ListingCard";
import { Notice, Spinner } from "../components/ui";

export function Home() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(null);
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
        setItems((prev) => (page === 1 || !prev ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [category, query, page]);

  function restart(update) {
    setItems(null);
    setPage(1);
    update();
  }

  const pills = [{ slug: "", name: "All Items" }, ...categories];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-brand-clayLight/60 border-b border-earth-border py-10 sm:py-16 px-4">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-earth-border shadow-xs text-xs font-semibold text-accent-sage mb-4">
            <span className="w-2 h-2 rounded-full bg-accent-sage animate-pulse" />
            Spring Semester Makers Market Open
          </div>

          <h1 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-earth-slate max-w-3xl leading-[1.15]">
            Handcrafted on Campus by{" "}
            <span className="italic text-brand-terracotta underline decoration-accent-ochre/40 decoration-wavy">
              Fellow Students
            </span>
            .
          </h1>

          <p className="text-base sm:text-lg text-earth-muted mt-4 max-w-2xl font-normal leading-relaxed">
            Support local student makers. Discover handmade silver jewelry, ceramic planters, dorm decor, and crochet art—picked up easily right between classes.
          </p>

          {/* Quick Trust Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-8 w-full max-w-2xl">
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 border border-earth-border text-xs sm:text-sm font-medium text-earth-slate shadow-xs">
              <span className="text-amber-500">✨</span> 100% Student Made
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 border border-earth-border text-xs sm:text-sm font-medium text-earth-slate shadow-xs">
              <span className="text-accent-sage">⚡</span> Zero Shipping / Campus Pickup
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/80 border border-earth-border text-xs sm:text-sm font-medium text-earth-slate shadow-xs">
              <span className="text-blue-600">🔒</span> Secure Razorpay Checkout
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter Bar & Live Search */}
      <section className="sticky top-16 sm:top-20 z-30 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-earth-border py-3">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Horizontal Scrollable Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-1 sm:pb-0 custom-scroll">
            {pills.map((cat) => {
              const isActive = category === cat.slug;
              return (
                <button
                  key={cat.slug || "all"}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => restart(() => setCategory(cat.slug))}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-earth-slate text-white shadow-xs"
                      : "bg-white text-earth-muted border border-earth-border hover:border-earth-slate"
                  }`}
                >
                  {cat.slug && CATEGORY_EMOJI[cat.slug] ? `${CATEGORY_EMOJI[cat.slug]} ` : ""}
                  {cat.name}
                  {!cat.slug && items && !query && !category ? ` (${total})` : ""}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <form
            role="search"
            className="flex w-full sm:w-auto items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              restart(() => setQuery(q.trim()));
            }}
          >
            <input
              type="search"
              aria-label="Search crafts"
              placeholder="Search crafts…"
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-48 bg-white border border-earth-border rounded-lg px-3 py-1.5 text-xs text-earth-slate focus:outline-none focus:ring-1 focus:ring-brand-terracotta"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-earth-slate text-white text-xs font-semibold">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Product Feed Grid */}
      <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {error && <Notice kind="error">{error}</Notice>}
        {!error && items === null && <Spinner label="Loading crafts…" />}
        {!error && items?.length === 0 && (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-earth-border mt-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-clayLight flex items-center justify-center text-2xl">
              🪴
            </div>
            <h3 className="font-editorial text-xl font-bold text-earth-slate">
              {query ? `Nothing matches “${query}”` : "No crafts found here yet"}
            </h3>
            <p className="text-sm text-earth-muted max-w-md mx-auto mt-2">
              Be the pioneer! Students are looking for handmade pieces right now. List yours in under 2 minutes.
            </p>
            <Link
              to="/sell/apply"
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-brand-terracotta text-white text-sm font-semibold hover:bg-brand-clayDark transition-colors no-underline"
            >
              + List Your Craft Here
            </Link>
          </div>
        )}
        {items && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
              {items.map((item) => (
                <ListingCard key={item.id} listing={item} />
              ))}
            </div>
            {items.length < total && (
              <div className="mt-8 text-center">
                <button type="button" className="btn-ghost" onClick={() => setPage((p) => p + 1)}>
                  Load more crafts
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Campus Story Banner */}
      <section className="max-w-6xl mx-auto px-4 mb-16">
        <div className="bg-accent-sage text-white rounded-3xl p-6 sm:p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl z-10">
            <span className="text-xs uppercase tracking-widest text-emerald-200 font-bold">
              Collegiate Circular Economy
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold mt-2">
              How CampCraft Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-sm text-emerald-50">
              <div>
                <span className="font-bold text-white block mb-1">1. Browse & Buy</span>
                Log in with your college email and pay securely via Razorpay (UPI or card).
              </div>
              <div>
                <span className="font-bold text-white block mb-1">2. Unlock Contact</span>
                The artisan's phone & Instagram are shown to you once payment is confirmed.
              </div>
              <div>
                <span className="font-bold text-white block mb-1">3. Quad Handoff</span>
                Coordinate a quick handoff between classes at the Student Union.
              </div>
            </div>
          </div>
          <div className="z-10">
            <Link
              to="/terms"
              className="inline-block px-6 py-3 rounded-xl bg-white text-accent-sage font-semibold text-sm hover:bg-emerald-50 transition-colors shadow-lg no-underline"
            >
              Read Campus Rules & Safety
            </Link>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-700/30 blur-2xl pointer-events-none" />
        </div>
      </section>
    </div>
  );
}
