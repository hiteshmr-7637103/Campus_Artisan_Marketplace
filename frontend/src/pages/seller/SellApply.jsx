import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { sellerApply, sellerMe } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PILOT_COMMISSION_RATE } from "../../lib/types";
import { Field, Notice, Spinner } from "../../components/ui";

const keepPct = Math.round((1 - PILOT_COMMISSION_RATE) * 100);

function Hero() {
  return (
    <div className="text-center max-w-xl mx-auto mb-10">
      <span className="text-xs uppercase font-bold tracking-wider text-brand-terracotta bg-brand-clayLight px-3 py-1 rounded-full">
        Artisan Creator Studio
      </span>
      <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-earth-slate mt-3">Sell Your Handmade Crafts on Campus</h1>
      <p className="text-xs sm:text-sm text-earth-muted mt-2">
        Zero listing fees. Keep {keepPct}% of every sale, paid to your UPI after the handoff.
      </p>
    </div>
  );
}

const STEPS = [
  ["1. Apply", "Tell us your shop name and how buyers & payouts reach you."],
  ["2. Get approved", "A campus moderator reviews your application."],
  ["3. List crafts", "Add photos, a story and your price. Each listing is reviewed before it goes live."],
];

export function SellApply() {
  const { user, loading, reload } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ display_name: "", bio: "", phone: "", instagram: "", upi_id: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (!user) return;
    sellerMe()
      .then((m) => {
        setMe(m);
        // Re-applying after a rejection: start from what they sent last time.
        if (m.display_name) {
          setForm({
            display_name: m.display_name ?? "",
            bio: m.bio ?? "",
            phone: m.phone ?? "",
            instagram: m.instagram ?? "",
            upi_id: m.upi_id ?? "",
          });
        }
      })
      .catch((e) => setError(e.message));
  }, [user]);

  if (loading) return <Spinner />;
  if (user?.seller_status === "approved") return <Navigate to="/sell" replace />;

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-14">
        <Hero />
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([t, d]) => (
            <div key={t} className="card p-5">
              <p className="font-editorial font-bold text-earth-slate">{t}</p>
              <p className="mt-1 text-xs text-earth-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/signup" className="btn-primary px-6 py-3 no-underline">
            Create an account to start
          </Link>
          <Link to="/login" state={{ from: "/sell/apply" }} className="btn-ghost px-6 py-3 no-underline">
            I already have an account
          </Link>
        </div>
      </div>
    );
  }

  if (!me && !error) return <Spinner />;

  if (me?.seller_status === "pending") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl">⏳</div>
        <h1 className="font-editorial text-2xl font-bold text-earth-slate mt-3">Application under review</h1>
        <p className="text-sm text-earth-muted mt-2">
          Thanks, {me.display_name}! A moderator will review your application. You'll get an email when you're approved.
        </p>
        <Link to="/" className="btn-ghost mt-6 no-underline">
          Back to browsing
        </Link>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMe(
        await sellerApply({
          display_name: form.display_name.trim(),
          bio: form.bio.trim(),
          phone: form.phone.trim(),
          instagram: form.instagram.trim() || null,
          upi_id: form.upi_id.trim(),
        }),
      );
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-14">
      <Hero />
      {me?.seller_status === "rejected" && (
        <div className="mb-6">
          <Notice kind="warn">Your last application wasn't approved. Update your details below and apply again.</Notice>
        </div>
      )}

      <div className="p-6 sm:p-10 rounded-3xl bg-white border border-earth-border shadow-sm">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="pb-6 border-b border-earth-border space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate">
              <span>1.</span> Your public shop profile
            </h3>
            <Field label="Shop / display name *" hint="Shown on your listings, e.g. “Asha's Beads”.">
              <input className="field-input" required minLength={2} maxLength={80} value={form.display_name} onChange={set("display_name")} />
            </Field>
            <Field label="About you & your craft" hint="Optional — materials, inspiration, your department.">
              <textarea className="field-input" rows={3} maxLength={600} value={form.bio} onChange={set("bio")} />
            </Field>
          </div>

          <div className="space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate">
              <span>2.</span> Private contact & payout details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp / phone *" hint="🔒 Shown only to buyers who have paid.">
                <input className="field-input" type="tel" required minLength={6} maxLength={20} placeholder="98XXXXXXXX" value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label="Instagram" hint="🔒 Also shown only after payment.">
                <input className="field-input" maxLength={60} placeholder="@your_handle" value={form.instagram} onChange={set("instagram")} />
              </Field>
            </div>
            <Field label="UPI ID for payouts *" hint={`⚡ Your ${keepPct}% share is sent here after each handoff.`}>
              <input className="field-input" required maxLength={80} placeholder="name@okaxis" value={form.upi_id} onChange={set("upi_id")} />
            </Field>

            <label className="flex items-start gap-2.5 text-xs text-earth-slate cursor-pointer pt-2">
              <input className="mt-0.5 rounded text-brand-terracotta focus:ring-brand-terracotta" required type="checkbox" />
              <span>
                I confirm my items are original & handmade by me, and I'll coordinate campus handoffs within 48 hours of a
                confirmed order.
              </span>
            </label>

            {error && <Notice kind="error">{error}</Notice>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-60"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
