import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import * as api from "./api";
import { Spinner } from "../components/ui";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore the session from the httpOnly refresh cookie, if there is one.
    (async () => {
      if (await api.refreshSession()) {
        try {
          setUser(await api.getMe());
        } catch {
          /* not logged in */
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password);
    if (r.mfaRequired) return r;
    setUser(r.user);
    return r;
  }, []);

  const completeMfa = useCallback(async (mfaToken, code) => {
    const u = await api.verifyAdmin2fa(mfaToken, code);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!api.hasSession()) return; // e.g. verifying an email while logged out
    try {
      setUser(await api.getMe());
    } catch {
      setUser(null);
    }
  }, []);

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
