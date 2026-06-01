import Link from "next/link";
import { StockBadge } from "@/components/StockBadge";
import { formatUsdc } from "@/lib/format";
import { getAvailableStock, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const availableStock = getAvailableStock(product);

  return (
    <article className="group flex min-h-64 flex-col justify-between rounded-lg border border-white/10 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-zinc-900">
      <div className="space-y-4">
        <div className={`flex h-28 items-end rounded-md ${product.surface} p-4`}>
          <div className={`h-14 w-14 rounded-md bg-gradient-to-br ${product.accent} shadow-lg shadow-black/30`} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-zinc-400">{product.brand}</p>
            <StockBadge active={product.active} availableStock={availableStock} />
          </div>
          <h2 className="text-lg font-semibold leading-tight text-white">{product.name}</h2>
          <p className="text-sm text-zinc-500">{availableStock} available</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-emerald-200">{formatUsdc(product.price)}</p>
        <Link
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
          href={`/product/${product.id}`}
        >
          View
        </Link>
      </div>
    </article>
  );
}
