import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createListing, fetchCategories, sellerListing, updateListing } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { CATEGORY_EMOJI, LISTING_STATUS_LABEL, PILOT_COMMISSION_RATE } from "../../lib/types";
import { showToast } from "../../lib/toast";
import { PhotoUploader } from "../../components/PhotoUploader";
import { EmptyState, Field, Notice, Spinner, StatusBadge } from "../../components/ui";

const MAX_RUPEES = 100000; // backend cap: 1,00,000 rupees

// /sell/listings/new  → create the listing, then continue on the edit page to add photos.
// /sell/listings/:id/edit → edit details + manage photos.
export function ListingForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [listing, setListing] = useState(null);
  const [form, setForm] = useState({ title: "", category_id: "", description: "", price: "" });
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setListing(null);
      return;
    }
    sellerListing(id)
      .then((l) => {
        setListing(l);
        setForm({ title: l.title, category_id: l.category_id, description: l.description, price: String(l.price_paise / 100) });
      })
      .catch((e) => setLoadError(e.message));
  }, [id, isNew]);

  if (loadError) {
    return (
      <EmptyState title="Listing not found">
        <Link to="/sell" className="btn-primary no-underline">
          Back to Seller Studio
        </Link>
      </EmptyState>
    );
  }
  if (!isNew && !listing) return <Spinner />;

  const locked = listing && ["sold", "archived"].includes(listing.status);
  const pricePaise = Math.round(Number(form.price) * 100);
  const priceValid = Number.isFinite(pricePaise) && pricePaise > 0 && Number(form.price) <= MAX_RUPEES;
  const youGet = priceValid ? pricePaise - Math.round(pricePaise * PILOT_COMMISSION_RATE) : 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (!priceValid) {
      setError(`Enter a price between ₹1 and ₹${MAX_RUPEES.toLocaleString("en-IN")}.`);
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: form.title.trim(),
      category_id: form.category_id,
      description: form.description.trim(),
      price_paise: pricePaise,
    };
    try {
      if (isNew) {
        const created = await createListing(body);
        showToast("Saved! Now add photos.", "📸");
        navigate(`/sell/listings/${created.id}/edit`, { replace: true });
      } else {
        const wasRejected = listing.status === "rejected";
        setListing(await updateListing(listing.id, body));
        showToast(wasRejected ? "Resubmitted for review" : "Changes saved", "✅");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/sell" className="text-xs sm:text-sm font-medium text-earth-muted hover:text-earth-slate no-underline">
        ← Seller Studio
      </Link>
      <div className="mt-4 mb-8 flex flex-wrap items-center gap-3">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate">{isNew ? "List a new craft" : "Edit craft"}</h1>
        {listing && <StatusBadge status={listing.status} label={LISTING_STATUS_LABEL[listing.status]} />}
      </div>

      {listing?.status === "rejected" && (
        <div className="mb-6">
          <Notice kind="warn">
            Not approved{listing.reject_reason ? `: ${listing.reject_reason}` : "."} Fix it and save — that sends it back for review.
          </Notice>
        </div>
      )}
      {listing?.status === "pending_review" && (
        <div className="mb-6">
          <Notice kind="info">A moderator will review this listing before it goes live. Make sure it has at least one photo.</Notice>
        </div>
      )}
      {locked && (
        <div className="mb-6">
          <Notice kind="info">This listing is {listing.status} and can no longer be edited.</Notice>
        </div>
      )}

      <div className="p-6 sm:p-10 rounded-3xl bg-white border border-earth-border shadow-sm space-y-8">
        <form onSubmit={onSubmit} className="space-y-4">
          <h3 className="font-editorial text-lg font-bold text-earth-slate">
            <span>1.</span> Craft details
          </h3>
          <fieldset disabled={locked || busy} className="space-y-4">
            <Field label="Craft title *">
              <input className="field-input" required minLength={3} maxLength={120} placeholder="e.g. Hand-thrown speckled coffee mug" value={form.title} onChange={set("title")} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category *">
                <select className="field-input" required value={form.category_id} onChange={set("category_id")}>
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {CATEGORY_EMOJI[c.slug] ?? ""} {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Price in ₹ *"
                hint={priceValid ? `You receive about ${formatINR(youGet)} after the ${Math.round(PILOT_COMMISSION_RATE * 100)}% platform commission.` : "What the buyer pays."}
              >
                <input className="field-input" required type="number" min="1" max={MAX_RUPEES} step="0.01" placeholder="450" value={form.price} onChange={set("price")} />
              </Field>
            </div>
            <Field label="Makers story & materials *">
              <textarea
                className="field-input"
                required
                rows={4}
                maxLength={2000}
                placeholder="Materials, inspiration, size, care instructions…"
                value={form.description}
                onChange={set("description")}
              />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            {!locked && (
              <button type="submit" className="btn-primary w-full py-3">
                {busy ? "Saving…" : isNew ? "Save & continue to photos →" : listing.status === "rejected" ? "Save & resubmit for review" : "Save changes"}
              </button>
            )}
          </fieldset>
        </form>

        <div className="space-y-3 border-t border-earth-border pt-8">
          <h3 className="font-editorial text-lg font-bold text-earth-slate">
            <span>2.</span> Photos
          </h3>
          {isNew ? (
            <p className="text-sm text-earth-muted">Save the details first — then you can add 1 to 3 photos.</p>
          ) : (
            <PhotoUploader
              listingId={listing.id}
              images={listing.images}
              disabled={locked}
              onChange={(images) => setListing((l) => ({ ...l, images }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
