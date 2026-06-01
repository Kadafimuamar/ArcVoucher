import { getAddress, isAddress, type Address, type Hex } from "viem";
import { account, config, publicClient, walletClient } from "../clients/viem.js";
import { arcVoucherIntentPaymentReceiverAbi } from "../contracts/arcVoucherIntentPaymentReceiver.js";
import { intentStore } from "../intents/intentStore.js";
import type { StoredIntent, StoredIntentStatus, StoredRawPayment } from "../intents/types.js";
import { fulfillVerifiedIntent, getIntentVoucherId } from "./fulfillment.js";
import { voucherStore } from "../vouchers/voucherStore.js";

const intentExpirationMs = 15 * 60 * 1000;
const erc20TransferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const zeroAddressTopic = `0x${"0".repeat(64)}`;

export type CreateIntentInput = {
  buyer: string;
  expectedAmount: string | number | bigint;
  productId: string | number | bigint;
  referenceId: string;
};

export type ConfirmSpendInput = {
  buyer: string;
  expectedAmount: string | number | bigint;
  recipient: string;
  spendTxHash: string;
};

export async function createIntent(input: CreateIntentInput): Promise<StoredIntent> {
  const buyer = normalizeAddress(input.buyer);
  const productId = normalizePositiveBigInt(input.productId, "productId");
  const expectedAmount = normalizePositiveBigInt(input.expectedAmount, "expectedAmount");
  const referenceId = normalizeBytes32(input.referenceId);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + intentExpirationMs).toISOString();

  const existingIntent = intentStore.getIntentByReference(referenceId);
  if (existingIntent) {
    return existingIntent;
  }

  const txHash = await walletClient.writeContract({
    account,
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "createIntent",
    args: [buyer, productId, expectedAmount, referenceId]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const intentId = await publicClient.readContract({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "findIntentByReferenceId",
    args: [referenceId]
  });

  if (intentId === BigInt(0)) {
    throw new Error("Intent was not found after createIntent transaction");
  }

  const intent: StoredIntent = {
    buyer,
    createdAt: now,
    expiresAt,
    expectedAmount: expectedAmount.toString(),
    intentId: intentId.toString(),
    paidAt: null,
    productId: productId.toString(),
    rawPaymentId: null,
    referenceId,
    spendAmount: null,
    spendConfirmedAt: null,
    spendRecipient: null,
    spendTxHash: null,
    status: "created",
    storeOrderId: null,
    txHash,
    updatedAt: now,
    verificationMethod: null,
    voucherId: null
  };

  await intentStore.upsertIntent(intent);
  return intent;
}

export async function processRawPaymentForMatching(rawPayment: StoredRawPayment): Promise<void> {
  console.log(
    `[intent] raw payment auto-matching is deprecated for Unified Balance spend; ignoring rawPaymentId=${rawPayment.rawPaymentId}`
  );
}

export async function confirmSpendForIntent(intentId: string | number | bigint, input: ConfirmSpendInput) {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId").toString();
  const buyer = normalizeAddress(input.buyer);
  const recipient = normalizeAddress(input.recipient);
  const expectedAmount = normalizePositiveBigInt(input.expectedAmount, "expectedAmount");
  const spendTxHash = normalizeHash(input.spendTxHash);
  const intent = intentStore.getIntent(normalizedIntentId);

  if (!intent) {
    throw new Error(`Intent ${normalizedIntentId} not found`);
  }

  if (intent.buyer.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error("buyer does not match intent buyer");
  }

  if (BigInt(intent.expectedAmount) !== expectedAmount) {
    throw new Error("expectedAmount does not match intent amount");
  }

  if (recipient.toLowerCase() !== config.intentReceiverAddress.toLowerCase()) {
    throw new Error("recipient does not match configured ArcVoucher settlement address");
  }

  const reusedIntent = intentStore.getIntentBySpendTxHash(spendTxHash);
  if (reusedIntent && reusedIntent.intentId !== intent.intentId) {
    throw new Error(`spendTxHash was already used by intent ${reusedIntent.intentId}`);
  }

  if (new Date(intent.expiresAt).getTime() <= Date.now() && intent.status === "created") {
    throw new Error("intent is expired");
  }

  if (intent.status === "voucher_fulfilled") {
    const voucherId = getIntentVoucherId(intent.intentId);
    const voucher = voucherStore.get(voucherId) ?? (await fulfillVerifiedIntent(intent));
    if (intent.voucherId !== voucherId) {
      await intentStore.patchIntent(intent.intentId, { voucherId });
    }

    return {
      intent,
      voucher
    };
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: spendTxHash });
  if (receipt.status !== "success") {
    throw new Error("spend transaction receipt is not successful");
  }

  const transaction = await publicClient.getTransaction({ hash: spendTxHash });
  if (transaction.from.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error("spend transaction sender does not match intent buyer");
  }

  if (transaction.to?.toLowerCase() !== config.gatewayAddress.toLowerCase()) {
    throw new Error("spend transaction was not sent to the Arc Gateway contract");
  }

  const creditedAmount = sumNativeUsdcMintedToRecipient(receipt.logs, recipient);
  if (creditedAmount !== expectedAmount) {
    throw new Error(`credited amount mismatch: expected ${expectedAmount.toString()}, got ${creditedAmount.toString()}`);
  }

  const spendConfirmedAt = new Date().toISOString();
  const paidIntent = await intentStore.patchIntent(intent.intentId, {
    paidAt: spendConfirmedAt,
    spendAmount: creditedAmount.toString(),
    spendConfirmedAt,
    spendRecipient: recipient,
    spendTxHash,
    status: "paid",
    verificationMethod: "arc_receipt_native_usdc_transfer"
  });
  const voucher = await fulfillVerifiedIntent(paidIntent);
  const fulfilledIntent = await intentStore.patchIntent(intent.intentId, {
    status: "voucher_fulfilled",
    voucherId: voucher.orderId
  });

  return {
    intent: fulfilledIntent,
    voucher
  };
}

