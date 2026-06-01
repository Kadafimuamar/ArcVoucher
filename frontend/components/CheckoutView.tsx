"use client";

import { CheckoutPanel } from "@/components/CheckoutPanel";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { useArcVoucherProduct } from "@/lib/contracts/productReads";

export function CheckoutView({ productId }: { productId: number }) {
  const { product, isFallback, isLoading, refetch } = useArcVoucherProduct(productId);

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Product not found" message={`Product #${productId} is not available from the contract.`} />
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
      <section className="flex flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-emerald-200">Checkout</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Arc USDC payment</h1>
        {isFallback ? (
          <div className="mt-6">
            <StateNotice
              title="Using mock fallback"
              message="The contract read failed for this checkout, so local seeded product data is shown."
            />
          </div>
        ) : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Asset</p>
            <p className="mt-2 text-lg font-semibold text-white">USDC</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Network</p>
            <p className="mt-2 text-lg font-semibold text-white">Arc Testnet</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Order</p>
            <p className="mt-2 text-lg font-semibold text-white">On-chain</p>
          </div>
        </div>
      </section>

      <CheckoutPanel onPurchaseConfirmed={refetch} onRefreshState={refetch} product={product} />
    </main>
  );
}
