type UnifiedBalanceCheckoutButtonProps = {
  disabled: boolean;
  isEstimating: boolean;
  status: string;
  onCheckout: () => void;
};

export function UnifiedBalanceCheckoutButton({ disabled, isEstimating, onCheckout, status }: UnifiedBalanceCheckoutButtonProps) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-zinc-900/70">
      <button
        className="min-h-12 w-full rounded-full bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        disabled={disabled}
        type="button"
        onClick={onCheckout}
      >
        {isEstimating ? "Estimating fees" : getButtonLabel(status)}
      </button>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">Unified Balance is optional. Direct Arc payment remains available.</p>
    </div>
  );
}

function getButtonLabel(status: string) {
  if (status === "settled") {
    return "Unified Balance settled";
  }
  if (status === "voucher ready") {
    return "Voucher ready";
  }
  if (
    status === "preparing intent" ||
    status === "waiting wallet confirmation" ||
    status === "spend submitted" ||
    status === "verifying payment" ||
    status === "preparing voucher" ||
    status === "waiting receiver payment" ||
    status === "payment attached" ||
    status === "settlement submitted"
  ) {
    return "Processing Unified Balance";
  }
  if (status === "failed") {
    return "Retry Unified Balance";
  }

  return "Pay with Unified Balance";
}
