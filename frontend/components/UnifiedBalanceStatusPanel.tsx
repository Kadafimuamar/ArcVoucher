import Link from "next/link";
import type { UnifiedBalancePendingDeposit } from "@/lib/appkit/types";
import type { UnifiedBalanceUiState } from "@/lib/appkit/unifiedBalanceCheckoutUi";
import type { StoredIntent } from "@/lib/intents";

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
  uiState
}: UnifiedBalanceStatusPanelProps) {
  if (isVoucherReady) {
    return (
      <section className="rounded-lg border border-emerald-200 bg-white p-5 text-center shadow-xl shadow-emerald-100/80 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-none">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-sm font-black text-white dark:bg-emerald-300 dark:text-zinc-950">
          Done
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Purchase Complete</p>
        <h2 className="mt-1 text-2xl font-black text-zinc-950 dark:text-white">Your voucher is ready</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {intent?.intentId ? (
            <Link
              className="flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
              href={`/orders/unified/${intent.intentId}`}
            >
              View Voucher
            </Link>
          ) : null}
          <Link
            className="flex min-h-11 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.04]"
            href="/orders"
          >
            View Orders
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-lg border p-4 shadow-sm ${isFailed ? failureTone : statusTone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Status</p>
          <h2 className="mt-1 text-xl font-black">{uiState.message}</h2>
          <p className="mt-2 text-sm opacity-80">{getStatusHelpText({ isSettled, pendingDeposit, uiState })}</p>
          {pendingDeposit && pendingDeposit.status !== "balance_updated" ? (
            <p className="mt-2 text-sm opacity-80">Deposit confirmed. Balance update may take 1-5 minutes.</p>
          ) : null}
          {isSettled && !isVoucherReady ? (
            <p className="mt-2 text-sm opacity-80">Your voucher is being prepared. This usually takes less than a minute.</p>
          ) : null}
          {sessionRestored ? <p className="mt-2 text-sm font-semibold">Checkout resumed.</p> : null}
          {!isFailed && errorMessage ? (
            <p className="mt-3 rounded-md bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
              {errorMessage}
            </p>
          ) : null}
          {isFailed && errorMessage ? <p className="mt-3 rounded-md bg-white/60 p-3 text-sm dark:bg-black/20">{errorMessage}</p> : null}
          {isFailed && intent?.spendTxHash ? (
            <p className="mt-3 rounded-md bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
              Payment may already be sent. Retry verification before starting another payment.
            </p>
          ) : null}
        </div>
        <button
          className="min-h-11 rounded-md border border-zinc-300 px-4 text-sm font-semibold transition hover:bg-white/70 dark:border-white/10 dark:hover:bg-white/[0.04]"
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
            Reset
          </button>
        </div>
      ) : null}
    </section>
  );
}

const statusTone = "border-sky-500/20 bg-sky-50 text-sky-950 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100";
const failureTone = "border-red-500/20 bg-red-50 text-red-950 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100";

function getStatusHelpText({
  isSettled,
  pendingDeposit,
  uiState
}: {
  isSettled: boolean;
  pendingDeposit?: UnifiedBalancePendingDeposit;
  uiState: UnifiedBalanceUiState;
}) {
  if (pendingDeposit && pendingDeposit.status !== "balance_updated") {
    return "Your deposit is confirmed and the balance is updating.";
  }
  if (isSettled) {
    return "Your payment is confirmed and the voucher is being prepared.";
  }

  return uiState.estimate;
}
