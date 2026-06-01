import { ProductGrid } from "@/components/ProductGrid";
import { arcAppKitDefaults } from "@/lib/arc/appKit";
import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherIntentPaymentReceiverAddress } from "@/lib/contracts/arcVoucherIntentPaymentReceiver";
import { arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { shortAddress } from "@/lib/format";
import { demoProducts } from "@/lib/products";

const backendUrl = process.env.NEXT_PUBLIC_ARCVOUCHER_BACKEND_URL ?? "http://127.0.0.1:4000";

export default function AdminPage() {
  const activeProducts = demoProducts.filter((product) => product.active).length;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8">
        <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">Contracts</p>
        <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">Contracts & Demo Status</h1>
        <p className="mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Public deployment details for the ArcVoucher demo on Arc Testnet.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatusCard
          href={`${arcTestnet.blockExplorers.default.url}/address/${arcVoucherStoreAddress}`}
          label="ArcVoucherStore"
          value={shortAddress(arcVoucherStoreAddress)}
        />
        <StatusCard label="Network" value="Arc Testnet" />
        <StatusCard label="Products" value={`${demoProducts.length} seeded`} />
        <StatusCard label="Active products" value={`${activeProducts}`} />
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 md:grid-cols-3">
        <DemoMetric label="Payment asset" value={arcAppKitDefaults.paymentAsset} />
        <DemoMetric label="App Kit chain" value={arcAppKitDefaults.chain} />
        <DemoMetric label="Checkout mode" value={arcAppKitDefaults.paymentMode} />
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 md:grid-cols-2">
        <DemoMetric
          href={`${arcTestnet.blockExplorers.default.url}/address/${arcVoucherIntentPaymentReceiverAddress}`}
          label="Unified Balance payment address"
          value={shortAddress(arcVoucherIntentPaymentReceiverAddress)}
        />
        <DemoMetric label="Backend API" value={backendUrl.replace(/^https?:\/\//, "")} />
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Catalog</p>
          <h2 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">Seeded products</h2>
        </div>
        <ProductGrid products={demoProducts} />
      </section>
    </main>
  );
}

function StatusCard({ href, label, value }: { href?: string; label: string; value: string }) {
  const content = (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-emerald-300/30">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">{value}</p>
      {href ? <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-200">View on ArcScan</p> : null}
    </div>
  );

  return href ? (
    <a href={href} rel="noreferrer" target="_blank">
      {content}
    </a>
  ) : (
    content
  );
}

function DemoMetric({ href, label, value }: { href?: string; label: string; value: string }) {
  const content = (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 break-all font-semibold text-zinc-950 dark:text-white">{value}</p>
      {href ? <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">Open ArcScan</p> : null}
    </div>
  );

  return href ? (
    <a className="block rounded-md p-2 transition hover:bg-zinc-50 dark:hover:bg-white/[0.04]" href={href} rel="noreferrer" target="_blank">
      {content}
    </a>
  ) : (
    content
  );
}
