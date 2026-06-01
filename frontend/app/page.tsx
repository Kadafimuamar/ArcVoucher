import Link from "next/link";
import { MarketplaceProducts } from "@/components/MarketplaceProducts";
import { demoProducts } from "@/lib/products";

const supportedChains = ["Arc Testnet", "Base Sepolia", "Ethereum Sepolia"];
const benefits = [
  "Spend USDC from a single Unified Balance",
  "Buy digital vouchers without storing codes on-chain",
  "Reveal vouchers only from the purchasing wallet"
];

export default function HomePage() {
  return (
    <main className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_56%,#eef2f7_100%)] text-zinc-950 dark:bg-[linear-gradient(180deg,#18181b_0%,#09090b_56%,#09090b_100%)] dark:text-white">
      <section className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Arc Unified Balance Demo</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-zinc-950 sm:text-6xl dark:text-white">
            Buy global gift cards with USDC using Arc Unified Balance.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-300">
            ArcVoucher is a public demo marketplace for Steam, Google Play, Apple, Netflix, and more. Pay directly on
            Arc or use Unified Balance to spend USDC from supported chains.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
              href="/marketplace"
            >
              Shop gift cards
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-sm font-bold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-100 dark:hover:border-white/20 dark:hover:bg-white/[0.04]"
              href="/orders"
            >
              View orders
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white/95 p-5 shadow-xl shadow-zinc-200/60 backdrop-blur dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-black/20">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-white/10">
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Demo checkout</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{demoProducts.length} seeded products</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-100">
              USDC
            </span>
          </div>
          <div className="mt-5 space-y-4">
            <ReceiptLine label="Product" value="Google Play Gift Card $10" />
            <ReceiptLine label="Payment" value="Unified Balance" />
            <ReceiptLine label="Network" value="Arc Testnet" />
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Total</p>
              <p className="mt-1 text-3xl font-black text-zinc-950 dark:text-white">10 USDC</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          <InfoBlock title="How It Works" items={["Choose a gift card", "Pay with Arc USDC or Unified Balance", "Reveal your voucher securely"]} />
          <InfoBlock title="Supported Chains" items={supportedChains} />
          <InfoBlock title="Benefits" items={benefits} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Featured</p>
            <h2 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">Gift cards</h2>
          </div>
          <Link className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-200 dark:hover:text-emerald-100" href="/marketplace">
            View all
          </Link>
        </div>
        <MarketplaceProducts limit={4} />
      </section>
    </main>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-950 dark:text-white">{value}</span>
    </div>
  );
}

function InfoBlock({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <h3 className="text-base font-bold text-zinc-950 dark:text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <p className="text-sm text-zinc-600 dark:text-zinc-300" key={item}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
