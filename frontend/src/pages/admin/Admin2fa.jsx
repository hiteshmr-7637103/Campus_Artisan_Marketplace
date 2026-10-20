import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { admin2faConfirm, admin2faEnroll } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { showToast } from "../../lib/toast";
import { Field, Notice } from "../../components/ui";

function AuthCard({ eyebrow, title, subtitle, children }) {
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
    </div>
  );
}

export function Admin2fa() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [enrollment, setEnrollment] = useState(null); // { secret, otpauth_uri }
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await admin2faEnroll());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await admin2faConfirm(code.trim());
      setUser(r.user); // the new session carries mfa=true; the stale pre-2FA session is gone
      setRecoveryCodes(r.recovery_codes);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    return (
      <AuthCard eyebrow="Two-factor enabled" title="Save your recovery codes" subtitle="Each code works once, if you ever lose access to your authenticator app.">
        <Notice kind="warn">
          <ul className="font-mono text-sm space-y-1">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Notice>
        <button
          type="button"
          className="btn-primary w-full mt-6"
          onClick={() => {
            showToast("Two-factor authentication enabled", "🔒");
            navigate("/admin", { replace: true });
          }}
        >
          Done, take me to the dashboard
        </button>
      </AuthCard>
    );
  }

  if (enrollment) {
    return (
      <AuthCard eyebrow="Step 2 of 2" title="Confirm your code" subtitle="Add this account to your authenticator app, then enter the 6-digit code it shows.">
        <div className="mb-4 space-y-2 text-xs">
          <p className="text-earth-muted">Scan or enter this in your authenticator app:</p>
          <p className="break-all rounded-lg bg-brand-clayLight px-3 py-2 font-mono">{enrollment.otpauth_uri}</p>
          <p className="text-earth-muted">
            Manual entry secret: <span className="font-mono text-earth-slate">{enrollment.secret}</span>
          </p>
        </div>
        <form onSubmit={confirm} className="space-y-4">
          <Field label="6-digit code">
            <input className="field-input" required minLength={6} maxLength={10} autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          {error && <Notice kind="error">{error}</Notice>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            {busy ? "Confirming…" : "Confirm and enable"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard eyebrow="Step 1 of 2" title="Set up two-factor authentication" subtitle="Admin accounts require a second factor before reaching the operations hub.">
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      <button type="button" className="btn-primary w-full py-3" disabled={busy} onClick={startEnroll}>
        {busy ? "Starting…" : "Start setup"}
      </button>
      <p className="mt-4 text-center text-xs">
        <Link to="/admin" className="text-earth-muted hover:text-brand-terracotta">
          Back to the operations hub
        </Link>
      </p>
    </AuthCard>
  );
}
