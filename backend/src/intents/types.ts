import type { Address, Hex } from "viem";

export type StoredIntentStatus =
  | "created"
  | "paid"
  | "voucher_fulfilled"
  | "payment_attached"
  | "settled"
  | "refunded"
  | "cancelled"
  | "failed";

export type StoredIntent = {
  attachTxHash?: Hex | null;
  buyer: Address;
  createdAt: string;
  error?: string | null;
  expiresAt: string;
  expectedAmount: string;
  intentId: string;
  paidAt?: string | null;
  productId: string;
  rawPaymentId?: string | null;
  referenceId: Hex;
  refundTxHash?: Hex | null;
  settleTxHash?: Hex | null;
  spendAmount?: string | null;
  spendConfirmedAt?: string | null;
  spendRecipient?: Address | null;
  spendTxHash?: Hex | null;
  status: StoredIntentStatus;
  storeOrderId?: string | null;
  txHash?: Hex | null;
  updatedAt: string;
  verificationMethod?: string | null;
  voucherId?: string | null;
};

export type StoredRawPayment = {
  amount: string;
  attached: boolean;
  createdAt: string;
  matchedIntentId?: string | null;
  rawPaymentId: string;
  sender: Address;
  txHash?: Hex | null;
  updatedAt: string;
};

export type IntentStoreFile = {
  intents: StoredIntent[];
  rawPayments: StoredRawPayment[];
};
