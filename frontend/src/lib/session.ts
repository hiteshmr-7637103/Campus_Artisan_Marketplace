import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// Is the signed-in user in admin_users? RLS lets a non-admin read zero rows, so
// this doubles as the authorization check for the admin panel.
export function useIsAdmin(session: Session | null) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return isAdmin;
}
