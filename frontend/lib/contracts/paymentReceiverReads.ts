"use client";

import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import {
  arcVoucherPaymentReceiverAbi,
  arcVoucherPaymentReceiverAddress,
  unifiedPaymentStatusFromContract,
  type UnifiedPaymentStatusLabel
} from "@/lib/contracts/arcVoucherPaymentReceiver";

export type UnifiedPaymentRecord = {
  amount: bigint;
  buyer: Address;
  createdAt: bigint;
  createdAtTimestamp: number;
  id: number;
  productId: number;
  referenceId: Hex;
  status: UnifiedPaymentStatusLabel;
  statusCode: number;
  storeOrderId: number;
};

type PaymentTuple = readonly [
  id: bigint,
  buyer: Address,
  productId: bigint,
  amount: bigint,
  referenceId: Hex,
  status: number,
  createdAt: bigint,
  storeOrderId: bigint
];

const zeroReferenceId = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function useUnifiedPaymentByReference(referenceId: Hex | undefined) {
  const paymentIdQuery = useReadContract({
    address: arcVoucherPaymentReceiverAddress,
    abi: arcVoucherPaymentReceiverAbi,
    functionName: "paymentByReferenceId",
    args: [referenceId ?? zeroReferenceId],
    query: {
      enabled: Boolean(referenceId),
      refetchInterval: 5_000
    }
  });
  const paymentId = paymentIdQuery.data && paymentIdQuery.data > BigInt(0) ? Number(paymentIdQuery.data) : undefined;
  const paymentQuery = useUnifiedPaymentRecord(paymentId);

  return {
    error: paymentIdQuery.error ?? paymentQuery.error,
    isError: paymentIdQuery.isError || paymentQuery.isError,
    isLoading: paymentIdQuery.isLoading || paymentQuery.isLoading,
    payment: paymentQuery.payment,
    paymentId,
    refetch: () => {
      void paymentIdQuery.refetch();
      paymentQuery.refetch();
    }
  };
}

export function useUnifiedPaymentRecord(paymentId: number | undefined) {
  const query = useReadContract({
    address: arcVoucherPaymentReceiverAddress,
    abi: arcVoucherPaymentReceiverAbi,
    functionName: "payments",
    args: [BigInt(paymentId ?? 0)],
    query: {
      enabled: Boolean(paymentId),
      refetchInterval: 5_000
    }
  });

  return {
    ...query,
    payment: mapPaymentTuple(query.data as PaymentTuple | undefined),
    refetch: () => {
      void query.refetch();
    }
  };
}

function mapPaymentTuple(payment: PaymentTuple | undefined): UnifiedPaymentRecord | undefined {
  if (!payment) {
    return undefined;
  }

  const [id, buyer, productId, amount, referenceId, status, createdAt, storeOrderId] = payment;

  if (id === BigInt(0)) {
    return undefined;
  }

  return {
    amount,
    buyer,
    createdAt,
    createdAtTimestamp: Number(createdAt),
    id: Number(id),
    productId: Number(productId),
    referenceId,
    status: unifiedPaymentStatusFromContract(Number(status)),
    statusCode: Number(status),
    storeOrderId: Number(storeOrderId)
  };
}
