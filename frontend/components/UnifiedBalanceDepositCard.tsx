"use client";

import type {
  UnifiedBalanceChainOption,
  UnifiedBalanceDepositEvidence,
  UnifiedBalanceDepositStatus,
  UnifiedBalancePendingDeposit
} from "@/lib/appkit/types";

type UnifiedBalanceDepositCardProps = {
  amount: string;
  balance: string;
  disabled: boolean;
  errorMessage?: string;
  evidence?: UnifiedBalanceDepositEvidence;
  isChainMismatch: boolean;
  isConnected: boolean;
  isSwitchingChain: boolean;
  pendingDeposit?: UnifiedBalancePendingDeposit;
  selectedChainId?: string;
  selectedChainLabel?: string;
  sourceChains: UnifiedBalanceChainOption[];
  status: UnifiedBalanceDepositStatus;
  onAmountChange: (amount: string) => void;
  onDeposit: () => void;
  onSourceChainChange: (chainId: string) => void;
  onSwitchChain: () => void;
};

export function UnifiedBalanceDepositCard({
  amount,
  balance,
  disabled,
  errorMessage,
  evidence,
  isChainMismatch,
  isConnected,
  isSwitchingChain,
  pendingDeposit,
  selectedChainId,
  selectedChainLabel,
  sourceChains,
  status,
  onAmountChange,
  onDeposit,
  onSourceChainChange,
  onSwitchChain
}: UnifiedBalanceDepositCardProps) {
  const isPending = status === "waiting_wallet";
  const switchLabel = selectedChainLabel ? `Switch your wallet to ${selectedChainLabel} to deposit.` : "Switch your wallet to deposit.";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/75">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Deposit USDC</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Deposit USDC to your Unified Balance before paying.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(status)}`}>{getStatusLabel(status)}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Source chain</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:focus:border-emerald-300/70"
            disabled={sourceChains.length === 0 || isPending}
            value={selectedChainId ?? ""}
            onChange={(event) => onSourceChainChange(event.target.value)}
          >
            {sourceChains.length === 0 ? <option value="">No supported source chains</option> : null}
            {sourceChains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.title}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-500">Balance: {formatBalance(balance)}</span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Amount</span>
          <div className="mt-2 flex min-h-11 items-center rounded-md border border-zinc-200 bg-white px-3 transition focus-within:border-emerald-500 dark:border-white/10 dark:bg-zinc-950 dark:focus-within:border-emerald-300/70">
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-600"
              disabled={isPending}
              inputMode="decimal"
              placeholder="10"
              type="text"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            <span className="ml-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">USDC</span>
          </div>
        </label>
      </div>

      {isConnected && isChainMismatch ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
          {switchLabel}
        </p>
      ) : null}

      {pendingDeposit || evidence ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100">
          Deposit confirmed. Balance update may take 1-5 minutes.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {isConnected && isChainMismatch ? (
          <button
            className="min-h-11 rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/15 sm:col-span-2"
            disabled={isSwitchingChain || isPending}
            type="button"
            onClick={onSwitchChain}
          >
            {isSwitchingChain ? "Switching network" : `Switch to ${selectedChainLabel ?? "source chain"}`}
          </button>
        ) : null}
        <button
          className="min-h-11 rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 sm:col-span-2"
          disabled={disabled || isPending}
          type="button"
          onClick={onDeposit}
        >
          {isPending ? "Waiting for wallet" : "Deposit USDC"}
        </button>
      </div>

      {!isConnected ? <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">Connect your wallet before depositing.</p> : null}
    </section>
  );
}

function getStatusLabel(status: UnifiedBalanceDepositStatus) {
  const labels = {
    failed: "Failed",
    idle: "Ready",
    success: "Confirmed",
    waiting_wallet: "Wallet"
  };

  return labels[status];
}

function getStatusTone(status: UnifiedBalanceDepositStatus) {
  const tones = {
    failed: "border-red-200 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100",
    idle: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100",
    waiting_wallet: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100"
  };

  return tones[status];
}

function formatBalance(value: string) {
  return `${Number(value || "0").toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(value) > 0 ? 2 : 0
  })} USDC`;
}
