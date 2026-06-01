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
    return buildState("voucher", "Payment confirmed. Preparing your voucher.", "Usually less than a minute", false, "store_order");
  }

  if (intent?.status === "settled") {
    return buildState("voucher", "Payment confirmed. Preparing your voucher.", "Usually less than a minute", false, "store_order");
  }

  if (intent?.status === "payment_attached" || hasReceiverPayment) {
    return buildState("store_order", "Payment confirmed. Preparing your voucher.", "Usually less than a minute", false, "receiver");
  }

  if (spendSubmitted || localStatus === "spend submitted" || localStatus === "verifying payment" || localStatus === "waiting receiver payment") {
    return buildState("receiver", "Payment sent. Confirming payment...", "Usually less than a minute", false, "spend");
  }

  if (localStatus === "waiting wallet confirmation" || localStatus === "preparing intent" || localStatus === "estimating fees") {
    return buildState("spend", "Confirm the payment in your wallet.", "Usually 30-90 seconds", false, hasSufficientBalance ? "deposit" : undefined);
  }

  if (pendingDeposit && pendingDeposit.status !== "balance_updated") {
    return buildState("deposit", "Deposit confirmed. Updating your balance.", "Usually 1-5 minutes");
  }

  if (!hasSufficientBalance) {
    return buildState("deposit", "Deposit USDC to continue.", "Usually 1-5 minutes");
  }

  return buildState("spend", "Ready to pay.", "Usually 30-90 seconds", false, "deposit");
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
    receiver: "Pay",
    spend: "Pay",
    store_order: "Pay",
    voucher: "Voucher"
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
