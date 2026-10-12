import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate, formatINR } from "../lib/format";
import type { Category, SellerImage } from "../lib/types";
import { EmptyState, Field, Notice, Spinner, StatusBadge, useLoad } from "../components/ui";

export function SellApply() {
  const { user, reload } = useAuth();
  const { data: me, error, reload: reloadMe } = useLoad(() => (user ? api.sellerMe() : Promise.resolve(null)), [user?.id]);
  const [f, setF] = useState({ display_name: user?.full_name ?? "", bio: "", phone: user?.phone ?? "", instagram: "", upi_id: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (!user) return <Notice kind="info"><Link to="/login" state={{ from: "/sell/apply" }}>Log in</Link> or <Link to="/signup">sign up</Link> to start selling.</Notice>;
  if (error) return <Notice>{error}</Notice>;
  if (!me) return <Spinner />;
  if (me.seller_status === "approved") return <Notice kind="success">You're an approved seller. <Link to="/sell">Open your dashboard</Link>.</Notice>;
  if (me.seller_status === "pending") return <Notice kind="info">Your application is waiting for admin approval. We'll email you.</Notice>;

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api.sellerApply({ ...f, instagram: f.instagram.trim() || undefined });
      await reloadMe(); await reload();
    } catch (x) { setErr((x as Error).message); }
  }
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold">Become a seller</h1>
      <p className="mb-4 text-sm text-ink/60">Payments are made on the platform; the platform keeps a small commission and pays you by UPI.</p>
      {me.seller_status === "rejected" && <div className="mb-3"><Notice>Your previous application was not approved. You can apply again.</Notice></div>}
      <form onSubmit={submit} className="card space-y-4 p-4">
        {!user.email_verified && <Notice kind="info">Verify your email first.</Notice>}
        {err && <Notice>{err}</Notice>}
        <Field label="Shop / display name"><input className="field-input" required minLength={2} maxLength={80} value={f.display_name} onChange={set("display_name")} /></Field>
        <Field label="About your work"><textarea className="field-input" rows={3} maxLength={600} value={f.bio} onChange={set("bio")} /></Field>
        <Field label="Phone" hint="Shared with buyers only after they pay"><input className="field-input" type="tel" required maxLength={20} value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Instagram (optional)"><input className="field-input" maxLength={60} value={f.instagram} onChange={set("instagram")} /></Field>
        <Field label="UPI ID for payouts" hint="e.g. name@okaxis. Never shown publicly."><input className="field-input" required maxLength={80} value={f.upi_id} onChange={set("upi_id")} /></Field>
        <button className="btn-primary w-full" disabled={!user.email_verified}>Submit application</button>
      </form>
    </div>
  );
}

