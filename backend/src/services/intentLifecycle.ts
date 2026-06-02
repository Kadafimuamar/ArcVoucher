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

export type RetryConfirmSpendInput = {
  spendTxHash: string;
};

type DecodedTransferLog = {
  amount: string;
  from: Address | null;
  isNativeUsdc: boolean;
  isRecipientCredit: boolean;
  isZeroAddressMint: boolean;
  logIndex: number | null;
  to: Address | null;
};

type SpendVerificationDetails = {
  creditedAmount: string;
  decodedTransferLogs: DecodedTransferLog[];
  receiptStatus: string | null;
  txFrom: Address | null;
  txTo: Address | null;
  warnings: string[];
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

  return verifySpendAndFulfillIntent({
    buyer,
    expectedAmount,
    intentId: normalizedIntentId,
    recipient,
    source: "confirm-spend",
    spendTxHash
  });
}

export async function retryConfirmSpendForIntent(intentId: string | number | bigint, input: RetryConfirmSpendInput) {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId").toString();
  const spendTxHash = normalizeHash(input.spendTxHash);
  const intent = intentStore.getIntent(normalizedIntentId);

  if (!intent) {
    throw new Error(`Intent ${normalizedIntentId} not found`);
  }

  return verifySpendAndFulfillIntent({
    buyer: intent.buyer,
    expectedAmount: BigInt(intent.expectedAmount),
    intentId: normalizedIntentId,
    recipient: config.intentReceiverAddress,
    source: "retry-confirm-spend",
    spendTxHash
  });
}

export async function getIntentSpendDebug(intentId: string | number | bigint) {
  const normalizedIntentId = normalizePositiveBigInt(intentId, "intentId").toString();
  const intent = intentStore.getIntent(normalizedIntentId);

  if (!intent) {
    throw new Error(`Intent ${normalizedIntentId} not found`);
  }

  const spendTxHash = intent.spendTxHash ?? null;
  const verificationErrors: string[] = [];
  let verificationDetails: SpendVerificationDetails | null = null;

  if (!spendTxHash) {
    verificationErrors.push("spendTxHash is missing");
  } else {
    try {
      verificationDetails = await inspectSpendTransaction({
        expectedAmount: BigInt(intent.expectedAmount),
        expectedBuyer: intent.buyer,
        recipient: config.intentReceiverAddress,
        spendTxHash
      });

      if (verificationDetails.receiptStatus !== "success") {
        verificationErrors.push("spend transaction receipt is not successful");
      }
      if (verificationDetails.txTo?.toLowerCase() !== config.gatewayAddress.toLowerCase()) {
        verificationErrors.push("spend transaction was not sent to the Arc Gateway contract");
      }
      if (verificationDetails.creditedAmount !== intent.expectedAmount) {
        verificationErrors.push(`credited amount mismatch: expected ${intent.expectedAmount}, got ${verificationDetails.creditedAmount}`);
      }
    } catch (error) {
      verificationErrors.push(getErrorMessage(error));
    }
  }

  const voucher = voucherStore.get(getIntentVoucherId(intent.intentId));

  return {
    buyer: intent.buyer,
    expectedAmount: intent.expectedAmount,
    gatewayExpected: config.gatewayAddress,
    intentStatus: intent.status,
    lastConfirmationError: intent.lastConfirmationError ?? intent.error ?? null,
    recipientExpected: config.intentReceiverAddress,
    spendTxHash,
    spendTxHashStored: Boolean(spendTxHash),
    verificationDetails,
    verificationErrors,
    voucherStatus: voucher?.status ?? null
  };
}

