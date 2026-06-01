"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";

export type StoredVoucher = {
  orderId: string;
  buyer: Address;
  productId: string;
  amountPaid: string;
  voucherCode: string;
  voucherHash: Hex;
  txHash: Hex | null;
  status: "detected" | "fulfilling" | "fulfilled" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type VoucherRevealState =
  | {
      status: "idle" | "processing" | "forbidden" | "error";
      message: string;
      voucher?: never;
    }
  | {
      status: "ready";
      message: string;
      voucher: StoredVoucher;
    };

export const arcVoucherBackendUrl = process.env.NEXT_PUBLIC_ARCVOUCHER_BACKEND_URL ?? "http://127.0.0.1:4000";

export function useVoucherReveal({
  buyer,
  enabled,
  orderId
}: {
  buyer?: Address;
  enabled: boolean;
  orderId: number;
}) {
  return useQuery({
    enabled: enabled && Boolean(buyer),
    queryFn: () => fetchVoucher(orderId, buyer as Address),
    queryKey: ["arcvoucher-voucher", orderId, buyer],
    retry: false
  });
}

async function fetchVoucher(orderId: number, buyer: Address): Promise<VoucherRevealState> {
  const url = new URL(`/voucher/${orderId}`, arcVoucherBackendUrl);
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
