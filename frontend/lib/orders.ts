import { parseEther, type Address, type Hex } from "viem";

export type OrderStatus = "Paid" | "Fulfilled" | "Refunded";

export type OrderPreview = {
  id: number;
  buyer?: Address;
  productId?: number;
  productName: string;
  amountPaid: bigint;
  status: OrderStatus;
  createdAt: string;
  createdAtTimestamp?: number;
  txHash?: Hex | null;
  fulfilledTxHash?: Hex | null;
  voucherHash?: Hex;
};

export type ChainOrder = Required<Omit<OrderPreview, "txHash" | "fulfilledTxHash">> & {
  fulfilledTxHash: Hex | null;
  txHash: Hex | null;
};

export const orderStatusLabels = ["Paid", "Fulfilled", "Refunded"] as const satisfies readonly OrderStatus[];

export function orderStatusFromContract(status: number): OrderStatus {
  return orderStatusLabels[status] ?? "Paid";
}

export function formatOrderTimestamp(timestamp: bigint | number) {
  const seconds = Number(timestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(seconds * 1000));
}

export const demoOrders: OrderPreview[] = [
  {
    id: 1001,
    productName: "Steam Gift Card $10",
    amountPaid: parseEther("10"),
    status: "Paid",
    createdAt: "Today"
  },
  {
    id: 1002,
    productName: "Netflix Gift Card $15",
    amountPaid: parseEther("15"),
    status: "Fulfilled",
    createdAt: "Yesterday"
  },
  {
    id: 1003,
    productName: "Amazon Gift Card $25",
    amountPaid: parseEther("25"),
    status: "Refunded",
    createdAt: "May 29"
  }
];