export async function repairIntentVoucher(intentId: string | number | bigint) {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId").toString();
  const intent = intentStore.getIntent(normalizedIntentId);

  if (!intent) {
    throw new Error(`Intent ${normalizedIntentId} not found`);
  }

  const voucherId = getIntentVoucherId(intent.intentId);
  const existing = voucherStore.get(voucherId);
  if (existing?.status === "fulfilled") {
    console.log(
      `[repair] Unified Balance voucher already present orderId=${voucherId} buyer=${existing.buyer} productId=${existing.productId}`
    );
    return {
      intent,
      voucher: existing
    };
  }

  if (!isRepairableIntentStatus(intent.status)) {
    throw new Error(`Intent ${intent.intentId} is not paid or fulfilled`);
  }

  if (!intent.spendTxHash && intent.status !== "voucher_fulfilled") {
    throw new Error(`Intent ${intent.intentId} has no verified spendTxHash`);
  }

  console.log(
    `[repair] backfilling Unified Balance voucher orderId=${voucherId} buyer=${intent.buyer} productId=${intent.productId} status=${intent.status}`
  );
  const voucher = await fulfillVerifiedIntent(intent);
  const updatedIntent = await intentStore.patchIntent(intent.intentId, {
    status: "voucher_fulfilled",
    voucherId
  });

  return {
    intent: updatedIntent,
    voucher
  };
}

