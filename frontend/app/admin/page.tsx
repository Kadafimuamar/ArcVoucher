import { ProductGrid } from "@/components/ProductGrid";
import { arcAppKitDefaults } from "@/lib/arc/appKit";
import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherStoreAbi, arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { shortAddress } from "@/lib/format";
import { demoProducts } from "@/lib/products";

export default function AdminPage() {
  const activeProducts = demoProducts.filter((product) => product.active).length;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8">
        <p className="text-sm font-semibold uppercase text-emerald-200">Admin</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Store console</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-400">Contract</p>
          <p className="mt-2 text-lg font-semibold text-white">{shortAddress(arcVoucherStoreAddress)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-400">Chain ID</p>
          <p className="mt-2 text-lg font-semibold text-white">{arcTestnet.id}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-400">ABI entries</p>
          <p className="mt-2 text-lg font-semibold text-white">{arcVoucherStoreAbi.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
          <p className="text-sm text-zinc-400">Active products</p>
          <p className="mt-2 text-lg font-semibold text-white">{activeProducts}</p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 rounded-lg border border-white/10 bg-zinc-900/70 p-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-zinc-400">App Kit chain</p>
          <p className="mt-2 font-semibold text-white">{arcAppKitDefaults.chain}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Payment asset</p>
          <p className="mt-2 font-semibold text-white">{arcAppKitDefaults.paymentAsset}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-400">Payment mode</p>
          <p className="mt-2 font-semibold text-white">{arcAppKitDefaults.paymentMode}</p>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5">
          <p className="text-sm font-medium text-zinc-400">Catalog</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Seeded products</h2>
        </div>
        <ProductGrid products={demoProducts} />
      </section>
    </main>
  );
}
