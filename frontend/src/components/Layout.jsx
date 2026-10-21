import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useWishlist } from "../lib/wishlist";
import { useCart } from "../lib/cart";
import { showToast } from "../lib/toast";

const navClass = ({ isActive }) =>
  `text-sm font-medium transition-colors py-1 border-b-2 no-underline whitespace-nowrap ${
    isActive
      ? "text-brand-terracotta border-brand-terracotta font-semibold"
      : "text-earth-slate border-transparent hover:text-brand-terracotta"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const { count: cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    setMobileUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleToast(e) {
      clearTimeout(toastTimer.current);
      setToast(e.detail);
      toastTimer.current = setTimeout(() => setToast(null), 3200);
    }
    window.addEventListener("campcraft_toast", handleToast);
    return () => {
      window.removeEventListener("campcraft_toast", handleToast);
      clearTimeout(toastTimer.current);
    };
  }, []);

  const isSeller = user?.seller_status === "approved";
  const sellPath = isSeller ? "/sell" : "/sell/apply";

  async function handleLogout() {
    setMobileUserMenuOpen(false);
    await logout();
    navigate("/");
  }

  const mobileLink = (active) =>
    `flex flex-col items-center gap-1 no-underline ${active ? "text-brand-terracotta" : "text-earth-muted"}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-earth-slate selection:bg-[#C85A32]/20 selection:text-[#B84A24]">
      {/* Global Notification Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-earth-slate text-white shadow-xl"
        >
          <span className="text-amber-400">{toast.icon || "✨"}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Campus Announcement Bar */}
      <div className="bg-brand-clayLight border-b border-earth-border/60 py-2 text-xs font-medium text-earth-slate">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-brand-clayDark">Spring Quad Fair:</span>
            <span className="text-earth-muted hidden sm:inline">
              Safe in-person handoffs across campus hubs • Use code <strong className="text-brand-terracotta">STUDENT10</strong> for 10% off!
            </span>
            <span className="text-earth-muted sm:hidden">
              Use code <strong className="text-brand-terracotta">STUDENT10</strong> for 10% off!
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11px] text-earth-muted">
            <span className="flex items-center gap-1">📍 5 Quad Pickup Hubs</span>
            <span>•</span>
            <span className="flex items-center gap-1">🎓 100% Student Made</span>
          </div>
        </div>
      </div>

      {/* Global Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-earth-border shadow-2xs transition-all relative">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4 lg:gap-8">
          {/* Brand Logo & Campus Badge */}
          <Link to="/" className="flex items-center gap-3 no-underline group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-xl font-bold shadow-md shadow-brand-terracotta/20 group-hover:scale-105 transition-transform">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-earth-slate">
                  CampCraft
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-sageLight text-accent-sage">
                  📍 Campus Market
                </span>
              </div>
              <p className="text-xs text-earth-muted hidden sm:block">
                Collegiate Artisan Collective • Handcrafted by Students
              </p>
            </div>
          </Link>

          {/* Desktop Center Nav Links with generous breathing room */}
          <nav className="hidden md:flex items-center justify-center gap-8 xl:gap-10 text-sm font-medium">
            <NavLink to="/" end className={navClass}>
              Browse Crafts
            </NavLink>
            {user && (
              <NavLink to="/orders" className={navClass}>
                My Orders
              </NavLink>
            )}
            {isSeller && (
              <NavLink to="/sell" end className={navClass}>
                Seller Studio
              </NavLink>
            )}
            {user?.role === "admin" && (
              <NavLink to="/admin" className={navClass}>
                Admin Portal
              </NavLink>
            )}
          </nav>

          {/* Right Header Actions: Auth, Wishlist, Cart & Sell CTA */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            {/* Desktop Auth Controls */}
            {user ? (
              <div className="hidden sm:flex items-center gap-3 pr-2 border-r border-earth-border">
                <NavLink
                  to="/account"
                  className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-white border border-earth-border hover:border-brand-terracotta text-xs font-semibold text-earth-slate no-underline transition shadow-2xs"
                  title="Your Account"
                >
                  <span className="w-6 h-6 rounded-lg bg-brand-terracotta text-white flex items-center justify-center font-bold text-[11px]">
                    {user.full_name?.charAt(0) || "U"}
                  </span>
                  <span className="max-w-[100px] truncate">{user.full_name.split(" ")[0]}</span>
                  {isSeller && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                      Maker
                    </span>
                  )}
                </NavLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-semibold text-earth-muted hover:text-brand-terracotta transition cursor-pointer"
                  title="Log out of session"
                >
                  Log out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl border border-earth-border bg-white text-xs font-semibold text-earth-slate hover:border-brand-terracotta hover:text-brand-terracotta transition shadow-2xs no-underline"
              >
                Log in
              </NavLink>
            )}

            {/* Wishlist */}
            <NavLink
              to="/wishlist"
              onClick={() => {
                if (!user) {
                  showToast("Please log in to view your saved crafts", "🔒");
                }
              }}
              className={({ isActive }) =>
                `relative p-2 sm:p-2.5 rounded-2xl border transition-all no-underline flex items-center justify-center ${
                  isActive
                    ? "bg-red-50 text-red-600 border-red-200 ring-2 ring-red-100"
                    : "bg-white text-earth-slate border-earth-border hover:border-earth-slate hover:text-red-500 shadow-2xs"
                }`
              }
              aria-label={`Wishlist (${wishlistCount} saved items)`}
              title="Saved Crafts"
            >
              <svg className="w-5 h-5" fill={wishlistCount > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow-sm animate-heart-pop">
                  {wishlistCount}
                </span>
              )}
            </NavLink>

            {/* Shopping Bag (Cart) */}
            <NavLink
              to="/cart"
              onClick={() => {
                if (!user) {
                  showToast("Please log in to view your shopping bag", "🔒");
                }
              }}
              className={({ isActive }) =>
                `relative p-2 sm:p-2.5 rounded-2xl border transition-all no-underline flex items-center justify-center ${
                  isActive
                    ? "bg-brand-clayLight text-brand-clayDark border-brand-terracotta/40 ring-2 ring-brand-terracotta/10"
                    : "bg-white text-earth-slate border-earth-border hover:border-earth-slate shadow-2xs"
                }`
              }
              aria-label={`Shopping Bag (${cartCount} items)`}
              title="Shopping Bag"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-brand-terracotta text-white text-[11px] font-bold flex items-center justify-center shadow-sm animate-heart-pop">
                  {cartCount}
                </span>
              )}
            </NavLink>

            {/* Sell CTA (Desktop) */}
            {!isSeller && (
              <Link
                to={sellPath}
                className="hidden sm:flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95 no-underline ml-1"
              >
                <span>+</span>
                <span>Sell Your Craft</span>
              </Link>
            )}

            {/* Mobile Header Controls: User Avatar Dropdown OR Mobile Log In */}
            <div className="sm:hidden flex items-center">
              {user ? (
                <button
                  type="button"
                  onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                  className="relative flex items-center gap-1.5 p-1 rounded-xl bg-white border border-earth-border shadow-2xs active:scale-95 transition cursor-pointer"
                  aria-label="Toggle user menu"
                >
                  <span className="w-7 h-7 rounded-lg bg-brand-terracotta text-white flex items-center justify-center font-bold text-xs">
                    {user.full_name?.charAt(0) || "U"}
                  </span>
                  <svg className="w-3.5 h-3.5 text-earth-muted mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              ) : (
                <NavLink
                  to="/login"
                  className="px-2.5 py-1.5 rounded-xl border border-earth-border bg-white text-xs font-semibold text-earth-slate hover:text-brand-terracotta transition shadow-2xs no-underline"
                >
                  Log in
                </NavLink>
              )}
            </div>
          </div>
        </div>

        {/* Mobile User Dropdown Menu with Instant Log Out */}
        {mobileUserMenuOpen && user && (
          <>
            <div
              className="fixed inset-0 z-40 bg-earth-slate/20 backdrop-blur-2xs sm:hidden"
              onClick={() => setMobileUserMenuOpen(false)}
            />
            <div className="absolute top-full right-4 sm:hidden z-50 mt-1 w-72 rounded-2xl bg-[#FDFBF7] border border-earth-border shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-earth-border">
                <div className="w-10 h-10 rounded-xl bg-brand-terracotta text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {user.full_name?.charAt(0) || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-earth-slate truncate">{user.full_name}</p>
                  <p className="text-xs text-earth-muted truncate">{user.email}</p>
                  {isSeller && (
                    <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                      Verified Maker
                    </span>
                  )}
                </div>
              </div>

              <div className="py-2 space-y-1">
                <Link
                  to="/account"
                  onClick={() => setMobileUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-earth-slate hover:bg-white hover:text-brand-terracotta no-underline transition"
                >
                  <span>👤</span>
                  <span>Account &amp; Security</span>
                </Link>
                <Link
                  to="/orders"
                  onClick={() => setMobileUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-earth-slate hover:bg-white hover:text-brand-terracotta no-underline transition"
                >
                  <span>📦</span>
                  <span>My Orders</span>
                </Link>
                <Link
                  to="/wishlist"
                  onClick={() => setMobileUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-earth-slate hover:bg-white hover:text-brand-terracotta no-underline transition"
                >
                  <span>❤️</span>
                  <span>Saved Crafts ({wishlistCount})</span>
                </Link>
                {isSeller && (
                  <Link
                    to="/sell"
                    onClick={() => setMobileUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-earth-slate hover:bg-white hover:text-brand-terracotta no-underline transition"
                  >
                    <span>✨</span>
                    <span>Seller Studio</span>
                  </Link>
                )}
                {user.role === "admin" && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-earth-slate hover:bg-white hover:text-brand-terracotta no-underline transition"
                  >
                    <span>🛡️</span>
                    <span>Admin Portal</span>
                  </Link>
                )}
              </div>

              <div className="pt-2 border-t border-earth-border">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Log Out of Session</span>
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Main Content View Container (extra bottom padding on mobile clears sticky bottom nav) */}
      <main className="flex-grow pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Global Rich Collegiate E-Commerce Footer */}
      <footer className="bg-[#F7F2EB] border-t border-earth-border mt-20 pt-16 pb-24 md:pb-12 px-4 sm:px-6">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main 4-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-earth-border/80">
            {/* Col 1: Brand & Campus Circular Economy */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-xl font-bold shadow-xs">
                  C
                </div>
                <div>
                  <span className="font-editorial text-lg font-bold text-earth-slate">
                    CampCraft Collective
                  </span>
                  <p className="text-[11px] text-accent-sage font-semibold uppercase tracking-wider">
                    📍 Campus Artisan Network
                  </p>
                </div>
              </div>
              <p className="text-xs text-earth-muted leading-relaxed">
                A circular collegiate economy connecting student makers directly with campus buyers. Zero shipping packaging, zero corporate markup, and 100% verified student creations.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-white border border-earth-border text-[11px] font-semibold text-earth-slate flex items-center gap-1.5 shadow-2xs">
                  <span>🎓</span>
                  <span>100% Student Makers</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-white border border-earth-border text-[11px] font-semibold text-earth-slate flex items-center gap-1.5 shadow-2xs">
                  <span>🤝</span>
                  <span>Direct Quad Pickups</span>
                </div>
              </div>
            </div>

            {/* Col 2: Shop by Category */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-earth-slate">
                Craft Categories
              </h3>
              <ul className="space-y-2 text-xs text-earth-muted">
                <li>
                  <Link to="/?category=jewelry" className="hover:text-brand-terracotta transition no-underline">
                    💎 Handcrafted Jewelry & Charms
                  </Link>
                </li>
                <li>
                  <Link to="/?category=pottery" className="hover:text-brand-terracotta transition no-underline">
                    🏺 Wheel-thrown Pottery & Stoneware
                  </Link>
                </li>
                <li>
                  <Link to="/?category=decor" className="hover:text-brand-terracotta transition no-underline">
                    🎨 Dorm Decor, Candles & Prints
                  </Link>
                </li>
                <li>
                  <Link to="/?category=textiles" className="hover:text-brand-terracotta transition no-underline">
                    🧶 Handwoven Textiles & Crochet
                  </Link>
                </li>
                <li>
                  <Link to="/?category=other" className="hover:text-brand-terracotta transition no-underline">
                    👜 Leather, Woodcraft & Notebooks
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Student Artisan Hub */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-earth-slate">
                Artisan Hub
              </h3>
              <ul className="space-y-2 text-xs text-earth-muted">
                <li>
                  <Link to={sellPath} className="hover:text-brand-terracotta transition no-underline font-semibold text-brand-clayDark">
                    Open Dorm Studio →
                  </Link>
                </li>
                <li>
                  <Link to="/sell" className="hover:text-brand-terracotta transition no-underline">
                    Seller Studio Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-brand-terracotta transition no-underline">
                    Artisan Honor Code
                  </Link>
                </li>
                <li>
                  <Link to="/account" className="hover:text-brand-terracotta transition no-underline">
                    Payout UPI Settings
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Quad Logistics & Pickups */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-earth-slate">
                Campus Handoff Hubs
              </h3>
              <p className="text-xs text-earth-muted">
                Orders are hand-delivered at official campus meeting spots:
              </p>
              <div className="space-y-1.5 text-[11px] text-earth-slate font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-terracotta">•</span>
                  <span>Student Union Central Quad</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-terracotta">•</span>
                  <span>University Library South Steps</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-terracotta">•</span>
                  <span>Engineering Quad & Atrium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-terracotta">•</span>
                  <span>North & South Residence Halls</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-earth-muted">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>CampCraft Network Online • Node active for Student Community</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/terms" className="hover:text-brand-terracotta no-underline text-earth-muted">
                Campus Honor Code
              </Link>
              <Link to="/privacy" className="hover:text-brand-terracotta no-underline text-earth-muted">
                Privacy
              </Link>
              <span>© {new Date().getFullYear()} CampCraft</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-earth-border z-40 px-6 py-2.5 flex items-center justify-around text-[11px] font-semibold text-earth-muted shadow-lg"
      >
        <Link to="/" className={mobileLink(location.pathname === "/")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Browse</span>
        </Link>
        <Link
          to="/wishlist"
          onClick={() => {
            if (!user) {
              showToast("Please log in to view your saved crafts", "🔒");
            }
          }}
          className={mobileLink(location.pathname === "/wishlist")}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill={wishlistCount > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </div>
          <span>Saved</span>
        </Link>
        <Link
          to="/cart"
          onClick={() => {
            if (!user) {
              showToast("Please log in to view your shopping bag", "🔒");
            }
          }}
          className={mobileLink(location.pathname === "/cart")}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand-terracotta text-white text-[9px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span>Bag</span>
        </Link>
        {user ? (
          <Link to="/orders" className={mobileLink(location.pathname.startsWith("/orders"))}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Orders</span>
          </Link>
        ) : (
          <Link to={sellPath} className={mobileLink(location.pathname.startsWith("/sell"))}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
            <span>Sell</span>
          </Link>
        )}
        {user ? (
          <Link
            to={user.role === "admin" ? "/admin" : "/account"}
            className={mobileLink(location.pathname.startsWith(user.role === "admin" ? "/admin" : "/account"))}
          >
            <div className="w-5 h-5 rounded-full bg-brand-terracotta text-white flex items-center justify-center text-[10px] font-bold">
              {user.full_name?.charAt(0) || "U"}
            </div>
            <span>{user.role === "admin" ? "Admin" : "Account"}</span>
          </Link>
        ) : (
          <Link to="/login" className={mobileLink(location.pathname === "/login")}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Log in</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
