import { CATEGORIES, CATEGORY_LABEL, type Category } from "../lib/types";

interface Props {
  value: Category | "all";
  onChange: (c: Category | "all") => void;
}

export function CategoryFilter({ value, onChange }: Props) {
  const items: Array<{ key: Category | "all"; label: string }> = [
    { key: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c] })),
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          aria-pressed={value === it.key}
          className={`btn shrink-0 px-3 py-1.5 text-sm ${
            value === it.key ? "bg-ink text-white" : "border border-ink/20 hover:bg-ink/5"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
