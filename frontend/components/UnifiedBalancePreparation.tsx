import type { UnifiedBalanceChainOption, UnifiedBalanceSpendPreparation } from "@/lib/appkit/types";
import { unifiedBalanceCheckoutStages } from "@/lib/appkit/unifiedBalance";
import { shortAddress } from "@/lib/format";

type UnifiedBalancePreparationProps = {
  preparation?: UnifiedBalanceSpendPreparation;
  supportedChains: UnifiedBalanceChainOption[];
};

export function UnifiedBalancePreparation({ preparation, supportedChains }: UnifiedBalancePreparationProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Spend preparation</p>
          <p className="mt-1 text-xs text-zinc-400">{preparation ? "Ready" : "Pending"}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">v0.2.1</span>
      </div>

      {preparation ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Amount" value={`${preparation.amount} USDC`} />
            <Metric label="Buyer" value={shortAddress(preparation.buyer)} />
            <Metric label="Product" value={`#${preparation.productId}`} />
            <Metric label="Recipient" value={shortAddress(preparation.receiverAddress)} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-zinc-400">Reference ID</p>
            <p className="mt-2 break-all text-xs font-medium text-white">{preparation.referenceId}</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-zinc-400">Selected source chains</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {preparation.selectedChainIds.length > 0 ? (
                preparation.selectedChainIds.map((chainId) => (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300" key={chainId}>
                    {getChainTitle(supportedChains, chainId)}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-500">No chains selected</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-zinc-400">Estimated fees</p>
            <p className="mt-2 text-sm font-semibold text-white">{preparation.estimatedFees?.totalFees ?? "Pending"} USDC</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {unifiedBalanceCheckoutStages.map((stage, index) => (
              <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3" key={stage.id}>
                <p className="text-xs font-semibold uppercase text-zinc-500">Step {index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-white">{stage.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
          Prepare checkout to generate a payment reference.
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function getChainTitle(supportedChains: UnifiedBalanceChainOption[], chainId: string) {
  return supportedChains.find((chain) => chain.id === chainId)?.title ?? chainId;
}
