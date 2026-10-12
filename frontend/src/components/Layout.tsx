import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Notice } from "./ui";
import { resendVerification } from "../lib/api";
import { useState } from "react";

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [sent, setSent] = useState(false);
  const link = "no-underline hover:underline";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="font-semibold no-underline">Campus Artisan Marketplace</Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <NavLink to="/" end className={link}>Browse</NavLink>
            {user?.seller_status === "approved" ? (
              <NavLink to="/sell" className={link}>Seller dashboard</NavLink>
            ) : (
              <NavLink to="/sell/apply" className={link}>Sell your work</NavLink>
            )}
            {user && <NavLink to="/orders" className={link}>My orders</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {user ? (
              <>
                <NavLink to="/account" className={link}>{user.full_name.split(" ")[0]}</NavLink>
                <button className="text-ink/60 hover:underline" onClick={async () => { await logout(); nav("/"); }}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={link}>Log in</NavLink>
                <Link to="/signup" className="btn-primary px-3 py-1.5 no-underline">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {user && !user.email_verified && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <Notice kind="info">
            Please verify your email to buy, sell or review.{" "}
            {sent ? "Link sent — check your inbox." : (
              <button className="underline" onClick={async () => { await resendVerification().catch(() => {}); setSent(true); }}>
                Resend the link
              </button>
            )}
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
            <Link to="/privacy" className={link}>Privacy</Link>
            <Link to="/terms" className={link}>Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
