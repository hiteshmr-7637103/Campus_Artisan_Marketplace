import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { createListing } from "../lib/api";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "../lib/types";
import { PhotoUploader } from "../components/PhotoUploader";
import { Notice } from "../components/ui";

export function AddListing() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<Category>("jewelry");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function clientError(): string | null {
    if (!code.trim()) return "Enter the artisan code you were given.";
    if (name.trim().length < 1) return "Enter your name.";
    if (contact.trim().length < 3) return "Enter a contact (phone / email / Instagram).";
    if (title.trim().length < 2) return "Give the product a title.";
    if (description.trim().length < 1) return "Add a short description.";
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return "Enter the price you want to receive (a positive number).";
    if (photos.length < 1) return "Add at least one photo.";
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = clientError();
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createListing({
        artisan_code: code.trim(),
        artisan_name: name.trim(),
        artisan_contact: contact.trim(),
        category,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        photo_urls: photos,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your listing.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <Notice kind="success">
          Submitted! The founders will review it shortly. Once approved it appears on the storefront.
        </Notice>
        <Link to="/" className="btn-ghost mt-4 no-underline">Back to browse</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">List your work</h1>
      <p className="mt-1 text-sm text-ink/60">
        You enter the price <strong>you want to receive</strong>. The platform adds a small
        commission on top for the buyer; you get exactly what you set.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="code" className="field-label">Artisan code</label>
          <input id="code" className="field-input" value={code}
            onChange={(e) => setCode(e.target.value)} required autoComplete="off" />
          <p className="mt-1 text-xs text-ink/50">Given to you by the founders when you were onboarded.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="field-label">Your name</label>
            <input id="name" className="field-input" value={name}
              onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="contact" className="field-label">Your contact</label>
            <input id="contact" className="field-input" value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="phone / email / @instagram" required />
            <p className="mt-1 text-xs text-ink/50">Only shared with a buyer after they pay.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="field-label">Category</label>
            <select id="category" className="field-input" value={category}
              onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="field-label">Price you want (₹)</label>
            <input id="price" className="field-input" value={price} inputMode="decimal"
              onChange={(e) => setPrice(e.target.value)} required />
          </div>
        </div>

        <div>
          <label htmlFor="title" className="field-label">Product title</label>
          <input id="title" className="field-input" value={title} maxLength={120}
            onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label htmlFor="description" className="field-label">Description</label>
          <textarea id="description" className="field-input" rows={4} maxLength={4000}
            value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>

        <PhotoUploader artisanCode={code} urls={photos} onChange={setPhotos} />

        {error && <Notice kind="error">{error}</Notice>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Submitting…" : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
