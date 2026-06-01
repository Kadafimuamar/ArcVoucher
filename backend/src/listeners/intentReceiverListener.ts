import { config, publicClient } from "../clients/viem.js";
import { arcVoucherIntentPaymentReceiverAbi } from "../contracts/arcVoucherIntentPaymentReceiver.js";
import { intentStore } from "../intents/intentStore.js";
import type { StoredIntent, StoredRawPayment } from "../intents/types.js";

export function startIntentReceiverListener(): () => void {
  console.log(`[listener] Watching IntentPaymentReceiver events at ${config.intentReceiverAddress}`);

  const unwatchIntentCreated = publicClient.watchContractEvent({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    eventName: "IntentCreated",
    onError(error) {
      console.error("[listener] IntentCreated watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { buyer, expectedAmount, intentId, productId, referenceId } = log.args;

        if (
          buyer === undefined ||
          expectedAmount === undefined ||
          intentId === undefined ||
          productId === undefined ||
          referenceId === undefined
        ) {
          console.warn("[listener] Ignoring malformed IntentCreated log", log);
          continue;
        }

        const now = new Date().toISOString();
        const existing = intentStore.getIntent(intentId.toString());
        const intent: StoredIntent = {
          attachTxHash: existing?.attachTxHash ?? null,
          buyer,
          createdAt: existing?.createdAt ?? now,
          expiresAt: existing?.expiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          expectedAmount: expectedAmount.toString(),
          intentId: intentId.toString(),
          productId: productId.toString(),
          rawPaymentId: existing?.rawPaymentId ?? null,
          referenceId,
          refundTxHash: existing?.refundTxHash ?? null,
          settleTxHash: existing?.settleTxHash ?? null,
          status: existing?.status ?? "created",
          storeOrderId: existing?.storeOrderId ?? null,
          txHash: existing?.txHash ?? log.transactionHash,
          updatedAt: now
        };

        void intentStore.upsertIntent(intent);
        console.log(`[intent] created intentId=${intent.intentId} buyer=${buyer} productId=${productId.toString()}`);
      }
    },
    pollingInterval: 4_000
  });

  // Deprecated for Unified Balance spend: Gateway delivery does not execute
  // recipient contract code, so RawPaymentReceived must not drive checkout
  // settlement. Keep this listener only for legacy/direct-transfer debugging.
  const unwatchRawPaymentReceived = publicClient.watchContractEvent({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    eventName: "RawPaymentReceived",
    onError(error) {
      console.error("[listener] RawPaymentReceived watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { amount, rawPaymentId, sender } = log.args;

        if (amount === undefined || rawPaymentId === undefined || sender === undefined) {
          console.warn("[listener] Ignoring malformed RawPaymentReceived log", log);
          continue;
        }

        const now = new Date().toISOString();
        const existing = intentStore.getRawPayment(rawPaymentId.toString());
        const rawPayment: StoredRawPayment = {
          amount: amount.toString(),
          attached: existing?.attached ?? false,
          createdAt: existing?.createdAt ?? now,
          matchedIntentId: existing?.matchedIntentId ?? null,
          rawPaymentId: rawPaymentId.toString(),
          sender,
          txHash: existing?.txHash ?? log.transactionHash,
          updatedAt: now
        };

        void intentStore.upsertRawPayment(rawPayment);
        console.log(`[intent] legacy raw payment rawPaymentId=${rawPayment.rawPaymentId} sender=${sender} amount=${amount.toString()}`);
      }
    },
    pollingInterval: 4_000
  });

  const unwatchPaymentAttached = publicClient.watchContractEvent({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    eventName: "PaymentAttached",
    onError(error) {
      console.error("[listener] PaymentAttached watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { amount, buyer, intentId, rawPaymentId } = log.args;

        if (amount === undefined || buyer === undefined || intentId === undefined || rawPaymentId === undefined) {
          console.warn("[listener] Ignoring malformed PaymentAttached log", log);
          continue;
        }

        void intentStore.patchIntent(intentId.toString(), {
          rawPaymentId: rawPaymentId.toString(),
          status: "payment_attached"
        }).catch((error) => console.warn("[listener] Could not patch attached intent", error));
        void intentStore.patchRawPayment(rawPaymentId.toString(), {
          attached: true,
          matchedIntentId: intentId.toString()
        }).catch((error) => console.warn("[listener] Could not patch attached raw payment", error));
        console.log(`[intent] attached intentId=${intentId.toString()} rawPaymentId=${rawPaymentId.toString()} buyer=${buyer}`);
      }
    },
    pollingInterval: 4_000
  });

  const unwatchIntentSettled = publicClient.watchContractEvent({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    eventName: "IntentSettled",
    onError(error) {
      console.error("[listener] IntentSettled watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { buyer, intentId, storeOrderId } = log.args;

        if (buyer === undefined || intentId === undefined || storeOrderId === undefined) {
          console.warn("[listener] Ignoring malformed IntentSettled log", log);
          continue;
        }

        void intentStore.patchIntent(intentId.toString(), {
          settleTxHash: log.transactionHash,
          status: "settled",
          storeOrderId: storeOrderId.toString()
        }).catch((error) => console.warn("[listener] Could not patch settled intent", error));
        console.log(`[intent] settled intentId=${intentId.toString()} storeOrderId=${storeOrderId.toString()} buyer=${buyer}`);
      }
    },
    pollingInterval: 4_000
  });

  const unwatchIntentRefunded = publicClient.watchContractEvent({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    eventName: "IntentRefunded",
    onError(error) {
      console.error("[listener] IntentRefunded watch error", error);
    },
    onLogs(logs) {
      for (const log of logs) {
        const { buyer, intentId } = log.args;

        if (buyer === undefined || intentId === undefined) {
          console.warn("[listener] Ignoring malformed IntentRefunded log", log);
          continue;
        }

        void intentStore.patchIntent(intentId.toString(), {
          refundTxHash: log.transactionHash,
          status: "refunded"
        }).catch((error) => console.warn("[listener] Could not patch refunded intent", error));
        console.log(`[intent] refunded intentId=${intentId.toString()} buyer=${buyer}`);
      }
    },
    pollingInterval: 4_000
  });

  return () => {
    unwatchIntentCreated();
    unwatchRawPaymentReceived();
    unwatchPaymentAttached();
    unwatchIntentSettled();
    unwatchIntentRefunded();
  };
}
