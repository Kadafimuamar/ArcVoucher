import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { shortAddress } from "@/lib/format";

export function Footer() {
  const explorerUrl = `${arcTestnet.blockExplorers.default.url}/address/${arcVoucherStoreAddress}`;

  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6 lg:px-8 dark:text-zinc-400">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>Arc Testnet - Native USDC checkout</p>
          <a className="font-medium text-zinc-700 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white" href={explorerUrl} rel="noreferrer" target="_blank">
            {shortAddress(arcVoucherStoreAddress)}
          </a>
        </div>
        <p className="max-w-4xl text-xs leading-5 text-zinc-500 dark:text-zinc-500">
          Brand names and logos are used only to identify the gift card products. ArcVoucher is not affiliated with or endorsed by these brands.
        </p>
      </div>
    </footer>
  );
}
