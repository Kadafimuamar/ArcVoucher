import type { UnifiedBalanceStatus } from "@/lib/appkit/types";

type UnifiedBalanceCardProps = {
  amountAvailable: string;
  amountRequired: string;
  errorMessage?: string;
  isLoading: boolean;
  onRefresh: () => void;
  status: UnifiedBalanceStatus;
  totalBalance: string;
};

export function UnifiedBalanceCard({
  amountAvailable,
  amountRequired,
  errorMessage,
  isLoading,
  onRefresh,
  status,
  totalBalance
}: UnifiedBalanceCardProps) {
  const statusTone = {
    error: "border-red-400/25 bg-red-400/10 text-red-100",
    insufficient: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    loading: "border-white/10 bg-white/[0.04] text-zinc-300",
    not_connected: "border-white/10 bg-white/[0.04] text-zinc-300",
    ready: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    unavailable: "border-amber-300/25 bg-amber-300/10 text-amber-100"
  }[status];

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-sm font-medium text-zinc-400">Unified Balance</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{formatUsdcLabel(totalBalance)}</h2>
        </div>
        <button
          className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="button"
          onClick={onRefresh}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 py-5 sm:grid-cols-2">
        <Metric label="Amount required" value={formatUsdcLabel(amountRequired)} />
        <Metric label="Amount available" value={formatUsdcLabel(amountAvailable)} />
      </div>

      <div className={`rounded-lg border p-3 text-sm ${statusTone}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Balance status</span>
          <span>{getStatusLabel(status)}</span>
        </div>
        {errorMessage ? <p className="mt-2 line-clamp-3 text-xs opacity-80">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function getStatusLabel(status: UnifiedBalanceStatus) {
  const labels = {
    error: "Error",
    insufficient: "Insufficient",
    loading: "Loading",
    not_connected: "Connect wallet",
    ready: "Ready",
    unavailable: "Unavailable"
  };

  return labels[status];
}

function formatUsdcLabel(value: string) {
  return `${Number(value || "0").toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0
  })} USDC`;
}
