import { getProductStockState } from "@/lib/products";

export function StockBadge({ active, availableStock }: { active: boolean; availableStock: number }) {
  const state = getProductStockState({ active, availableStock });

  if (state === "Inactive") {
    return (
      <span className="inline-flex items-center rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-400">
        Inactive
      </span>
    );
  }

  const tone =
    state === "Out of Stock"
      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200"
      : state === "Low Stock"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {state}
    </span>
  );
}
