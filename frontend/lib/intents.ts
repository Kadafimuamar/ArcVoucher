"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { arcVoucherBackendUrl, type StoredVoucher, type VoucherRevealState } from "@/lib/vouchers";

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
  expectedAmount: string;
  expiresAt: string;
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

export type IntentStatusResponse = {
  intent: StoredIntent;
  localIntent?: StoredIntent;
  onChainIntent?: StoredIntent | null;
  rawPaymentId?: string | null;
  settlementTxHash?: Hex | null;
  voucherError?: string | null;
  voucherStatus?: "detected" | "fulfilling" | "fulfilled" | "failed" | null;
  voucherTxHash?: Hex | null;
};

export async function createBackendIntent({
  buyer,
  expectedAmount,
  productId,
  referenceId
}: {
  buyer: Address;
  expectedAmount: string;
  productId: number;
  referenceId: Hex;
}): Promise<StoredIntent> {
  const response = await fetch(new URL("/intents", arcVoucherBackendUrl), {
    body: JSON.stringify({
      buyer,
      expectedAmount,
      productId,
      referenceId
    }),
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  return (await response.json()) as StoredIntent;
}

export async function confirmBackendIntentSpend({
  buyer,
  expectedAmount,
  intentId,
  recipient,
  spendTxHash
}: {
  buyer: Address;
  expectedAmount: string;
  intentId: string;
  recipient: Address;
  spendTxHash: Hex;
}): Promise<IntentStatusResponse> {
  const response = await fetch(new URL(`/intents/${intentId}/confirm-spend`, arcVoucherBackendUrl), {
    body: JSON.stringify({
      buyer,
      expectedAmount,
      recipient,
      spendTxHash
    }),
    cache: "no-store",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  return (await response.json()) as IntentStatusResponse;
}

export function useIntentStatus(intentId: string | undefined) {
  return useQuery({
    enabled: Boolean(intentId),
    queryFn: () => fetchIntentStatus(intentId as string),
    queryKey: ["arcvoucher-intent", intentId],
    refetchInterval: 4_000,
    retry: false
  });
}

export function useIntentVoucherReveal({
  buyer,
  enabled,
  intentId
}: {
  buyer?: Address;
  enabled: boolean;
  intentId: string;
}) {
  return useQuery({
    enabled: enabled && Boolean(buyer && intentId),
    queryFn: () => fetchIntentVoucher(intentId, buyer as Address),
    queryKey: ["arcvoucher-intent-voucher", intentId, buyer],
    retry: false
  });
}

async function fetchIntentStatus(intentId: string): Promise<IntentStatusResponse> {
  const response = await fetch(new URL(`/intents/${intentId}`, arcVoucherBackendUrl), {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const result = (await response.json()) as IntentStatusResponse | StoredIntent;
  return "intent" in result ? result : { intent: result };
}

async function fetchIntentVoucher(intentId: string, buyer: Address): Promise<VoucherRevealState> {
  const url = new URL(`/intents/${intentId}/voucher`, arcVoucherBackendUrl);
  url.searchParams.set("buyer", buyer);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });

    if (response.status === 403) {
      return {
        message: "This voucher belongs to another wallet.",
        status: "forbidden"
      };
    }

    if (response.status === 404) {
      return {
        message: "Voucher is still processing.",
        status: "processing"
      };
    }

    if (!response.ok) {
      return {
        message: "Voucher is still processing.",
        status: "processing"
      };
    }

    const voucher = (await response.json()) as StoredVoucher;

    return {
      message: "Voucher is ready.",
      status: "ready",
      voucher
    };
  } catch {
    return {
      message: "Voucher is still processing.",
      status: "processing"
    };
  }
}

async function getApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
