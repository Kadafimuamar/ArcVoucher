"use client";

import type {
  UnifiedBalanceChainOption,
  UnifiedBalanceDepositEvidence,
  UnifiedBalanceDepositStatus,
  UnifiedBalancePendingDeposit,
  UnifiedBalancePendingTransaction
} from "@/lib/appkit/types";

type UnifiedBalanceDepositCardProps = {
  amount: string;
  currentChainId?: number;
  currentChainLabel: string;
  disabled: boolean;
  errorMessage?: string;
  evidence?: UnifiedBalanceDepositEvidence;
  elapsedSeconds: number;
  isChainMismatch: boolean;
  isCheckingPendingDeposits: boolean;
  isConnected: boolean;
  isSwitchingChain: boolean;
  pendingDeposit?: UnifiedBalancePendingDeposit;
  pendingDepositSupportMessage: string;
  pendingTransactions: UnifiedBalancePendingTransaction[];
  selectedChainId?: string;
  selectedChainLabel?: string;
  selectedEvmChainId?: number;
  sourceChains: UnifiedBalanceChainOption[];
  status: UnifiedBalanceDepositStatus;
  onAmountChange: (amount: string) => void;
  onCheckPendingDeposits: () => void;
  onDeposit: () => void;
  onRefreshBalance: () => void;
  onSourceChainChange: (chainId: string) => void;
  onSwitchChain: () => void;
};

export function UnifiedBalanceDepositCard({
  amount,
  currentChainId,
  currentChainLabel,
  disabled,
  errorMessage,
  evidence,
  elapsedSeconds,
  isChainMismatch,
  isCheckingPendingDeposits,
  isConnected,
  isSwitchingChain,
  pendingDeposit,
  pendingDepositSupportMessage,
  pendingTransactions,
  selectedChainId,
  selectedChainLabel,
  selectedEvmChainId,
  sourceChains,
  status,
  onAmountChange,
  onCheckPendingDeposits,
  onDeposit,
  onRefreshBalance,
  onSourceChainChange,
  onSwitchChain
}: UnifiedBalanceDepositCardProps) {
  const isPending = status === "waiting_wallet";
  const switchLabel = selectedChainLabel ? `Switch wallet to ${selectedChainLabel}` : "Switch wallet";

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/75 p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Unified Balance Deposit</p>
          <p className="mt-1 text-sm text-amber-100">You need to deposit USDC into Unified Balance before spending.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(status)}`}>{getStatusLabel(status)}</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-zinc-500">Source chain</span>
          <select
            className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none transition focus:border-emerald-300/70"
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
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase text-zinc-500">Amount</span>
          <div className="mt-2 flex min-h-11 items-center rounded-md border border-white/10 bg-zinc-950 px-3 transition focus-within:border-emerald-300/70">
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
              disabled={isPending}
              inputMode="decimal"
              placeholder="10"
              type="text"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            <span className="ml-3 text-xs font-semibold text-zinc-400">USDC</span>
          </div>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DepositMetric label="Current Wallet Chain" value={currentChainLabel} />
        <DepositMetric label="Selected Deposit Chain" value={formatSelectedChainLabel(selectedChainLabel, selectedEvmChainId)} />
        <DepositMetric label="Token" value="USDC" />
        <DepositMetric label="Estimated deposit fee" value="Not exposed by SDK" />
      </div>

      <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
        Unified Balance may take a few minutes to update after deposit confirmation.
      </p>

      {isConnected && isChainMismatch ? (
        <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
          <p className="font-semibold">{switchLabel}</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Unified Balance deposits must be signed while your wallet is connected to the selected source chain.
          </p>
        </div>
      ) : null}

      {errorMessage ? <p className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">{errorMessage}</p> : null}

      {evidence ? (
        <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Deposit confirmed</span>
            <span>{evidence.amount ?? amount} USDC</span>
          </div>
          {evidence.txHash ? <p className="mt-2 break-all text-xs opacity-80">Tx: {evidence.txHash}</p> : null}
          {evidence.explorerUrl ? (
            <a className="mt-2 inline-flex text-xs font-semibold text-emerald-50 underline" href={evidence.explorerUrl} rel="noreferrer" target="_blank">
              View deposit transaction
            </a>
          ) : null}
        </div>
      ) : null}

      {pendingDeposit ? (
        <div className="mt-4 rounded-lg border border-sky-300/25 bg-sky-300/10 p-3 text-sm text-sky-100">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Pending deposit</span>
            <span>{getPendingDepositStatusLabel(pendingDeposit.status)}</span>
          </div>
          <p className="mt-2 text-xs text-sky-100/80">{getPendingDepositMessage(pendingDeposit.status)}</p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <PendingMetric label="Source chain" value={pendingDeposit.sourceChainLabel} />
            <PendingMetric label="Amount" value={`${pendingDeposit.amount} USDC`} />
            <PendingMetric label="Elapsed time" value={formatElapsed(elapsedSeconds)} />
            <PendingMetric label="Status" value={getPendingDepositStatusLabel(pendingDeposit.status)} />
          </div>
          {pendingDeposit.txHash ? <p className="mt-3 break-all text-xs text-sky-100/80">Tx: {pendingDeposit.txHash}</p> : null}
          {pendingDeposit.explorerUrl ? (
            <a className="mt-2 inline-flex text-xs font-semibold text-sky-50 underline" href={pendingDeposit.explorerUrl} rel="noreferrer" target="_blank">
              View deposit transaction
            </a>
          ) : null}
          {pendingTransactions.length > 0 ? (
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
              <p className="text-xs font-semibold uppercase text-sky-100/70">Gateway pending deposits</p>
              <div className="mt-2 space-y-2">
                {pendingTransactions.map((transaction) => (
                  <div className="text-xs text-sky-100/80" key={`${transaction.transactionHash}-${transaction.amount}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{transaction.amount} USDC</span>
                      <span>{new Date(transaction.blockTimestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-1 break-all opacity-70">{transaction.transactionHash}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        {isConnected && isChainMismatch ? (
          <button
            className="min-h-12 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            disabled={isSwitchingChain || isPending}
            type="button"
            onClick={onSwitchChain}
          >
            {isSwitchingChain ? "Switching network" : switchLabel}
          </button>
        ) : null}
        <button
          className="min-h-12 rounded-md bg-emerald-300 px-4 text-sm font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={disabled || isPending}
          type="button"
          onClick={onDeposit}
        >
          {isPending ? "Waiting for wallet" : "Deposit USDC"}
        </button>
        <button
          className="min-h-12 rounded-md border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04]"
          type="button"
          onClick={onRefreshBalance}
        >
          Refresh Balance
        </button>
        <button
          className="min-h-12 rounded-md border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          disabled={!isConnected || isCheckingPendingDeposits}
          type="button"
          onClick={onCheckPendingDeposits}
        >
          {isCheckingPendingDeposits ? "Checking pending deposits" : "Check pending deposits"}
        </button>
      </div>

      <p className="mt-3 text-xs text-zinc-500">{pendingDepositSupportMessage}</p>

      {!isConnected ? <p className="mt-3 text-xs text-zinc-500">Connect your wallet before depositing.</p> : null}
      {isConnected && !currentChainId ? <p className="mt-3 text-xs text-zinc-500">Waiting for wallet chain details.</p> : null}
    </section>
  );
}

function DepositMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PendingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-2">
      <p className="font-semibold uppercase text-sky-100/60">{label}</p>
      <p className="mt-1 text-sky-50">{value}</p>
    </div>
  );
}

function getStatusLabel(status: UnifiedBalanceDepositStatus) {
  const labels = {
    failed: "Failed",
    idle: "Ready",
    success: "Deposited",
    waiting_wallet: "Wallet confirmation"
  };

  return labels[status];
}

function getStatusTone(status: UnifiedBalanceDepositStatus) {
  const tones = {
    failed: "border-red-400/25 bg-red-400/10 text-red-100",
    idle: "border-white/10 bg-white/[0.04] text-zinc-300",
    success: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    waiting_wallet: "border-amber-300/25 bg-amber-300/10 text-amber-100"
  };

  return tones[status];
}

function formatSelectedChainLabel(selectedChainLabel: string | undefined, selectedEvmChainId: number | undefined) {
  if (!selectedChainLabel) {
    return "Select source chain";
  }

  return selectedEvmChainId ? `${selectedChainLabel} (${selectedEvmChainId})` : selectedChainLabel;
}

function getPendingDepositStatusLabel(status: UnifiedBalancePendingDeposit["status"]) {
  const labels = {
    balance_updated: "Balance updated",
    confirmed_on_chain: "Confirmed on-chain",
    waiting_gateway: "Waiting for Gateway"
  };

  return labels[status];
}

function getPendingDepositMessage(status: UnifiedBalancePendingDeposit["status"]) {
  if (status === "balance_updated") {
    return "Gateway balance now includes this deposit.";
  }

  return "Deposit confirmed on-chain, waiting for Gateway balance update.";
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
