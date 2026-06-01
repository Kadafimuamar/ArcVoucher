import type { Hex } from "viem";
import type { UnifiedPaymentRecord } from "@/lib/contracts/paymentReceiverReads";
import { formatUsdc, shortAddress } from "@/lib/format";

type UnifiedBalancePaymentReceiverStatusProps = {
  errorMessage?: string;
  isLoading: boolean;
  onRefresh: () => void;
  payment?: UnifiedPaymentRecord;
  paymentId?: number;
  referenceId?: Hex;
};

export function UnifiedBalancePaymentReceiverStatus({
  errorMessage,
  isLoading,
  onRefresh,
  payment,
  paymentId,
  referenceId
}: UnifiedBalancePaymentReceiverStatusProps) {
  const status = getReceiverStatus({ errorMessage, isLoading, payment, referenceId });
  const tone = getTone(status);

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Payment verification</p>
          <p className="mt-1 text-xs text-zinc-400">Legacy receiver status</p>
        </div>
        <button
          className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading || !referenceId}
          type="button"
          onClick={onRefresh}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className={`mt-4 rounded-lg border p-3 text-sm ${tone}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Status</span>
          <span>{status}</span>
        </div>
        {errorMessage ? <p className="mt-2 line-clamp-3 text-xs opacity-80">{errorMessage}</p> : null}
      </div>

      {referenceId ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold text-zinc-400">Reference ID</p>
          <p className="mt-2 break-all text-xs font-medium text-zinc-200">{referenceId}</p>
        </div>
      ) : null}

      {payment ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Metric label="Payment ID" value={`#${payment.id}`} />
          <Metric label="Buyer" value={shortAddress(payment.buyer)} />
          <Metric label="Product" value={`#${payment.productId}`} />
          <Metric label="Amount" value={formatUsdc(payment.amount)} />
          <Metric label="Store order" value={payment.storeOrderId > 0 ? `#${payment.storeOrderId}` : "Pending"} />
          <Metric label="Created" value={formatTimestamp(payment.createdAtTimestamp)} />
        </div>
      ) : paymentId ? (
        <p className="mt-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
          Payment #{paymentId} was found, but the record is still loading.
        </p>
      ) : null}
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

function getReceiverStatus({
  errorMessage,
  isLoading,
  payment,
  referenceId
}: {
  errorMessage?: string;
  isLoading: boolean;
  payment?: UnifiedPaymentRecord;
  referenceId?: Hex;
}) {
  if (errorMessage) {
    return "Read error";
  }
  if (!referenceId) {
    return "Not prepared";
  }
  if (isLoading) {
    return "Checking";
  }
  if (payment) {
    return payment.status;
  }

  return "Not received";
}

function getTone(status: string) {
  if (status === "Read error") {
    return "border-red-400/25 bg-red-400/10 text-red-100";
  }
  if (status === "Settled") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "Refunded") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }
  if (status === "Received") {
    return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function formatTimestamp(timestamp: number) {
  if (!timestamp) {
    return "Pending";
  }

  return new Date(timestamp * 1000).toLocaleString();
}
