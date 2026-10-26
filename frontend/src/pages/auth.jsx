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

const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_ENABLED === "true";

function GoogleButton() {
  if (!GOOGLE_ENABLED) return null;
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-earth-muted">
        <span className="h-px flex-1 bg-earth-border" />
        or continue with
        <span className="h-px flex-1 bg-earth-border" />
      </div>
      <button
        type="button"
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-earth-border bg-white py-3 text-sm font-semibold text-earth-slate hover:bg-brand-clayLight transition shadow-2xs"
        onClick={() => (window.location.href = api.googleLoginUrl())}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>
    </>
  );
}

export function Login() {
  const { login, completeMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState("");

  const redirectFrom = location.state?.from || "";
  let redirectBanner = null;

  if (redirectFrom.includes("/wishlist")) {
    redirectBanner = {
      title: "Log in to access your Wishlist",
      description: "Please sign in with your college account to view and save unique student crafts to your collection.",
      icon: "❤️",
      badge: "Wishlist Protected",
    };
  } else if (redirectFrom.includes("/cart")) {
    redirectBanner = {
      title: "Log in to view your Shopping Bag",
      description: "Please sign in with your college account to view your bag, reserve handcrafted items, and coordinate campus quad pickups.",
      icon: "🛍️",
      badge: "Cart Protected",
    };
  } else if (redirectFrom.includes("/checkout")) {
    redirectBanner = {
      title: "Log in to proceed with Checkout",
      description: "Please sign in to select your campus pickup hub and complete your order with student makers.",
      icon: "💳",
      badge: "Checkout Protected",
    };
  } else if (redirectFrom.includes("/orders")) {
    redirectBanner = {
      title: "Log in to view your Orders",
      description: "Please sign in to check your order fulfillment and student artisan contact details.",
      icon: "📦",
      badge: "Orders Protected",
    };
  } else if (redirectFrom && redirectFrom !== "/") {
    redirectBanner = {
      title: "Please log in to proceed",
      description: "You must be signed in with a campus account to access this page.",
      icon: "🔒",
      badge: "Login Required",
    };
  }

  useEffect(() => {
    if (redirectBanner) {
      showToast(redirectBanner.title, redirectBanner.icon);
    }
  }, [redirectFrom]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await login(email.trim(), password);
      if (r.mfaRequired) {
        setMfaToken(r.mfaToken);
        setBusy(false);
        return;
      }
      showToast(`Welcome back, ${r.user.full_name.split(" ")[0]}!`, "👋");
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function onMfaSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await completeMfa(mfaToken, code.trim());
      showToast(`Welcome back, ${u.full_name.split(" ")[0]}!`, "👋");
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (mfaToken) {
    return (
      <AuthCard eyebrow="Two-factor check" title="Enter your code" subtitle="Open your authenticator app, or use a recovery code.">
        <form onSubmit={onMfaSubmit} className="space-y-4">
          <Field label="Authentication code">
            <input
              className="field-input"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={24}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {error && <Notice kind="error">{error}</Notice>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? "Verifying…" : "Verify and log in"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Col: Authentic Marketplace Hero Showcase */}
        <div className="lg:col-span-5 rounded-3xl bg-[#9E3E1B] bg-gradient-to-br from-[#C85A32] via-[#A94825] to-[#3E1B0F] p-6 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden shadow-xl">
          {/* Subtle Decorative Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white">
                🎓 Campus Artisan Collective
              </span>
            </div>
            <h2 className="font-editorial text-2xl sm:text-4xl font-bold leading-tight tracking-tight">
              Crafted by students. Cherished on campus.
            </h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-white/80 leading-relaxed font-sans">
              Log in to explore handmade ceramics, custom jewelry, dorm decor, and handwoven textiles crafted right in your campus residence halls.
            </p>
          </div>

          <div className="my-6 hidden sm:block relative z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4.5">
            <p className="text-xs text-white/95 italic leading-relaxed">
              "CampCraft made it effortless to sell my hand-thrown ceramic mugs to fellow students directly on the quad without expensive delivery fees."
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                🏺
              </div>
              <div>
                <p className="text-xs font-bold text-white">Ravi Kumar</p>
                <p className="text-[10px] text-white/70">Pottery Artisan • Dept. of Fine Arts</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 sm:mt-0 space-y-1.5 sm:space-y-2 text-xs font-medium text-white/90">
            <div className="flex items-center gap-2">
              <span className="text-amber-300">✓</span>
              <span>100% In-person quad & dorm handoffs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-300">✓</span>
              <span>Direct student payouts via instant UPI</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-300">✓</span>
              <span>Verified university email community</span>
            </div>
          </div>
        </div>

        {/* Right Col: Login Form + Quick Demo Account Switcher */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-earth-border p-5 sm:p-10 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate">
                  Welcome back
                </h1>
                <p className="text-xs sm:text-sm text-earth-muted mt-1">
                  Enter your credentials to access your account.
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-lg sm:text-xl font-bold shadow-md shadow-brand-terracotta/20">
                C
              </div>
            </div>

            {/* Prominent Authentication Required Banner */}
            {redirectBanner && (
              <div className="my-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3.5 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="w-9 h-9 rounded-xl bg-amber-200/70 border border-amber-300 flex items-center justify-center text-lg shrink-0 shadow-2xs">
                  {redirectBanner.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                      {redirectBanner.badge}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-earth-slate mt-1">
                    {redirectBanner.title}
                  </p>
                  <p className="text-xs text-earth-muted mt-0.5 leading-relaxed">
                    {redirectBanner.description}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="College email">
                <input
                  className="field-input"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="e.g. asha@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  className="field-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <Notice kind="error">{error}</Notice>}
              <button
                type="submit"
                className="btn-primary w-full py-3.5 text-base font-semibold transition-all hover:shadow-md"
                disabled={busy}
              >
                {busy ? "Logging in…" : "Log in to CampCraft"}
              </button>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-earth-muted">
                  New student maker?{" "}
                  <Link to="/signup" state={location.state} className="font-semibold text-brand-terracotta hover:underline">
                    Create account
                  </Link>
                </span>
                <Link to="/forgot-password" className="text-earth-muted hover:text-brand-terracotta">
                  Forgot password?
                </Link>
              </div>
            </form>

            <GoogleButton />
          </div>
        </div>
      </div>
    </div>
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
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Column: Campus Artisan Value Props */}
        <div className="lg:col-span-5 rounded-3xl bg-[#243329] bg-gradient-to-br from-[#2E3C32] via-[#243329] to-[#162019] p-6 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          <div className="relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white">
              🌿 Join the Collective
            </span>
            <h2 className="font-editorial text-2xl sm:text-4xl font-bold leading-tight tracking-tight mt-4 sm:mt-6">
              One account for campus buyers and makers.
            </h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-white/80 leading-relaxed font-sans">
              Discover one-of-a-kind student artwork, save crafts to your wishlist, or apply to open your own dorm studio in minutes.
            </p>
          </div>

          <div className="my-6 hidden sm:grid relative z-10 grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-xl font-bold text-amber-300 font-editorial">₹0</span>
              <p className="text-xs font-semibold text-white mt-1">Listing Fees</p>
              <p className="text-[10px] text-white/70">List your crafts free forever</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-xl font-bold text-emerald-300 font-editorial">10+</span>
              <p className="text-xs font-semibold text-white mt-1">Quad Hubs</p>
              <p className="text-[10px] text-white/70">Safe in-person pickup points</p>
            </div>
          </div>

          <div className="relative z-10 mt-4 sm:mt-0 space-y-1.5 sm:space-y-2 text-xs font-medium text-white/90">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Exclusive student discounts with code STUDENT10</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span>Fast-track seller studio approval</span>
            </div>
          </div>
        </div>

        {/* Right Column: Registration Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-earth-border p-5 sm:p-10 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate">
                  Create your account
                </h1>
                <p className="text-xs sm:text-sm text-earth-muted mt-1">
                  Join our campus artisan network in less than 60 seconds.
                </p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-accent-sage text-white flex items-center justify-center font-editorial text-lg sm:text-xl font-bold shadow-md shadow-accent-sage/20">
                🌿
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 mt-6">
              <Field label="Full name">
                <input
                  className="field-input"
                  required
                  maxLength={120}
                  autoComplete="name"
                  placeholder="e.g. Diya Patel"
                  value={form.full_name}
                  onChange={set("full_name")}
                />
              </Field>
              <Field label="College email" hint="Use your student or faculty email">
                <input
                  className="field-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="e.g. diya@campus.edu"
                  value={form.email}
                  onChange={set("email")}
                />
              </Field>
              <Field label="Phone number (for quad pickup alerts)">
                <input
                  className="field-input"
                  type="tel"
                  maxLength={20}
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </Field>
              <Field label="Password" hint="At least 8 characters">
                <input
                  className="field-input"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                />
              </Field>
              {error && <Notice kind="error">{error}</Notice>}
              <button
                type="submit"
                className="btn-primary w-full py-3.5 text-base font-semibold hover:shadow-md transition-all"
                disabled={busy}
              >
                {busy ? "Creating your account…" : "Create Campus Account"}
              </button>
              <p className="text-center text-xs text-earth-muted">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-brand-terracotta hover:underline">
                  Log in
                </Link>
              </p>
              <p className="text-center text-[11px] text-earth-muted">
                By joining you agree to the <Link to="/terms" className="underline">Campus Honor Code</Link> and{" "}
                <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </form>

            <GoogleButton />
          </div>
        </div>
      </div>
    </div>
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

function ProfileSection({ user, setUser }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(await api.updateMe({ full_name: fullName.trim(), phone: phone.trim() || null }));
      showToast("Profile saved", "✅");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="border-t border-earth-border pt-6">
        <div className="flex items-center justify-between">
          <h2 className="field-label">Profile</h2>
          <button type="button" className="text-xs font-semibold text-brand-terracotta underline" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-earth-muted">Full name</dt>
            <dd className="font-medium text-earth-slate">{user.full_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-earth-muted">Phone</dt>
            <dd className="font-medium text-earth-slate">{user.phone || "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t border-earth-border pt-6">
      <h2 className="field-label">Edit profile</h2>
      <Field label="Full name">
        <input className="field-input" required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input className="field-input" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="px-4 rounded-xl border border-earth-border text-sm font-semibold text-earth-muted"
          onClick={() => {
            setFullName(user.full_name);
            setPhone(user.phone ?? "");
            setError(null);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function UpiSection() {
  const [seller, setSeller] = useState(null);
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState("");
  const [newUpi, setNewUpi] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    api.sellerMe().then(setSeller).catch(() => {});
  }, []);

  if (!seller) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestUpiChange(password, newUpi.trim());
      setRequested(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-earth-border pt-6 mt-6">
      <div className="flex items-center justify-between">
        <h2 className="field-label">Payout UPI ID</h2>
        {!changing && (
          <button type="button" className="text-xs font-semibold text-brand-terracotta underline" onClick={() => setChanging(true)}>
            Change UPI ID
          </button>
        )}
      </div>
      {!changing && <p className="mt-2 text-sm font-mono text-earth-slate">{seller.upi_id}</p>}
      {changing &&
        (requested ? (
          <Notice kind="success">Check your email to confirm the UPI ID change. The link is valid for 1 hour.</Notice>
        ) : (
          <form onSubmit={onSubmit} className="mt-3 space-y-4">
            <Notice kind="info">For your security, changing the UPI ID requires your password and an emailed confirmation link.</Notice>
            <Field label="Current password">
              <input className="field-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="New UPI ID">
              <input className="field-input" required maxLength={80} placeholder="name@okaxis" value={newUpi} onChange={(e) => setNewUpi(e.target.value)} />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={busy}>
                {busy ? "Sending…" : "Send confirmation email"}
              </button>
              <button
                type="button"
                className="px-4 rounded-xl border border-earth-border text-sm font-semibold text-earth-muted"
                onClick={() => setChanging(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ))}
    </div>
  );
}

export function Account() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [verifySent, setVerifySent] = useState(false);

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
      <ProfileSection user={user} setUser={setUser} />
      {user.seller_status === "approved" && <UpiSection />}

      {/* Account Session & Log Out */}
      <div className="mt-8 pt-6 border-t border-earth-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-stone-50 border border-earth-border/80">
          <div>
            <p className="text-sm font-semibold text-earth-slate">Account Session</p>
            <p className="text-xs text-earth-muted">Signed in as {user.email}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              showToast("You have been logged out.", "👋");
              navigate("/");
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out of Session</span>
          </button>
        </div>
      </div>
    </AuthCard>
  );
}

export function ConfirmUpiChange() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ status: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("token");
    if (!token) {
      setState({ status: "error", message: "This confirmation link is incomplete." });
      return;
    }
    api
      .confirmUpiChange(token)
      .then(() => setState({ status: "ok" }))
      .catch((e) => setState({ status: "error", message: e.message }));
  }, [params]);

  if (state.status === "working") return <Spinner label="Confirming your UPI ID change…" />;
  return (
    <AuthCard
      title={state.status === "ok" ? "UPI ID updated ✅" : "Couldn't confirm"}
      subtitle={state.status === "ok" ? "Your new UPI ID is now active for future payouts." : state.message}
    >
      <Link to="/account" className="btn-primary w-full no-underline">
        Back to your account
      </Link>
    </AuthCard>
  );
}

export function GoogleComplete() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reload } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await api.refreshSession();
      if (!ok) {
        setFailed(true);
        return;
      }
      await reload();
      navigate(location.state?.from ?? "/", { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <AuthCard title="Couldn't sign you in" subtitle="Something went wrong completing Google sign-in.">
        <Link to="/login" className="btn-primary w-full no-underline">
          Back to log in
        </Link>
      </AuthCard>
    );
  }
  return <Spinner label="Signing you in…" />;
}
