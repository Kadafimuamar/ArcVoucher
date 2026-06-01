type UnifiedBalanceCheckoutButtonProps = {
  disabled: boolean;
  isEstimating: boolean;
  status: string;
  onCheckout: () => void;
};

export function UnifiedBalanceCheckoutButton({ disabled, isEstimating, onCheckout, status }: UnifiedBalanceCheckoutButtonProps) {
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <button
        className="min-h-12 w-full rounded-full bg-emerald-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        disabled={disabled}
        type="button"
        onClick={onCheckout}
      >
        {isEstimating ? "Estimating fees" : getButtonLabel(status)}
      </button>
      <p className="text-xs text-zinc-500">Unified Balance spend is optional. Direct Arc payment remains available.</p>
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