export async function attachPayment(intentId: string | number | bigint, rawPaymentId: string | number | bigint): Promise<StoredIntent> {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId");
  const normalizedRawPaymentId = normalizePositiveBigInt(rawPaymentId, "rawPaymentId");

  const txHash = await walletClient.writeContract({
    account,
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "attachPayment",
    args: [normalizedIntentId, normalizedRawPaymentId]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const intent = await syncIntentFromChain(normalizedIntentId);
  await intentStore.patchRawPayment(normalizedRawPaymentId.toString(), {
    attached: true
  }).catch(() => undefined);

  return intentStore.patchIntent(intent.intentId, {
    attachTxHash: txHash
  });
}

export async function settleIntent(intentId: string | number | bigint): Promise<StoredIntent> {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId");

  const txHash = await walletClient.writeContract({
    account,
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "settleIntent",
    args: [normalizedIntentId]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const intent = await syncIntentFromChain(normalizedIntentId);
  return intentStore.patchIntent(intent.intentId, {
    settleTxHash: txHash
  });
}

export async function refundIntent(intentId: string | number | bigint): Promise<StoredIntent> {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId");

  const txHash = await walletClient.writeContract({
    account,
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "refundIntent",
    args: [normalizedIntentId]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const intent = await syncIntentFromChain(normalizedIntentId);
  return intentStore.patchIntent(intent.intentId, {
    refundTxHash: txHash
  });
}

export async function syncIntentFromChain(intentId: bigint): Promise<StoredIntent> {
  const intent = await publicClient.readContract({
    address: config.intentReceiverAddress,
    abi: arcVoucherIntentPaymentReceiverAbi,
    functionName: "getIntent",
    args: [intentId]
  });
  const now = new Date().toISOString();
  const existing = intentStore.getIntent(intent.id.toString());
  const localOnlyStatus = existing?.status === "paid" || existing?.status === "voucher_fulfilled" || existing?.status === "failed";
  const storedIntent: StoredIntent = {
    attachTxHash: existing?.attachTxHash ?? null,
    buyer: intent.buyer,
    createdAt: existing?.createdAt ?? now,
    error: existing?.error ?? null,
    expiresAt: existing?.expiresAt ?? new Date(Date.now() + intentExpirationMs).toISOString(),
    expectedAmount: intent.expectedAmount.toString(),
    intentId: intent.id.toString(),
    paidAt: existing?.paidAt ?? null,
    productId: intent.productId.toString(),
    rawPaymentId: intent.rawPaymentId === BigInt(0) ? null : intent.rawPaymentId.toString(),
    referenceId: intent.referenceId,
    refundTxHash: existing?.refundTxHash ?? null,
    settleTxHash: existing?.settleTxHash ?? null,
    spendAmount: existing?.spendAmount ?? null,
    spendConfirmedAt: existing?.spendConfirmedAt ?? null,
    spendRecipient: existing?.spendRecipient ?? null,
    spendTxHash: existing?.spendTxHash ?? null,
    status: localOnlyStatus ? existing.status : statusFromContract(Number(intent.status)),
    storeOrderId: existing?.storeOrderId ?? null,
    txHash: existing?.txHash ?? null,
    updatedAt: now,
    verificationMethod: existing?.verificationMethod ?? null,
    voucherId: existing?.voucherId ?? null
  };

  await intentStore.upsertIntent(storedIntent);
  return storedIntent;
}

export function statusFromContract(status: number): StoredIntentStatus {
  const statuses: StoredIntentStatus[] = ["created", "payment_attached", "settled", "refunded", "cancelled"];
  return statuses[status] ?? "created";
}

export function normalizeAddress(value: string): Address {
  if (!isAddress(value)) {
    throw new Error("buyer must be a valid EVM address");
  }

  return getAddress(value);
}

export function normalizeBytes32(value: string): Hex {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("referenceId must be a bytes32 hex string");
  }

  return value.toLowerCase() as Hex;
}

export function normalizeHash(value: string): Hex {
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("spendTxHash must be a 32-byte hex string");
  }

  return value.toLowerCase() as Hex;
}

export function normalizePositiveBigInt(value: string | number | bigint, fieldName: string): bigint {
  try {
    const parsed = BigInt(value);

    if (parsed <= BigInt(0)) {
      throw new Error();
    }

    return parsed;
  } catch {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function isRepairableIntentStatus(status: StoredIntentStatus) {
  return status === "paid" || status === "voucher_fulfilled";
}

function sumNativeUsdcMintedToRecipient(
  logs: readonly {
    address: Address;
    data: Hex;
    topics: readonly Hex[];
  }[],
  recipient: Address
): bigint {
  const recipientTopic = addressToTopic(recipient);

  return logs.reduce((sum, log) => {
    if (log.address.toLowerCase() !== config.nativeUsdcAddress.toLowerCase()) {
      return sum;
    }

    if (log.topics[0]?.toLowerCase() !== erc20TransferTopic || log.topics[1]?.toLowerCase() !== zeroAddressTopic) {
      return sum;
    }

    if (log.topics[2]?.toLowerCase() !== recipientTopic) {
      return sum;
    }

    return sum + BigInt(log.data);
  }, BigInt(0));
}

function addressToTopic(address: Address): Hex {
  return `0x${address.toLowerCase().slice(2).padStart(64, "0")}` as Hex;
}
