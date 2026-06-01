import type { UnifiedBalanceSpendEvidence } from "@/lib/appkit/types";
import type { IntentStatusResponse, StoredIntent } from "@/lib/intents";

type UnifiedBalanceIntentStatusProps = {
  errorMessage?: string;
  intent?: StoredIntent;
  isLoading: boolean;
  onRefresh: () => void;
  spendEvidence?: UnifiedBalanceSpendEvidence;
  status: string;
};

export function UnifiedBalanceIntentStatus({
  errorMessage,
  intent,
  isLoading,
  onRefresh,
  spendEvidence,
  status
}: UnifiedBalanceIntentStatusProps) {
  const tone = getTone(status);

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Unified Balance order</p>
          <p className="mt-1 text-xs text-zinc-400">Backend-verified payment intent</p>
        </div>
        <button
          className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading || !intent}
          type="button"
          onClick={onRefresh}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className={`mt-4 rounded-lg border p-3 text-sm ${tone}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Status</span>
          <span className="text-right">{getStatusLabel(status)}</span>
        </div>
        <p className="mt-2 text-xs opacity-80">{getStatusMessage(status)}</p>
        {errorMessage ? <p className="mt-2 line-clamp-3 text-xs opacity-80">{errorMessage}</p> : null}
      </div>

      {intent ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Metric label="Intent" value={`#${intent.intentId}`} />
          <Metric label="Payment" value={intent.spendTxHash ? "Verified" : "Pending"} />
          <Metric label="Voucher" value={intent.voucherId ? "Ready" : "Pending"} />
          <Metric label="Expires" value={new Date(intent.expiresAt).toLocaleTimeString()} />
        </div>
      ) : null}

      {spendEvidence?.txHash || spendEvidence?.transferId ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold text-zinc-400">Spend evidence</p>
          {spendEvidence.txHash ? <p className="mt-2 break-all text-xs font-medium text-white">{spendEvidence.txHash}</p> : null}
          {spendEvidence.transferId ? <p className="mt-2 break-all text-xs text-zinc-300">Transfer: {spendEvidence.transferId}</p> : null}
          {spendEvidence.explorerUrl ? (
            <a
              className="mt-2 inline-flex text-xs font-semibold text-emerald-200 underline-offset-4 hover:underline"
              href={spendEvidence.explorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              View spend transaction
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500">
        TODO(v0.3): merge backend-verified Unified Balance purchases into the main order history after the store records original buyers.
      </p>
    </section>
  );
}

export function getIntentFromStatusResponse(response: IntentStatusResponse | undefined) {
  return response?.intent;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function getTone(status: string) {
  if (status === "failed") {
    return "border-red-400/25 bg-red-400/10 text-red-100";
  }
  if (status === "settled") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "voucher ready" || status === "preparing voucher" || status === "payment confirmed") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "payment attached" || status === "settlement submitted") {
    return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  }
  if (status === "verifying payment" || status === "waiting receiver payment" || status === "spend submitted") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function getStatusMessage(status: string) {
  switch (status) {
    case "preparing intent":
      return "Creating a backend payment intent.";
    case "estimating fees":
      return "Checking Unified Balance spend fees.";
    case "waiting wallet confirmation":
      return "Approve the Unified Balance spend in your wallet.";
    case "spend submitted":
      return "Unified Balance payment sent. Verifying the payment evidence.";
    case "verifying payment":
      return "Verifying the Arc transaction receipt, recipient, and credited amount.";
    case "waiting receiver payment":
      return "Payment verification is still pending.";
    case "payment confirmed":
      return "Payment confirmed. Preparing your voucher.";
    case "preparing voucher":
      return "Payment confirmed. Preparing your voucher.";
    case "voucher ready":
      return "Voucher ready.";
    case "payment attached":
      return "A raw payment was attached to your intent. Settlement is next.";
    case "settlement submitted":
      return "Backend settlement into ArcVoucherStore is in progress.";
    case "settled":
      return "Unified Balance payment verified. Voucher fulfillment follows.";
    case "failed":
      return "Unified Balance checkout failed or was rejected.";
    default:
      return "No Unified Balance spend has been submitted yet.";
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    failed: "Failed",
    idle: "Ready",
    "payment attached": "Payment confirmed",
    "payment confirmed": "Payment confirmed",
    "preparing intent": "Preparing checkout",
    "preparing voucher": "Preparing voucher",
    settled: "Payment confirmed",
    "settlement submitted": "Preparing voucher",
    "spend submitted": "Payment sent",
    "verifying payment": "Verifying payment",
    "voucher ready": "Voucher ready",
    "waiting receiver payment": "Payment verification pending",
    "waiting wallet confirmation": "Waiting for wallet"
  };

  return labels[status] ?? status;
}
