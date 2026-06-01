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
      ? "border-red-400/30 bg-red-400/10 text-red-200"
      : state === "Low Stock"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {state}
    </span>
  );
}
