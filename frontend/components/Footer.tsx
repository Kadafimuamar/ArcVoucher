import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { shortAddress } from "@/lib/format";

export function Footer() {
  const explorerUrl = `${arcTestnet.blockExplorers.default.url}/address/${arcVoucherStoreAddress}`;

  return (
    <footer className="border-t border-white/10 bg-zinc-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-zinc-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>Arc Testnet · Native USDC checkout</p>
        <a className="font-medium text-zinc-300 transition hover:text-white" href={explorerUrl} rel="noreferrer" target="_blank">
          {shortAddress(arcVoucherStoreAddress)}
        </a>
      </div>
    </footer>
  );
}

