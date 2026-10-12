import { Link, NavLink, Outlet } from "react-router-dom";
import { supabaseConfigured } from "../lib/supabaseClient";
import { Notice } from "./ui";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="font-semibold no-underline">
            Campus Artisan Marketplace
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" end className="no-underline hover:underline">
              Browse
            </NavLink>
            <NavLink to="/sell" className="no-underline hover:underline">
              Sell your work
            </NavLink>
          </nav>
        </div>
      </header>

      {!supabaseConfigured && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <Notice kind="info">
            Backend not configured yet — set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>frontend/.env</code> (see SETUP.md).
          </Notice>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink/60">
          <span>Campus pilot · payments by Razorpay</span>
          <nav className="flex gap-4">
            <Link to="/privacy" className="no-underline hover:underline">Privacy</Link>
            <Link to="/terms" className="no-underline hover:underline">Terms</Link>
            <Link to="/admin" className="no-underline hover:underline">Admin</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
