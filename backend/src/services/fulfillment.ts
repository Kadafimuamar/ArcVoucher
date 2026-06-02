import { keccak256, stringToHex, type Address, type Hex } from "viem";
import { account, config, publicClient, walletClient } from "../clients/viem.js";
import { arcVoucherStoreAbi } from "../contracts/arcVoucherStore.js";
import type { StoredIntent } from "../intents/types.js";
import { generateMockVoucherCode } from "../vouchers/mockVoucher.js";
import type { StoredVoucher } from "../vouchers/types.js";
import { voucherStore } from "../vouchers/voucherStore.js";

export type OrderPaidEvent = {
  amountPaid: bigint;
  buyer: Address;
  orderId: bigint;
  productId: bigint;
};

export type DirectStoreOrder = {
  amountPaid: bigint;
  buyer: Address;
  createdAt: bigint;
  id: bigint;
  productId: bigint;
  status: number;
  voucherHash: Hex;
};

type StoreOrderTuple = readonly [
  id: bigint,
  buyer: Address,
  productId: bigint,
  amountPaid: bigint,
  status: number,
  voucherHash: Hex,
  createdAt: bigint
];

const processingOrderIds = new Set<string>();
const directOrderStatusNames = ["Paid", "Fulfilled", "Refunded"] as const;
const fulfilledOrderStatus = 1;
const zeroVoucherHash = `0x${"0".repeat(64)}` as Hex;

export class DirectVoucherRepairError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "DirectVoucherRepairError";
  }
}

export function getIntentVoucherId(intentId: string): string {
  return `intent:${intentId}`;
}

