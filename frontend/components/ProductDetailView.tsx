"use client";

import Link from "next/link";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { StockBadge } from "@/components/StockBadge";
import { useArcVoucherProduct } from "@/lib/contracts/productReads";
import { formatUsdc } from "@/lib/format";
import { getAvailableStock } from "@/lib/products";

export function ProductDetailView({ productId }: { productId: number }) {
  const { product, isFallback, isLoading } = useArcVoucherProduct(productId);

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Product not found" message={`Product #${productId} is not available from the contract.`} />
      </main>
    );
  }

  const availableStock = getAvailableStock(product);

  return (
    <main className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <section className={`min-h-96 rounded-lg border border-zinc-200 ${product.surface} p-6 shadow-sm dark:border-white/10`}>
        <div className={`h-full min-h-72 rounded-md bg-gradient-to-br ${product.accent} opacity-90 shadow-2xl shadow-black/30`} />
      </section>

      <section className="flex flex-col justify-center">
        {isFallback ? (
          <div className="mb-5">
            <StateNotice
              title="Using mock fallback"
              message="The contract read failed for this product, so local seeded product data is shown."
            />
          </div>
        ) : null}

        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">{product.brand}</p>
          <StockBadge active={product.active} availableStock={availableStock} />
        </div>
        <h1 className="text-3xl font-black leading-tight text-zinc-950 sm:text-5xl dark:text-white">{product.name}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          Digital voucher inventory read from ArcVoucherStore. Fulfillment stores only the voucher hash on-chain.
        </p>

        <div className="mt-8 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-white/10 dark:bg-zinc-900/70">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Price</p>
            <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-200">{formatUsdc(product.price)}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Stock</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">{availableStock}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Product ID</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white">#{product.id}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
            href={`/checkout/${product.id}`}
          >
            Checkout
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-bold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
            href="/marketplace"
          >
            Marketplace
          </Link>
        </div>
      </section>
    </main>
  );
}
