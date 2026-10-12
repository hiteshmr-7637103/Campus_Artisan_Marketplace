import type { Category } from "../lib/types";

interface Props {
  categories: Category[];
  value: string;
  onChange: (slug: string) => void;
}

export function CategoryFilter({ categories, value, onChange }: Props) {
  const items = [{ slug: "", name: "All" }, ...categories];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((it) => (
        <button
          key={it.slug}
          onClick={() => onChange(it.slug)}
          aria-pressed={value === it.slug}
          className={`btn shrink-0 px-3 py-1.5 text-sm ${value === it.slug ? "bg-ink text-white" : "border border-ink/20 hover:bg-ink/5"}`}
        >
          {it.name}
        </button>
      ))}
    </div>
  );
}
