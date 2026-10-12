import { CATEGORIES, CATEGORY_LABEL } from "../lib/types";

export function CategoryFilter({ value, onChange }) {
  const items = [
    { key: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c] })),
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 custom-scroll">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          aria-pressed={value === it.key}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            value === it.key
              ? "bg-earth-slate text-white shadow-xs"
              : "bg-white text-earth-muted border border-earth-border hover:border-earth-slate"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
