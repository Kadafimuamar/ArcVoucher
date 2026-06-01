"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, type Address, type Hex } from "viem";
import { useAccount } from "wagmi";
import { arcVoucherBackendUrl } from "@/lib/vouchers";

export type UnifiedOrderSource = "direct" | "unified-balance";
export type UnifiedOrderStatus = "paid" | "fulfilled" | "refunded" | "failed" | "cancelled";

export type UnifiedOrder = {
  amount: string;
  createdAt?: string;
  orderId: string;
  productId: string;
  productName: string;
  source: UnifiedOrderSource;
  status: UnifiedOrderStatus;
  txHash: Hex | null;
  voucherReady?: boolean;
};

export function useUnifiedOrders() {
  const { address, isConnected } = useAccount();
  const normalizedAddress = address ? getAddress(address) : undefined;
  const query = useQuery({
    enabled: Boolean(isConnected && normalizedAddress),
    queryFn: () => fetchUnifiedOrders(normalizedAddress as Address),
    queryKey: ["arcvoucher-unified-orders", normalizedAddress],
    refetchInterval: 15_000,
    retry: false
  });

  return {
    ...query,
    address: normalizedAddress,
    isConnected,
    orders: query.data ?? []
  };
}

export async function fetchUnifiedOrders(buyer: Address): Promise<UnifiedOrder[]> {
  const url = new URL("/orders", arcVoucherBackendUrl);
  url.searchParams.set("buyer", buyer);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  return (await response.json()) as UnifiedOrder[];
}

async function getApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
