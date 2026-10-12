import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const navClass = ({ isActive }) =>
  `text-sm font-medium transition-colors py-1 border-b-2 no-underline ${
    isActive
      ? "text-brand-terracotta border-brand-terracotta font-semibold"
      : "text-earth-slate border-transparent hover:text-brand-terracotta"
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

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

      {/* Global Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-earth-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Brand Logo & Campus Badge */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-10 h-10 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-xl font-bold shadow-md shadow-brand-terracotta/20 group-hover:scale-105 transition-transform">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-earth-slate">
                  CampCraft
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-sageLight text-accent-sage">
                  📍 Campus Edition
                </span>
              </div>
              <p className="text-xs text-earth-muted hidden sm:block">
                Campus Artisan Collective • Direct from Students
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
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
                Admin
              </NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/account" className={navClass}>
                  {user.full_name.split(" ")[0]}
                </NavLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-medium text-earth-muted hover:text-brand-terracotta"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
            )}
          </nav>

          {/* Sell CTA button */}
          {!isSeller && (
            <Link
              to={sellPath}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 no-underline"
            >
              <span>+</span>
              <span>Sell Your Craft</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Content View Container */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Global Footer (extra bottom padding on mobile clears the fixed bottom nav) */}
      <footer className="bg-[#F5EFEB] border-t border-earth-border mt-16 pt-10 pb-24 md:pb-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-terracotta text-white flex items-center justify-center font-editorial font-bold text-xs">
                C
              </div>
              <span className="font-editorial text-base font-bold text-earth-slate">CampCraft Collective</span>
            </div>
            <p className="text-xs text-earth-muted mt-1">
              A circular collegiate marketplace connecting student makers with campus buyers.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-earth-muted font-medium">
            <Link to="/" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Browse Items
            </Link>
            <Link to={sellPath} className="hover:text-brand-terracotta no-underline text-earth-muted">
              Sell Your Craft
            </Link>
            <Link to="/terms" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Campus Guidelines
            </Link>
            <Link to="/privacy" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Privacy Policy
            </Link>
          </div>

          <div className="text-xs text-earth-muted">
            © {new Date().getFullYear()} CampCraft • Handcrafted for Campus
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
        <Link to={sellPath} className={mobileLink(location.pathname.startsWith("/sell"))}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span>Sell</span>
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
        {user && (
          <Link
            to={user.role === "admin" ? "/admin" : "/account"}
            className={mobileLink(location.pathname.startsWith(user.role === "admin" ? "/admin" : "/account"))}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>{user.role === "admin" ? "Admin" : "Account"}</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
