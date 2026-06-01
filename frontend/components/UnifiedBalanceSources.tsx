import type { UnifiedBalanceChainOption, UnifiedBalanceSnapshot } from "@/lib/appkit/types";
import { getBalanceForChain } from "@/lib/appkit/unifiedBalance";

type UnifiedBalanceSourcesProps = {
  balances?: UnifiedBalanceSnapshot;
  isLoading: boolean;
  onToggleChain: (chainId: string) => void;
  selectedChainIds: string[];
  supportedChains: UnifiedBalanceChainOption[];
};

export function UnifiedBalanceSources({
  balances,
  isLoading,
  onToggleChain,
  selectedChainIds,
  supportedChains
}: UnifiedBalanceSourcesProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-zinc-900/70">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Source chains</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Choose where your Unified Balance payment comes from.</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-transparent dark:text-zinc-300">
          {supportedChains.length} supported
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {supportedChains.map((chain) => {
          const selected = selectedChainIds.includes(chain.id);
          const balance = getBalanceForChain(balances, chain.id);

          return (
            <label
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 transition ${
                selected
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-300/30 dark:bg-emerald-300/10"
                  : "border-zinc-200 bg-zinc-50 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
              }`}
              key={chain.id}
            >
              <span className="flex min-w-0 items-center gap-3">
                <input
                  checked={selected}
                  className="h-4 w-4 accent-emerald-600 dark:accent-emerald-300"
                  disabled={isLoading}
                  name="unified-balance-source-chain"
                  type="radio"
                  onChange={() => onToggleChain(chain.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">{chain.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">{chain.id}</span>
                </span>
              </span>
              <span className="shrink-0 text-right text-xs font-semibold text-zinc-700 dark:text-zinc-300">{formatBalance(balance)}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function formatBalance(value: string) {
  return `${Number(value || "0").toLocaleString("en-US", {
    maximumFractionDigits: 6
  })} USDC`;
}
