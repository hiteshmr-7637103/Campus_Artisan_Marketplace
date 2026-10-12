import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { Notice } from "../../components/ui";

// Real login (Supabase Auth email/password). Supabase enforces its own
// brute-force protection server-side; we add a short client-side backoff after
// repeated failures as a visible speed bump. (checklist #8)
export function AdminLogin({ signedInButNotAdmin }: { signedInButNotAdmin: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);

  const locked = Date.now() < lockUntil;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const n = fails + 1;
      setFails(n);
      if (n >= 5) {
        setLockUntil(Date.now() + 60_000);
        setError("Too many attempts. Try again in a minute.");
      } else {
        setError("Wrong email or password.");
      }
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm px-4">
      <Link to="/" className="text-sm no-underline hover:underline">← Storefront</Link>
      <h1 className="mt-4 text-xl font-semibold">Admin sign in</h1>

      {signedInButNotAdmin && (
        <div className="mt-3">
          <Notice kind="error">
            This account isn't an admin. Ask a founder to add you to <code>admin_users</code>,
            or <button className="underline" onClick={() => supabase.auth.signOut()}>sign out</button>.
          </Notice>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" type="email" className="field-input" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" type="password" className="field-input" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn-primary w-full" disabled={busy || locked}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
