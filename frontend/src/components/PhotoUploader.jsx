import { useState } from "react";
import { deleteImage, uploadImage } from "../lib/api";
import { Notice } from "./ui";

const MAX = 3;
const MAX_BYTES = 2 * 1024 * 1024; // must match the backend's limit
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

// Photos belong to an existing listing: create the listing first, then upload.
// `images` is the listing's [{ id, url, position }].
export function PhotoUploader({ listingId, images, onChange, disabled = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError(null);

    const room = MAX - images.length;
    if (files.length > room) {
      setError(room === 0 ? `You can add at most ${MAX} photos.` : `Only ${room} more photo${room > 1 ? "s" : ""} can be added.`);
      return;
    }
    // Check every file before uploading any, so a bad file doesn't leave a half-finished batch.
    for (const f of files) {
      if (!ACCEPT.includes(f.type)) return setError(`${f.name}: only JPEG, PNG or WebP images are allowed.`);
      if (f.size > MAX_BYTES) return setError(`${f.name}: images must be 2 MB or smaller.`);
    }

    setBusy(true);
    let current = images;
    try {
      for (const f of files) {
        const img = await uploadImage(listingId, f);
        current = [...current, img].sort((a, b) => a.position - b.position);
        onChange(current); // keep each photo as soon as it's stored
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(img) {
    setBusy(true);
    setError(null);
    try {
      await deleteImage(listingId, img.id);
      onChange(images.filter((x) => x.id !== img.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="field-label">Craft photos (1 to 3)</span>
      <div className="flex flex-wrap items-center gap-3">
        {images.map((img, i) => (
          <div key={img.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-earth-border bg-stone-100">
            <img src={img.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-0 inset-x-0 bg-brand-terracotta text-white text-[9px] text-center font-bold">Cover</span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(img)}
                disabled={busy}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                aria-label={`Remove photo ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {!disabled && images.length < MAX && (
          <label className="flex w-24 h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-earth-border bg-brand-clayLight/40 hover:bg-brand-clayLight/80 text-center text-[11px] font-semibold text-earth-slate transition-colors">
            <span className="text-2xl">📸</span>
            {busy ? "Uploading…" : "Add photo"}
            <input
              type="file"
              accept={ACCEPT.join(",")}
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <span className="mt-1 block text-[11px] text-earth-muted">JPEG, PNG or WebP, up to 2 MB each. The first photo is the cover.</span>
      {error && (
        <div className="mt-2">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
