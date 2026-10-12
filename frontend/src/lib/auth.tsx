import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import * as api from "./api";
import type { User } from "./types";
import { Spinner } from "../components/ui";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the session from the httpOnly refresh cookie, if there is one.
    (async () => {
      if (await api.refreshSession()) {
        try { setUser(await api.getMe()); } catch { /* not logged in */ }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  }, []);
  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);
  const reload = useCallback(async () => {
    try { setUser(await api.getMe()); } catch { setUser(null); }
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout, reload, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** UX-only route guard; the API enforces everything for real. */
export function Guard({ need = "login", children }: { need?: "login" | "seller" | "admin"; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (need === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  if (need === "seller" && user.seller_status !== "approved") return <Navigate to="/sell/apply" replace />;
  return <>{children}</>;
}
