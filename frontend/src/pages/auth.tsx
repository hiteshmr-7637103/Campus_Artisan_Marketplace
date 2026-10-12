import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field, Notice, Spinner } from "../components/ui";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <div className="card space-y-4 p-4">{children}</div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email.trim(), password); nav(from, { replace: true }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <Shell title="Log in">
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice>{error}</Notice>}
        <Field label="Email"><input className="field-input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="field-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="text-sm"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/signup">Create an account</Link></p>
    </Shell>
  );
}

export function Signup() {
  const [f, setF] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.signup({ full_name: f.full_name.trim(), email: f.email.trim(), password: f.password, phone: f.phone.trim() || undefined });
      setDone(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  if (done) return <Shell title="Check your email"><Notice kind="success">If this email can be registered, we have sent a verification link. Click it, then <Link to="/login">log in</Link>.</Notice></Shell>;
  return (
    <Shell title="Create your account">
      <form onSubmit={submit} className="space-y-4">
        {error && <Notice>{error}</Notice>}
        <Field label="Full name"><input className="field-input" required maxLength={120} autoComplete="name" value={f.full_name} onChange={set("full_name")} /></Field>
        <Field label="Email"><input className="field-input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone (optional)"><input className="field-input" type="tel" maxLength={20} autoComplete="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Password" hint="At least 8 characters"><input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Sign up"}</button>
      </form>
      <p className="text-sm">Already have an account? <Link to="/login">Log in</Link></p>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { reload } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "bad">("working");
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("bad"); return; }
    api.verifyEmail(token).then(() => { setState("ok"); void reload(); }).catch(() => setState("bad"));
  }, [params, reload]);
  return (
    <Shell title="Email verification">
      {state === "working" && <Spinner label="Verifying…" />}
      {state === "ok" && <Notice kind="success">Your email is verified. <Link to="/">Start browsing</Link>.</Notice>}
      {state === "bad" && <Notice>This link is invalid or has expired. Log in and use “Resend the link”.</Notice>}
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.forgotPassword(email.trim()); setDone(true); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Shell title="Forgot password">
      {done ? <Notice kind="success">If an account exists for this email, we have sent a reset link.</Notice> : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice>{error}</Notice>}
          <Field label="Email"><input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.resetPassword(params.get("token") ?? "", password); setDone(true); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Shell title="Choose a new password">
      {done ? <Notice kind="success">Password updated. <Link to="/login">Log in</Link>.</Notice> : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice>{error}</Notice>}
          <Field label="New password" hint="At least 8 characters"><input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <button className="btn-primary w-full">Update password</button>
        </form>
      )}
    </Shell>
  );
}

export function Account() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setUser(await api.updateMe({ full_name: name.trim(), phone: phone.trim() }));
      setMsg({ kind: "success", text: "Saved." });
    } catch (err) { setMsg({ kind: "error", text: (err as Error).message }); }
  }
  return (
    <Shell title="Your account">
      <form onSubmit={submit} className="space-y-4">
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <p className="text-sm text-ink/60">{user?.email} {user?.email_verified ? "· verified" : "· not verified"}</p>
        <Field label="Full name"><input className="field-input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone"><input className="field-input" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <button className="btn-primary">Save</button>
      </form>
    </Shell>
  );
}
