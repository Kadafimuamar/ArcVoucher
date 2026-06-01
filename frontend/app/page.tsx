import Link from "next/link";
import { MarketplaceProducts } from "@/components/MarketplaceProducts";
import { demoProducts } from "@/lib/products";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-emerald-200">Arc Testnet</p>
          <h1 className="mt-4 text-4xl font-black leading-none text-white sm:text-6xl">ArcVoucher</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
            Gift cards priced in native Arc USDC, with product, stock, order, and fulfillment proof state anchored
            on-chain.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-300 px-6 text-sm font-bold text-zinc-950 transition hover:bg-emerald-200"
              href="/marketplace"
            >
              Open marketplace
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-6 text-sm font-bold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.04]"
              href="/orders"
            >
              View orders
            </Link>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Seeded catalog</span>
            <span className="text-sm font-semibold text-white">{demoProducts.length} products</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div className="h-full w-2/3 rounded-full bg-emerald-300" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-zinc-400">
            <span>Arc</span>
            <span>USDC</span>
            <span>Hash proof</span>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-400">Featured</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Gift cards</h2>
          </div>
          <Link className="text-sm font-semibold text-emerald-200 transition hover:text-emerald-100" href="/marketplace">
            View all
          </Link>
        </div>
        <MarketplaceProducts limit={4} />
      </section>
    </main>
  );
}
