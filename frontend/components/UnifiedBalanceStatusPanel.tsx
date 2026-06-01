import Link from "next/link";
import type { UnifiedBalancePendingDeposit } from "@/lib/appkit/types";
import type { UnifiedBalanceUiState } from "@/lib/appkit/unifiedBalanceCheckoutUi";
import type { StoredIntent } from "@/lib/intents";
import { arcVoucherBackendUrl } from "@/lib/vouchers";

type UnifiedBalanceStatusPanelProps = {
  errorMessage?: string;
  intent?: StoredIntent;
  isFailed: boolean;
  isSettled: boolean;
  isVoucherReady: boolean;
  onRefresh: () => void;
  onResetSession: () => void;
  onRetry: () => void;
  pendingDeposit?: UnifiedBalancePendingDeposit;
  sessionRestored: boolean;
  stepElapsedSeconds: number;
  uiState: UnifiedBalanceUiState;
};

export function UnifiedBalanceStatusPanel({
  errorMessage,
  intent,
  isFailed,
  isSettled,
  isVoucherReady,
  onRefresh,
  onResetSession,
  onRetry,
  pendingDeposit,
  sessionRestored,
  stepElapsedSeconds,
  uiState
}: UnifiedBalanceStatusPanelProps) {
  if (isVoucherReady) {
    return (
      <section className="rounded-lg border border-emerald-500/25 bg-emerald-50 p-5 text-emerald-950 shadow-sm dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100">
        <p className="text-sm font-semibold">Purchase complete</p>
        <h2 className="mt-1 text-2xl font-black">Your voucher is ready</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {intent?.storeOrderId ? (
            <Link className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-black text-white dark:bg-emerald-300 dark:text-zinc-950" href={`/orders/${intent.storeOrderId}`}>
              View voucher
            </Link>
          ) : null}
          {intent?.voucherId ? (
            <a
              className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-black text-white dark:bg-emerald-300 dark:text-zinc-950"
              href={new URL(`/intents/${intent.intentId}/voucher?buyer=${intent.buyer}`, arcVoucherBackendUrl).toString()}
              rel="noreferrer"
              target="_blank"
            >
              View voucher
            </a>
          ) : null}
          <Link className="rounded-md border border-emerald-600/30 px-4 py-3 text-sm font-semibold" href="/orders">
            View orders
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-lg border p-5 shadow-sm ${isFailed ? failureTone : statusTone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Main status</p>
          <h2 className="mt-1 text-xl font-black">{uiState.message}</h2>
          <p className="mt-2 text-sm opacity-80">
            {uiState.message} - {uiState.estimate}. Elapsed: {formatElapsed(stepElapsedSeconds)}.
          </p>
          {pendingDeposit && pendingDeposit.status !== "balance_updated" ? (
            <p className="mt-2 text-sm opacity-80">Deposit confirmed on-chain, waiting for Gateway balance update.</p>
          ) : null}
          {isSettled && !isVoucherReady ? (
            <p className="mt-2 text-sm opacity-80">Voucher is being prepared. This may take up to 1 minute.</p>
          ) : null}
          {sessionRestored ? <p className="mt-2 text-sm font-semibold">Resume checkout session active.</p> : null}
          {isFailed && errorMessage ? <p className="mt-3 rounded-md bg-white/60 p-3 text-sm dark:bg-black/20">{errorMessage}</p> : null}
          {isFailed && intent?.spendTxHash ? (
            <p className="mt-3 rounded-md bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
              Payment may already be sent. Do not retry the spend while verification is still pending unless you have checked the advanced details.
            </p>
          ) : null}
        </div>
        <button
          className="min-h-10 rounded-md border border-zinc-300 px-4 text-sm font-semibold transition hover:bg-white/70 dark:border-white/10 dark:hover:bg-white/[0.04]"
          type="button"
          onClick={onRefresh}
        >
          Refresh
        </button>
      </div>

      {isFailed ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-black text-white dark:bg-emerald-300 dark:text-zinc-950" type="button" onClick={onRetry}>
            Retry
          </button>
          <button className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-white/10" type="button" onClick={onResetSession}>
            Reset session
          </button>
        </div>
      ) : null}
    </section>
  );
}

const statusTone = "border-sky-500/20 bg-sky-50 text-sky-950 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100";
const failureTone = "border-red-500/20 bg-red-50 text-red-950 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
