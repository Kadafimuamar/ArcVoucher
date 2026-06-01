import type { UnifiedBalancePendingDeposit } from "@/lib/appkit/types";
import type { UnifiedBalanceSessionStep } from "@/lib/appkit/unifiedBalanceSession";
import type { IntentStatusResponse, StoredIntent } from "@/lib/intents";

export type UnifiedBalanceStepState = "pending" | "processing" | "done" | "failed";

export type UnifiedBalanceStep = {
  id: UnifiedBalanceSessionStep;
  label: string;
  state: UnifiedBalanceStepState;
};

export type UnifiedBalanceUiState = {
  currentStep: UnifiedBalanceSessionStep;
  estimate: string;
  message: string;
  steps: UnifiedBalanceStep[];
};

export function getUnifiedBalanceUiState({
  errorMessage,
  hasSufficientBalance,
  intent,
  intentStatus,
  localStatus,
  pendingDeposit,
  spendSubmitted
}: {
  errorMessage?: string;
  hasSufficientBalance: boolean;
  intent?: StoredIntent;
  intentStatus?: IntentStatusResponse;
  localStatus: string;
  pendingDeposit?: UnifiedBalancePendingDeposit;
  spendSubmitted: boolean;
}): UnifiedBalanceUiState {
  const voucherStatus = intentStatus?.voucherStatus;
  const failed = localStatus === "failed" || intent?.status === "refunded" || intent?.status === "cancelled";
  const hasReceiverPayment = Boolean(intent?.rawPaymentId);

  if (voucherStatus === "fulfilled" || intent?.status === "voucher_fulfilled" || localStatus === "voucher ready") {
    return buildState("voucher", "Voucher ready.", "Ready now", failed);
  }

  if (failed) {
    return buildState("failed", errorMessage ?? "Checkout failed. Review the reason below before retrying.", "Needs attention", true);
  }

  if (intent?.status === "paid" || localStatus === "preparing voucher" || localStatus === "payment confirmed") {
    return buildState("voucher", "Payment confirmed. Preparing your voucher.", "Usually 10-60 seconds", false, "store_order");
  }

  if (intent?.status === "settled") {
    return buildState("voucher", "Order created. Preparing your voucher.", "Usually 10-60 seconds", false, "store_order");
  }

  if (intent?.status === "payment_attached" || hasReceiverPayment) {
    return buildState("store_order", "Payment confirmed. Creating your voucher order.", "Usually 10-60 seconds", false, "receiver");
  }

  if (spendSubmitted || localStatus === "spend submitted" || localStatus === "verifying payment" || localStatus === "waiting receiver payment") {
    return buildState("receiver", "Unified Balance payment sent. Verifying payment.", "Usually 10-60 seconds", false, "spend");
  }

  if (localStatus === "waiting wallet confirmation" || localStatus === "preparing intent" || localStatus === "estimating fees") {
    return buildState("spend", "Confirm the Unified Balance payment in your wallet.", "Usually 30-90 seconds", false, hasSufficientBalance ? "deposit" : undefined);
  }

  if (pendingDeposit && pendingDeposit.status !== "balance_updated") {
    return buildState("deposit", "Deposit confirmed. Waiting for Gateway balance update.", "Usually 1-5 minutes");
  }

  if (!hasSufficientBalance) {
    return buildState("deposit", "Deposit USDC into Unified Balance to continue.", "Usually 1-5 minutes");
  }

  return buildState("spend", "Unified Balance is ready. You can pay now.", "Usually 30-90 seconds", false, "deposit");
}

function buildState(
  currentStep: UnifiedBalanceSessionStep | "failed",
  message: string,
  estimate: string,
  failed = false,
  doneThrough?: UnifiedBalanceSessionStep
): UnifiedBalanceUiState {
  const stepOrder: UnifiedBalanceSessionStep[] = ["deposit", "spend", "receiver", "store_order", "voucher"];
  const labels: Record<UnifiedBalanceSessionStep, string> = {
    deposit: "Deposit",
    failed: "Failed",
    receiver: "Payment verification",
    spend: "Spend",
    store_order: "Store order",
    voucher: "Voucher ready"
  };
  const activeStep = currentStep === "failed" ? "spend" : currentStep;
  const doneIndex = doneThrough ? stepOrder.indexOf(doneThrough) : stepOrder.indexOf(activeStep) - 1;

  return {
    currentStep: activeStep,
    estimate,
    message,
    steps: stepOrder.map((id, index) => ({
      id,
      label: labels[id],
      state: failed && id === activeStep ? "failed" : index <= doneIndex ? "done" : id === activeStep ? "processing" : "pending"
    }))
  };
}
