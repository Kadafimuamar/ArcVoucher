import type { Address, Hex } from "viem";

export type VoucherStatus = "detected" | "fulfilling" | "fulfilled" | "failed";

export type StoredVoucher = {
  orderId: string;
  buyer: Address;
  productId: string;
  amountPaid: string;
  voucherCode: string;
  voucherHash: Hex;
  txHash: Hex | null;
  status: VoucherStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