async function verifySpendAndFulfillIntent({
  buyer,
  expectedAmount,
  intentId,
  recipient,
  source,
  spendTxHash
}: {
  buyer: Address;
  expectedAmount: bigint;
  intentId: string;
  recipient: Address;
  source: "confirm-spend" | "retry-confirm-spend";
  spendTxHash: Hex;
}) {
  const intent = intentStore.getIntent(intentId);

  if (!intent) {
    throw new Error(`Intent ${intentId} not found`);
  }

  const attemptAt = new Date().toISOString();

  try {
    console.log(`[intent] ${source} start`, {
      expectedAmount: expectedAmount.toString(),
      expectedBuyer: intent.buyer,
      expectedGateway: config.gatewayAddress,
      expectedRecipient: config.intentReceiverAddress,
      intentId,
      requestBuyer: buyer,
      requestRecipient: recipient,
      spendTxHash
    });

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

    await intentStore.patchIntent(intent.intentId, {
      lastConfirmationAttemptAt: attemptAt,
      lastConfirmationError: null,
      spendRecipient: recipient,
      spendTxHash
    });

    const verification = await inspectSpendTransaction({
      expectedAmount,
      expectedBuyer: intent.buyer,
      recipient,
      spendTxHash
    });

    console.log(`[intent] ${source} verification`, {
      decodedTransferLogs: verification.decodedTransferLogs,
      expectedAmount: expectedAmount.toString(),
      expectedBuyer: intent.buyer,
      expectedGateway: config.gatewayAddress,
      expectedRecipient: recipient,
      intentExpired: new Date(intent.expiresAt).getTime() <= Date.now(),
      intentId,
      receiptStatus: verification.receiptStatus,
      spendTxHash,
      txFrom: verification.txFrom,
      txTo: verification.txTo,
      warnings: verification.warnings
    });

  if (verification.receiptStatus !== "success") {
    throw new Error("spend transaction receipt is not successful");
  }

  if (verification.txTo?.toLowerCase() !== config.gatewayAddress.toLowerCase()) {
    throw new Error("spend transaction was not sent to the Arc Gateway contract");
  }

  const creditedAmount = BigInt(verification.creditedAmount);
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
    verificationMethod: "arc_receipt_native_usdc_transfer",
    error: null,
    lastConfirmationAttemptAt: attemptAt,
    lastConfirmationError: null
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
  } catch (error) {
    const message = getErrorMessage(error);
    console.error(`[intent] ${source} rejected`, {
      expectedAmount: expectedAmount.toString(),
      expectedBuyer: intent.buyer,
      expectedGateway: config.gatewayAddress,
      expectedRecipient: recipient,
      intentId,
      reason: message,
      spendTxHash
    });

    await intentStore.patchIntent(intent.intentId, {
      error: message,
      lastConfirmationAttemptAt: attemptAt,
      lastConfirmationError: message,
      spendRecipient: recipient,
      spendTxHash
    }).catch((patchError) => {
      console.error(`[intent] could not persist confirmation failure intentId=${intent.intentId}`, patchError);
      return intent;
    });

    throw error;
  }
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
    lastConfirmationAttemptAt: existing?.lastConfirmationAttemptAt ?? null,
    lastConfirmationError: existing?.lastConfirmationError ?? null,
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

async function inspectSpendTransaction({
  expectedBuyer,
  recipient,
  spendTxHash
}: {
  expectedAmount: bigint;
  expectedBuyer: Address;
  recipient: Address;
  spendTxHash: Hex;
}): Promise<SpendVerificationDetails> {
  const [receipt, transaction] = await Promise.all([
    publicClient.getTransactionReceipt({ hash: spendTxHash }),
    publicClient.getTransaction({ hash: spendTxHash })
  ]);
  const decodedTransferLogs = decodeTransferLogs(receipt.logs, recipient);
  const creditedAmount = decodedTransferLogs.reduce((sum, log) => {
    return log.isNativeUsdc && log.isZeroAddressMint && log.isRecipientCredit ? sum + BigInt(log.amount) : sum;
  }, BigInt(0));
  const warnings: string[] = [];

  if (transaction.from.toLowerCase() !== expectedBuyer.toLowerCase()) {
    warnings.push(`tx.from ${transaction.from} differs from intent buyer ${expectedBuyer}; accepting Gateway proof instead`);
  }

  return {
    creditedAmount: creditedAmount.toString(),
    decodedTransferLogs,
    receiptStatus: receipt.status,
    txFrom: transaction.from,
    txTo: transaction.to,
    warnings
  };
}

function decodeTransferLogs(
  logs: readonly {
    address: Address;
    data: Hex;
    logIndex?: number;
    topics: readonly Hex[];
  }[],
  recipient: Address
): DecodedTransferLog[] {
  const recipientTopic = addressToTopic(recipient);

  return logs
    .filter((log) => log.topics[0]?.toLowerCase() === erc20TransferTopic)
    .map((log) => ({
      amount: BigInt(log.data).toString(),
      from: topicToAddress(log.topics[1]),
      isNativeUsdc: log.address.toLowerCase() === config.nativeUsdcAddress.toLowerCase(),
      isRecipientCredit: log.topics[2]?.toLowerCase() === recipientTopic,
      isZeroAddressMint: log.topics[1]?.toLowerCase() === zeroAddressTopic,
      logIndex: typeof log.logIndex === "number" ? log.logIndex : null,
      to: topicToAddress(log.topics[2])
    }));
}

function addressToTopic(address: Address): Hex {
  return `0x${address.toLowerCase().slice(2).padStart(64, "0")}` as Hex;
}

function topicToAddress(topic: Hex | undefined): Address | null {
  if (!topic || !/^0x[a-fA-F0-9]{64}$/.test(topic)) {
    return null;
  }

  return `0x${topic.slice(-40)}` as Address;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
