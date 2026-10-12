import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchListings } from "../lib/api";
import { getStoredProducts } from "../lib/mockData";
import { ListingCard } from "../components/ListingCard";

const CATEGORIES = [
  { key: "All", label: "All Items" },
  { key: "jewelry", label: "💍 Jewelry" },
  { key: "decor", label: "🪴 Dorm Decor" },
  { key: "textiles", label: "🧵 Textiles & Crochet" },
  { key: "pottery", label: "🏺 Pottery & Ceramics" },
  { key: "art", label: "🎨 Art & Prints" },
];

export function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("curated");
  const [products, setProducts] = useState(() => getStoredProducts());

  useEffect(() => {
    fetchListings()
      .then((rows) => {
        if (rows && rows.length > 0) {
          const mapped = rows.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            price: Math.round(r.price_buyer / 100),
            status: r.status === "sold" ? "Sold Out" : "Active",
            artisan: r.artisan_name || "Campus Artisan",
            artisanDept: "Campus Artisan",
            artisanPhone: "",
            artisanEmail: "",
            artisanInsta: "",
            artisanUpi: "",
            rating: r.artisan_avg_rating ?? 5.0,
            salesCount: r.artisan_review_count ?? 1,
            images: r.photo_urls && r.photo_urls.length > 0 ? r.photo_urls : [
              "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80"
            ],
            description: r.description,
            pickupNote: "Campus handoff coordinated directly.",
          }));
          setProducts(mapped);
        } else {
          setProducts(getStoredProducts());
        }
      })
      .catch(() => {
        setProducts(getStoredProducts());
      });
  }, []);

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== "All") {
      list = list.filter((p) => {
        const cat = (p.category || "").toLowerCase();
        const sel = selectedCategory.toLowerCase();
        if (sel === "art") return cat === "art" || cat === "other";
        return cat === sel;
      });
    }

    if (sortBy === "low-to-high") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high-to-low") {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [products, selectedCategory, sortBy]);

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
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              const countLabel = cat.key === "All" ? ` (${products.length})` : "";
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-earth-slate text-white shadow-xs"
                      : "bg-white text-earth-muted border border-earth-border hover:border-earth-slate"
                  }`}
                >
                  {cat.label}
                  {countLabel}
                </button>
              );
            })}
          </div>

          {/* Sort Controller */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-earth-muted whitespace-nowrap">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-earth-border rounded-lg px-2 py-1 text-xs text-earth-slate focus:outline-none focus:ring-1 focus:ring-brand-terracotta"
            >
              <option value="curated">Curated & Campus Popular</option>
              <option value="low-to-high">Price: Low to High</option>
              <option value="high-to-low">Price: High to Low</option>
            </select>
          </div>
        </div>
      </section>

      {/* Product Feed Grid */}
      <section className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-earth-border mt-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-clayLight flex items-center justify-center text-2xl">
              🪴
            </div>
            <h3 className="font-editorial text-xl font-bold text-earth-slate">
              No crafts found in this category yet
            </h3>
            <p className="text-sm text-earth-muted max-w-md mx-auto mt-2">
              Be the pioneer! Students are looking for handmade pieces right now. List yours in under 2 minutes.
            </p>
            <Link
              to="/sell"
              className="inline-block mt-5 px-5 py-2.5 rounded-xl bg-brand-terracotta text-white text-sm font-semibold hover:bg-brand-clayDark transition-colors no-underline"
            >
              + List Your Craft Here
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
            {filtered.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
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
                No account required. Instant Razorpay checkout via UPI or card.
              </div>
              <div>
                <span className="font-bold text-white block mb-1">2. Unlock Contact</span>
                Instant WhatsApp details & student ID confirmed upon purchase.
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
