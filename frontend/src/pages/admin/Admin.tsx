import { NavLink, Route, Routes } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useSession, useIsAdmin } from "../../lib/session";
import { Spinner } from "../../components/ui";
import { AdminLogin } from "./AdminLogin";
import { AdminListings } from "./AdminListings";
import { AdminOrders } from "./AdminOrders";

export function Admin() {
  const { session, loading } = useSession();
  const isAdmin = useIsAdmin(session);

  if (loading || (session && isAdmin === null)) {
    return <Spinner label="Checking access…" />;
  }

  if (!session || !isAdmin) {
    return <AdminLogin signedInButNotAdmin={Boolean(session && isAdmin === false)} />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Admin</span>
            <nav className="flex gap-4 text-sm">
              <NavLink to="/admin" end className="no-underline hover:underline">Listings</NavLink>
              <NavLink to="/admin/orders" className="no-underline hover:underline">Orders</NavLink>
            </nav>
          </div>
          <button
            className="text-sm text-ink/60 hover:underline"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route index element={<AdminListings />} />
          <Route path="orders" element={<AdminOrders />} />
        </Routes>
      </main>
    </div>
  );
}