export function SellDashboard() {
  const listings = useLoad(api.sellerListings);
  const payouts = useLoad(api.sellerPayouts);
  const orders = useLoad(api.sellerOrders);
  if (listings.error) return <Notice>{listings.error}</Notice>;
  if (!listings.data) return <Spinner />;
  const owed = (payouts.data ?? []).filter((p) => p.status === "pending").reduce((a, p) => a + p.amount_paise, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Seller dashboard</h1>
        <Link to="/sell/listings/new" className="btn-primary no-underline">New listing</Link>
      </div>
      {owed > 0 && <Notice kind="info">{formatINR(owed)} is waiting to be paid out to your UPI.</Notice>}

      <section>
        <h2 className="mb-2 font-semibold">My listings</h2>
        {listings.data.length === 0 ? <EmptyState title="No listings yet" hint="Create your first listing; it goes live after admin review." /> : (
          <ul className="space-y-2">
            {listings.data.map((l) => (
              <li key={l.id} className="card flex items-center gap-3 p-3">
                {l.images[0] && <img src={l.images[0].url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                <div className="flex-1">
                  <p className="font-medium">{l.title}</p>
                  <p className="text-xs text-ink/60">{formatINR(l.price_paise)} · {l.category}</p>
                  {l.reject_reason && <p className="text-xs text-red-700">Rejected: {l.reject_reason}</p>}
                </div>
                <StatusBadge status={l.status} />
                {(l.status === "active" || l.status === "pending_review" || l.status === "rejected") && (
                  <>
                    <Link to={`/sell/listings/${l.id}/edit`} className="text-sm">Edit</Link>
                    <button className="text-sm text-ink/60 hover:underline" onClick={async () => { if (confirm("Archive this listing?")) { await api.archiveListing(l.id); await listings.reload(); } }}>Archive</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Orders received</h2>
        {!orders.data?.length ? <p className="text-sm text-ink/60">No orders yet.</p> : (
          <ul className="space-y-2">
            {orders.data.map((o) => (
              <li key={o.id} className="card p-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-medium">{o.listing_title}</span><StatusBadge status={o.status} /></div>
                <p className="text-ink/60">{formatINR(o.amount_paise)} · you receive {formatINR(o.seller_amount_paise)} · {formatDate(o.created_at)}</p>
                {o.buyer_name && <p className="mt-1">Buyer: {o.buyer_name}{o.buyer_phone ? ` · ${o.buyer_phone}` : ""}</p>}
                {o.needs_refund && <p className="text-amber-700">Item sold elsewhere first; this order will be refunded.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Payouts</h2>
        {!payouts.data?.length ? <p className="text-sm text-ink/60">Nothing yet.</p> : (
          <ul className="space-y-2">
            {payouts.data.map((p) => (
              <li key={p.id} className="card flex items-center justify-between p-3 text-sm">
                <span>{formatINR(p.amount_paise)}{p.upi_txn_ref ? ` · ref ${p.upi_txn_ref}` : ""}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function ListingForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editing = Boolean(id);
  const [cats, setCats] = useState<Category[]>([]);
  const [f, setF] = useState({ title: "", category_id: "", description: "", price: "" });
  const [images, setImages] = useState<SellerImage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [ready, setReady] = useState(!editing);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fetchCategories().then((c) => { setCats(c); setF((x) => (x.category_id ? x : { ...x, category_id: c[0]?.id ?? "" })); });
    if (id) {
      api.sellerListing(id).then((l) => {
        setF({ title: l.title, category_id: l.category_id, description: l.description, price: String(l.price_paise / 100) });
        setImages(l.images); setReady(true);
      }).catch((e) => setErr(e.message));
    }
  }, [id]);

  if (!ready) return err ? <Notice>{err}</Notice> : <Spinner />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const total = images.length + files.length;

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!ACCEPT.includes(file.type)) { setErr(`${file.name}: only JPEG, PNG or WebP`); continue; }
      if (file.size > 2 * 1024 * 1024) { setErr(`${file.name}: must be 2 MB or smaller`); continue; }
      if (images.length + next.length < 3) next.push(file);
    }
    setFiles(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const price_paise = Math.round(parseFloat(f.price) * 100);
    if (!Number.isFinite(price_paise) || price_paise <= 0) return setErr("Enter a price greater than 0.");
    if (total < 1) return setErr("Add at least one photo.");
    setBusy(true);
    try {
      const body = { title: f.title.trim(), category_id: f.category_id, description: f.description.trim(), price_paise };
      const listing = editing ? await api.updateListing(id!, body) : await api.createListing(body);
      for (const file of files) await api.uploadImage(listing.id, file);
      nav("/sell");
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">{editing ? "Edit listing" : "New listing"}</h1>
      <form onSubmit={submit} className="card space-y-4 p-4">
        {err && <Notice>{err}</Notice>}
        <Field label="Title"><input className="field-input" required minLength={3} maxLength={120} value={f.title} onChange={set("title")} /></Field>
        <Field label="Category">
          <select className="field-input" value={f.category_id} onChange={set("category_id")}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Price (₹)"><input className="field-input" type="number" required min="1" step="0.01" inputMode="decimal" value={f.price} onChange={set("price")} /></Field>
        <Field label="Description"><textarea className="field-input" rows={4} required maxLength={2000} value={f.description} onChange={set("description")} /></Field>

        <div>
          <span className="field-label">Photos (1–3, up to 2 MB each)</span>
          <div className="flex flex-wrap gap-3">
            {images.map((im) => (
              <div key={im.id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-ink/15">
                <img src={im.url} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo" className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white"
                  onClick={async () => { await api.deleteImage(id!, im.id); setImages(images.filter((x) => x.id !== im.id)); }}>✕</button>
              </div>
            ))}
            {files.map((file, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-ink/15">
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo" className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {total < 3 && (
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink/30 text-center text-xs text-ink/60 hover:bg-ink/5">
                + Add photo
                <input type="file" accept={ACCEPT.join(",")} multiple className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Submit for review"}</button>
      </form>
    </div>
  );
}
