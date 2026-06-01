import { keccak256, stringToHex, type Address } from "viem";
import { account, config, publicClient, walletClient } from "../clients/viem.js";
import { arcVoucherStoreAbi } from "../contracts/arcVoucherStore.js";
import { generateMockVoucherCode } from "../vouchers/mockVoucher.js";
import type { StoredVoucher } from "../vouchers/types.js";
import { voucherStore } from "../vouchers/voucherStore.js";

export type OrderPaidEvent = {
  amountPaid: bigint;
  buyer: Address;
  orderId: bigint;
  productId: bigint;
};

const processingOrderIds = new Set<string>();

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

    const baseRecord: StoredVoucher = {
      orderId,
      buyer: order.buyer,
      productId: order.productId.toString(),
      amountPaid: order.amountPaid.toString(),
      voucherCode,
      voucherHash,
      txHash: null,
      status: "fulfilling",
      createdAt: now,
      updatedAt: now
    };

    await voucherStore.upsert(baseRecord);

    const txHash = await walletClient.writeContract({
      account,
      address: config.contractAddress,
      abi: arcVoucherStoreAbi,
      functionName: "fulfillOrder",
      args: [order.orderId, voucherHash]
    });

    console.log(`[fulfillment] fulfillOrder submitted orderId=${orderId} tx=${txHash}`);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    await voucherStore.upsert({
      ...baseRecord,
      txHash,
      status: "fulfilled",
      updatedAt: new Date().toISOString()
    });

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
