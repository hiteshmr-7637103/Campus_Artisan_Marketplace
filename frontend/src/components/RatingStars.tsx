interface Props {
  value: number | null;
  count?: number;
  size?: "sm" | "md";
  showCount?: boolean;
}

// Read-only star display. For the interactive picker see RatingInput below.
export function RatingStars({ value, count, size = "sm", showCount = true }: Props) {
  if (value == null) {
    return <span className="text-xs text-ink/40">No ratings yet</span>;
  }
  const rounded = Math.round(value);
  const cls = size === "sm" ? "text-sm" : "text-lg";
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`} aria-label={`${value} out of 5 stars`}>
      <span aria-hidden className="tracking-tight text-amber-500">
        {"★".repeat(rounded)}
        <span className="text-ink/20">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="text-xs text-ink/60">
        {value.toFixed(1)}
        {showCount && count != null ? ` (${count})` : ""}
      </span>
    </span>
  );
}

export function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`text-3xl leading-none transition ${
            n <= value ? "text-amber-500" : "text-ink/20 hover:text-amber-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
