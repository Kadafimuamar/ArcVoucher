import { MarketplaceProducts } from "@/components/MarketplaceProducts";

export default function MarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">Marketplace</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">Gift cards</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-center text-xs text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-300">
          <span className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">Arc</span>
          <span className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">USDC</span>
          <span className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-white/[0.04]">On-chain</span>
        </div>
      </section>

      <MarketplaceProducts />
    </main>
  );
}
