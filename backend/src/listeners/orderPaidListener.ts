import type { Address } from "viem";
import { config, publicClient } from "../clients/viem.js";
import { arcVoucherStoreAbi } from "../contracts/arcVoucherStore.js";
import { fulfillPaidOrder } from "../services/fulfillment.js";

export function startOrderPaidListener(): () => void {
  console.log(`[listener] Watching OrderPaid events at ${config.contractAddress}`);

  return publicClient.watchContractEvent({
    address: config.contractAddress,
    abi: arcVoucherStoreAbi,
    eventName: "OrderPaid",
    onError(error) {
      console.error("[listener] OrderPaid watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { amountPaid, buyer, orderId, productId } = log.args;

        if (orderId === undefined || buyer === undefined || productId === undefined || amountPaid === undefined) {
          console.warn("[listener] Ignoring malformed OrderPaid log", log);
          continue;
        }

        void fulfillPaidOrder({
          amountPaid,
          buyer: buyer as Address,
          orderId,
          productId
        });
      }
    },
    pollingInterval: 4_000
  });
}

