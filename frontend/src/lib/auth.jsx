import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import * as api from "./api";
import { Spinner } from "../components/ui";

const AuthContext = createContext(null);
const USER_KEY = "campcraft_user";

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(USER_KEY) : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    // If we already have a user in session storage, don't block render with loading spinner
    return typeof window !== "undefined" ? !sessionStorage.getItem(USER_KEY) : true;
  });

  const setUser = useCallback((u) => {
    setUserState(u);
    try {
      if (typeof window !== "undefined") {
        if (u) sessionStorage.setItem(USER_KEY, JSON.stringify(u));
        else sessionStorage.removeItem(USER_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await api.refreshSession()) {
          try {
            const me = await api.getMe();
            if (!cancelled) setUser(me);
          } catch {
            /* could not fetch profile */
          }
        } else if (!api.hasSession()) {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password);
    if (r.mfaRequired) return r;
    setUser(r.user);
    return r;
  }, [setUser]);

  const completeMfa = useCallback(async (mfaToken, code) => {
    const u = await api.verifyAdmin2fa(mfaToken, code);
    setUser(u);
    return u;
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const reload = useCallback(async () => {
    if (!api.hasSession()) return; // e.g. verifying an email while logged out
    try {
      setUser(await api.getMe());
    } catch {
      setUser(null);
    }
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, loading, login, completeMfa, logout, reload, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/** UX-only route guard: the API enforces every rule again on the server. */
export function Guard({ need = "login", children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (need === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  if (need === "seller" && user.seller_status !== "approved") return <Navigate to="/sell/apply" replace />;
  return children;
}
