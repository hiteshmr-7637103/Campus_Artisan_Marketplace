import { useState } from "react";
import { uploadPhoto, ApiError } from "../lib/api";
import { Notice } from "./ui";

interface Props {
  artisanCode: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}

const MAX = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export function PhotoUploader({ artisanCode, urls, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    if (!artisanCode.trim()) {
      setError("Enter your artisan code above before adding photos.");
      return;
    }
    const room = MAX - urls.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) {
      setError(`You can add at most ${MAX} photos.`);
      return;
    }

    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of picked) {
        if (!ACCEPT.split(",").includes(f.type)) {
          throw new ApiError(`${f.name}: only JPEG, PNG or WebP images are allowed`);
        }
        if (f.size > MAX_BYTES) {
          throw new ApiError(`${f.name}: image must be 5 MB or smaller`);
        }
        added.push(await uploadPhoto(f, artisanCode.trim()));
      }
      onChange([...urls, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="field-label">Photos (1–3)</span>
      <div className="flex flex-wrap gap-3">
        {urls.map((u, i) => (
          <div key={u} className="relative h-24 w-24 overflow-hidden rounded-lg border border-ink/15">
            <img src={u} alt={`Product photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((x) => x !== u))}
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white"
              aria-label={`Remove photo ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        {urls.length < MAX && (
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-ink/30 text-center text-xs text-ink/60 hover:bg-ink/5">
            {busy ? "Uploading…" : "+ Add photo"}
            <input
              type="file"
              accept={ACCEPT}
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
      {error && (
        <div className="mt-2">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
    </div>
  );
}
