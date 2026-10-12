import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { supabaseConfigured } from "../lib/supabaseClient";

export function Layout() {
  const [toast, setToast] = useState(null);
  const location = useLocation();

  useEffect(() => {
    function handleToast(e) {
      setToast(e.detail);
      const timer = setTimeout(() => {
        setToast(null);
      }, 3200);
      return () => clearTimeout(timer);
    }
    window.addEventListener("campcraft_toast", handleToast);
    return () => window.removeEventListener("campcraft_toast", handleToast);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-earth-slate selection:bg-[#C85A32]/20 selection:text-[#B84A24]">
      {/* Global Notification Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-earth-slate text-white shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4"
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
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-sm font-medium transition-colors py-1 border-b-2 no-underline ${
                  isActive
                    ? "text-brand-terracotta border-brand-terracotta font-semibold"
                    : "text-earth-slate border-transparent hover:text-brand-terracotta"
                }`
              }
            >
              Browse Crafts
            </NavLink>
            <NavLink
              to="/sell"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors py-1 border-b-2 no-underline ${
                  isActive
                    ? "text-brand-terracotta border-brand-terracotta font-semibold"
                    : "text-earth-slate border-transparent hover:text-brand-terracotta"
                }`
              }
            >
              How It Works
            </NavLink>
            <NavLink
              to="/terms"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors py-1 border-b-2 no-underline ${
                  isActive
                    ? "text-brand-terracotta border-brand-terracotta font-semibold"
                    : "text-earth-slate border-transparent hover:text-brand-terracotta"
                }`
              }
            >
              Campus Guidelines
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors py-1 border-b-2 no-underline ${
                  isActive
                    ? "text-brand-terracotta border-brand-terracotta font-semibold"
                    : "text-earth-slate border-transparent hover:text-brand-terracotta"
                }`
              }
            >
              Admin
            </NavLink>
          </nav>

          {/* Sell CTA button */}
          <div className="flex items-center gap-3">
            <Link
              to="/sell"
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-brand-terracotta hover:bg-brand-clayDark text-white text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 no-underline"
            >
              <span>+</span>
              <span>Sell Your Craft</span>
            </Link>
          </div>
        </div>
      </header>

      {!supabaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-900">
          Running in interactive campus demo mode with instant realistic craft listings & orders.
        </div>
      )}

      {/* Main Content View Container */}
      <main className="flex-grow pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Global Footer */}
      <footer className="bg-[#F5EFEB] border-t border-earth-border mt-16 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-brand-terracotta text-white flex items-center justify-center font-editorial font-bold text-xs">
                C
              </div>
              <span className="font-editorial text-base font-bold text-earth-slate">
                CampCraft Collective
              </span>
            </div>
            <p className="text-xs text-earth-muted mt-1">
              A circular collegiate marketplace connecting student makers with campus buyers.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-earth-muted font-medium">
            <Link to="/" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Browse Items
            </Link>
            <Link to="/sell" className="hover:text-brand-terracotta no-underline text-earth-muted">
              List Your Craft
            </Link>
            <Link to="/terms" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Campus Guidelines
            </Link>
            <Link to="/privacy" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Privacy Policy
            </Link>
            <Link to="/admin" className="hover:text-brand-terracotta no-underline text-earth-muted">
              Moderator Access
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
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 no-underline ${
            location.pathname === "/" ? "text-brand-terracotta" : "text-earth-muted"
          }`}
        >
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
          to="/sell"
          className={`flex flex-col items-center gap-1 no-underline ${
            location.pathname === "/sell" ? "text-brand-terracotta" : "text-earth-muted"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 4v16m8-8H4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Sell Craft</span>
        </Link>
        <Link
          to="/admin"
          className={`flex flex-col items-center gap-1 no-underline ${
            location.pathname.startsWith("/admin") ? "text-brand-terracotta" : "text-earth-muted"
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Admin</span>
        </Link>
      </nav>
    </div>
  );
}
