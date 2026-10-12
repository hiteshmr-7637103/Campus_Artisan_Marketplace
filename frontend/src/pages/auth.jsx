import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { showToast } from "../lib/toast";
import { Field, Notice, Spinner } from "../components/ui";

function AuthCard({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-2xl font-bold mx-auto mb-4 shadow-md shadow-brand-terracotta/20">
          C
        </div>
        {eyebrow && (
          <span className="text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
            {eyebrow}
          </span>
        )}
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate mt-3">{title}</h1>
        {subtitle && <p className="text-sm text-earth-muted mt-2">{subtitle}</p>}
      </div>
      <div className="card p-6 sm:p-8">{children}</div>
      {footer && <div className="mt-5 text-center text-sm text-earth-muted">{footer}</div>}
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      showToast(`Welcome back, ${u.full_name.split(" ")[0]}!`, "👋");
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in to CampCraft"
      footer={
        <>
          New here?{" "}
          <Link to="/signup" state={location.state} className="font-semibold text-brand-terracotta">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="College email">
          <input className="field-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="field-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-xs">
          <Link to="/forgot-password" className="text-earth-muted hover:text-brand-terracotta">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export function Signup() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.signup({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
      });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthCard eyebrow="Almost there" title="Check your inbox" subtitle={done}>
        <p className="text-sm text-earth-muted">
          Click the link in the email to verify your address, then log in. The link is valid for 24 hours.
        </p>
        <Link to="/login" className="btn-primary w-full mt-6 no-underline">
          Go to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Join the collective"
      title="Create your account"
      subtitle="One account to buy crafts — and to sell your own once approved."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-terracotta">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Full name">
          <input className="field-input" required maxLength={120} autoComplete="name" value={form.full_name} onChange={set("full_name")} />
        </Field>
        <Field label="College email">
          <input className="field-input" type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Phone (optional)">
          <input className="field-input" type="tel" maxLength={20} autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-[11px] text-earth-muted">
          By signing up you agree to the <Link to="/terms">Campus Guidelines</Link> and{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </form>
    </AuthCard>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, reload } = useAuth();
  const [state, setState] = useState({ status: "working" });
  const started = useRef(false); // the token is single-use: never send it twice (StrictMode runs effects twice)

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("token");
    if (!token) {
      setState({ status: "error", message: "This verification link is incomplete." });
      return;
    }
    api
      .verifyEmail(token)
      .then(() => {
        setState({ status: "ok" });
        void reload();
      })
      .catch((e) => setState({ status: "error", message: e.message }));
  }, [params, reload]);

  if (state.status === "working") return <Spinner label="Verifying your email…" />;
  return (
    <AuthCard
      title={state.status === "ok" ? "Email verified 🎉" : "Couldn't verify"}
      subtitle={state.status === "ok" ? "You can now buy crafts and leave reviews." : state.message}
    >
      {state.status === "error" && (
        <p className="mb-4 text-sm text-earth-muted">
          {user ? "Request a new link from your Account page." : "Log in to request a new link."}
        </p>
      )}
      <Link to={user ? "/" : "/login"} className="btn-primary w-full no-underline">
        {user ? "Start browsing" : "Log in"}
      </Link>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone((await api.forgotPassword(email.trim())).message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link that's valid for 1 hour.">
      {done ? (
        <Notice kind="success">{done}</Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="College email">
            <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <Notice kind="error">{error}</Notice>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.resetPassword(params.get("token") ?? "", password);
      showToast(r.message, "🔑");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Choose a new password" subtitle="This logs you out on every device.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters.">
          <input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input className="field-input" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}

export function Account() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [verifySent, setVerifySent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(await api.updateMe({ full_name: fullName.trim(), phone: phone.trim() || null }));
      showToast("Profile saved", "✅");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const sellerLine = {
    none: <Link to="/sell/apply">Apply to sell your crafts →</Link>,
    pending: "Your seller application is being reviewed.",
    approved: <Link to="/sell">Open your Seller Studio →</Link>,
    rejected: <Link to="/sell/apply">Your application wasn't approved — update and re-apply →</Link>,
  }[user.seller_status];

  return (
    <AuthCard eyebrow="Your account" title={user.full_name} subtitle={user.email}>
      <div className="mb-6 space-y-1 text-sm">
        <p>
          <span className="text-earth-muted">Email:</span>{" "}
          {user.email_verified ? (
            "verified ✓"
          ) : (
            <>
              <span className="text-amber-700">not verified yet</span>
              {" · "}
              {verifySent ? (
                "link sent"
              ) : (
                <button
                  type="button"
                  className="font-semibold text-brand-terracotta underline"
                  onClick={async () => {
                    await api.resendVerification().catch(() => {});
                    setVerifySent(true);
                  }}
                >
                  resend link
                </button>
              )}
            </>
          )}
        </p>
        <p>
          <span className="text-earth-muted">Selling:</span> {sellerLine}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 border-t border-earth-border pt-6">
        <Field label="Full name">
          <input className="field-input" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className="field-input" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </AuthCard>
  );
}
