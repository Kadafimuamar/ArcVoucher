import { MarketplaceProducts } from "@/components/MarketplaceProducts";

export default function MarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-200">Marketplace</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Gift cards</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-zinc-900/70 p-2 text-center text-xs text-zinc-300">
          <span className="rounded-md bg-white/[0.04] px-3 py-2">Arc</span>
          <span className="rounded-md bg-white/[0.04] px-3 py-2">USDC</span>
          <span className="rounded-md bg-white/[0.04] px-3 py-2">On-chain</span>
        </div>
      </section>

      <MarketplaceProducts />
    </main>
  );
}