export async function fulfillPaidOrder(order: OrderPaidEvent): Promise<void> {
  const orderId = order.orderId.toString();

  console.log(
    `[listener] OrderPaid orderId=${orderId} buyer=${order.buyer} productId=${order.productId.toString()} amountPaid=${order.amountPaid.toString()}`
  );

  if (processingOrderIds.has(orderId)) {
    console.log(`[listener] Order ${orderId} is already being processed`);
    return;
  }

  const existing = voucherStore.get(orderId);
  if (existing) {
    console.log(`[listener] Order ${orderId} already processed with status ${existing.status}`);
    return;
  }

  processingOrderIds.add(orderId);

  try {
    const now = new Date().toISOString();
    const voucherCode = generateMockVoucherCode(order.orderId, order.productId);
    const voucherHash = keccak256(stringToHex(voucherCode));

    const txHash = await walletClient.writeContract({
      account,
      address: config.contractAddress,
      abi: arcVoucherStoreAbi,
      functionName: "fulfillOrder",
      args: [order.orderId, voucherHash]
    });

    console.log(`[fulfillment] fulfillOrder submitted orderId=${orderId} tx=${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      throw new Error(`fulfillOrder transaction failed for order ${orderId}`);
    }

    await voucherStore.upsert({
      orderId,
      buyer: order.buyer,
      productId: order.productId.toString(),
      amountPaid: order.amountPaid.toString(),
      voucherCode,
      voucherHash,
      txHash,
      status: "fulfilled",
      createdAt: now,
      updatedAt: new Date().toISOString()
    });

    logVoucherStoreRead(orderId);
    console.log(`[fulfillment] Order ${orderId} fulfilled`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const existingRecord = voucherStore.get(orderId);

    if (existingRecord) {
      await voucherStore.upsert({
        ...existingRecord,
        status: "failed",
        updatedAt: new Date().toISOString(),
        error: message
      });
    }

    console.error(`[fulfillment] Order ${orderId} failed`, error);
  } finally {
    processingOrderIds.delete(orderId);
  }
}

export async function readDirectStoreOrder(orderId: bigint): Promise<DirectStoreOrder> {
  const order = (await publicClient.readContract({
    address: config.contractAddress,
    abi: arcVoucherStoreAbi,
    functionName: "orders",
    args: [orderId]
  })) as StoreOrderTuple;
  const [id, buyer, productId, amountPaid, status, voucherHash, createdAt] = order;

  return {
    amountPaid,
    buyer,
    createdAt,
    id,
    productId,
    status: Number(status),
    voucherHash
  };
}

export function getDirectOrderStatusName(status: number): string {
  return directOrderStatusNames[status] ?? `Unknown(${status})`;
}

export function directOrderHasVoucherHash(order: DirectStoreOrder): boolean {
  return order.voucherHash.toLowerCase() !== zeroVoucherHash;
}

export async function repairDirectVoucherFromChain(orderIdInput: string, requestBuyer: Address): Promise<StoredVoucher> {
  const orderId = normalizeDirectOrderId(orderIdInput);
  const orderIdKey = orderId.toString();
  const existing = voucherStore.get(orderIdKey);

  if (existing) {
    return existing;
  }

  const order = await readDirectStoreOrder(orderId);

  if (order.id === BigInt(0)) {
    throw new DirectVoucherRepairError(404, `Order ${orderIdKey} not found`);
  }

  if (order.status !== fulfilledOrderStatus) {
    throw new DirectVoucherRepairError(404, `Order ${orderIdKey} is not fulfilled`);
  }

  if (order.buyer.toLowerCase() !== requestBuyer.toLowerCase()) {
    throw new DirectVoucherRepairError(403, "Forbidden");
  }

  if (!directOrderHasVoucherHash(order)) {
    throw new DirectVoucherRepairError(404, `Order ${orderIdKey} has no voucher hash`);
  }

  const voucherCode = generateMockVoucherCode(order.id, order.productId);
  const voucherHash = keccak256(stringToHex(voucherCode));

  if (voucherHash.toLowerCase() !== order.voucherHash.toLowerCase()) {
    throw new DirectVoucherRepairError(409, "On-chain voucher hash does not match deterministic demo voucher");
  }

  const now = new Date().toISOString();
  const voucher: StoredVoucher = {
    amountPaid: order.amountPaid.toString(),
    buyer: order.buyer,
    createdAt: order.createdAt > BigInt(0) ? new Date(Number(order.createdAt) * 1000).toISOString() : now,
    orderId: orderIdKey,
    productId: order.productId.toString(),
    status: "fulfilled",
    txHash: null,
    updatedAt: now,
    voucherCode,
    voucherHash
  };

  console.log(
    `[repair] backfilling direct voucher orderId=${voucher.orderId} buyer=${voucher.buyer} productId=${voucher.productId} amountPaid=${voucher.amountPaid}`
  );
  await voucherStore.upsert(voucher);
  logVoucherStoreRead(orderIdKey);

  return voucherStore.get(orderIdKey) ?? voucher;
}

export async function fulfillVerifiedIntent(intent: StoredIntent): Promise<StoredVoucher> {
  const voucherId = getIntentVoucherId(intent.intentId);
  const existing = voucherStore.get(voucherId);

  if (existing?.status === "fulfilled") {
    console.log(
      `[fulfillment] Unified Balance voucher already exists orderId=${voucherId} buyer=${existing.buyer} productId=${existing.productId} status=${existing.status}`
    );
    return existing;
  }

  const now = new Date().toISOString();
  const voucherCode = generateMockVoucherCode(BigInt(intent.intentId), BigInt(intent.productId));
  const voucherHash = keccak256(stringToHex(voucherCode));
  console.log(
    `[fulfillment] generating Unified Balance voucher orderId=${voucherId} buyer=${intent.buyer} productId=${intent.productId} amountPaid=${intent.expectedAmount}`
  );
  const voucher: StoredVoucher = {
    amountPaid: intent.expectedAmount,
    buyer: intent.buyer,
    createdAt: existing?.createdAt ?? now,
    orderId: voucherId,
    productId: intent.productId,
    status: "fulfilled",
    txHash: intent.spendTxHash ?? null,
    updatedAt: now,
    voucherCode,
    voucherHash
  };

  await voucherStore.upsert(voucher);
  console.log(
    `[fulfillment] stored Unified Balance voucher orderId=${voucher.orderId} buyer=${voucher.buyer} productId=${voucher.productId} status=${voucher.status}`
  );
  return voucher;
}

function normalizeDirectOrderId(orderId: string): bigint {
  try {
    const parsed = BigInt(orderId);

    if (parsed <= BigInt(0)) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new DirectVoucherRepairError(400, "orderId must be a positive integer");
  }
}

function logVoucherStoreRead(orderId: string): void {
  const saved = voucherStore.get(orderId);

  console.log("[fulfillment] voucherStore.get", {
    amountPaid: saved?.amountPaid ?? null,
    buyer: saved?.buyer ?? null,
    exists: Boolean(saved),
    orderId,
    productId: saved?.productId ?? null,
    status: saved?.status ?? null,
    txHash: saved?.txHash ?? null,
    voucherHash: saved?.voucherHash ?? null
  });
}
