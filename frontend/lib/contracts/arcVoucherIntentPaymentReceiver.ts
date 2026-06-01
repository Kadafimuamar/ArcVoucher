import type { Address } from "viem";

export const arcVoucherIntentPaymentReceiverAddress = (
  process.env.NEXT_PUBLIC_ARC_VOUCHER_INTENT_PAYMENT_RECEIVER_ADDRESS ?? "0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971"
) as Address;
