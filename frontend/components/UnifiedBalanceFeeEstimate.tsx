import type { UnifiedBalanceAllocation, UnifiedBalanceFeeEstimate as UnifiedBalanceFeeEstimateType } from "@/lib/appkit/types";

type UnifiedBalanceFeeEstimateProps = {
  allocations: UnifiedBalanceAllocation[];
  errorMessage?: string;
  estimate?: UnifiedBalanceFeeEstimateType;
  isLoading: boolean;
};

export function UnifiedBalanceFeeEstimate({ allocations, errorMessage, estimate, isLoading }: UnifiedBalanceFeeEstimateProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Fee estimate</p>
          <p className="mt-1 text-xs text-zinc-400">Arc Testnet destination</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-zinc-300">
          {isLoading ? "Estimating" : estimate ? "Estimated" : "Pending"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {allocations.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-zinc-400">Selected allocation</p>
            <div className="mt-2 space-y-2">
              {allocations.map((allocation) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={allocation.chainId}>
                  <span className="text-zinc-300">{allocation.chainId}</span>
                  <span className="font-semibold text-white">{allocation.amount} USDC</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-white/[0.06]" /> : null}

        {!isLoading && estimate ? (
          <div className="space-y-2">
            {estimate.fees.length === 0 ? (
              <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">No fees returned by the SDK estimate.</p>
            ) : null}
            {estimate.fees.map((fee, index) => {
              const allocations = fee.allocations as { amount: string; chain: string }[] | undefined;

              return (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" key={`${fee.type}-${index}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold capitalize text-white">{fee.type}</span>
                    <span className="text-zinc-300">
                      {fee.amount} {fee.token}
                    </span>
                  </div>
                  {allocations ? (
                    <div className="mt-2 space-y-1">
                      {allocations.map((allocation) => (
                        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500" key={`${allocation.chain}-${allocation.amount}`}>
                          <span>{String(allocation.chain)}</span>
                          <span>{allocation.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm">
              <span className="font-semibold text-white">Total fees</span>
              <span className="font-semibold text-emerald-200">{estimate.totalFees} USDC</span>
            </div>
          </div>
        ) : null}

        {!isLoading && !estimate && errorMessage ? (
          <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">{errorMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
