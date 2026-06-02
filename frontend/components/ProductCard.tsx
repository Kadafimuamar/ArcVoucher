import Link from "next/link";
import { BrandedGiftCard } from "@/components/BrandedGiftCard";
import { StockBadge } from "@/components/StockBadge";
import { formatUsdc } from "@/lib/format";
import { getAvailableStock, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const availableStock = getAvailableStock(product);

  return (
    <article className="group flex min-h-64 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-2xl dark:shadow-black/20 dark:hover:border-white/20 dark:hover:bg-zinc-900">
      <div className="space-y-4">
        <BrandedGiftCard brand={product.brand} className="min-h-44" name={product.name} priceLabel={formatUsdc(product.price).replace(" USDC", "")} />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{product.brand}</p>
            <StockBadge active={product.active} availableStock={availableStock} />
          </div>
          <h2 className="text-lg font-semibold leading-tight text-zinc-950 dark:text-white">{product.name}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">{availableStock} available</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-200">{formatUsdc(product.price)}</p>
        <Link
          className="inline-flex min-h-11 items-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-emerald-200"
          href={`/checkout/${product.id}`}
        >
          Buy
        </Link>
      </div>
    </article>
  );
}
