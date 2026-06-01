import { parseAbiItem, type Address, type Hex } from "viem";
import { config, publicClient } from "../clients/viem.js";
import { arcVoucherStoreAbi } from "../contracts/arcVoucherStore.js";
import { intentStore } from "../intents/intentStore.js";
import { getIntentVoucherId } from "./fulfillment.js";
import { voucherStore } from "../vouchers/voucherStore.js";

type OrderTuple = readonly [
  id: bigint,
  buyer: Address,
  productId: bigint,
  amountPaid: bigint,
  status: number,
  voucherHash: Hex,
  createdAt: bigint
];

type ProductTuple = readonly [
  id: bigint,
  brand: string,
  name: string,
  price: bigint,
  totalStock: bigint,
  soldStock: bigint,
  active: boolean
];

type OrderPaidLog = {
  args: {
    amountPaid?: bigint;
    buyer?: Address;
    orderId?: bigint;
    productId?: bigint;
  };
  blockNumber: bigint;
  transactionHash: Hex;
};

type OrderFulfilledLog = {
  args: {
    orderId?: bigint;
    voucherHash?: Hex;
  };
  blockNumber: bigint;
  transactionHash: Hex;
};

export type UnifiedOrderHistoryItem = {
  amount: string;
  createdAt: string;
  orderId: string;
  productId: string;
  productName: string;
  source: "direct" | "unified-balance";
  status: "paid" | "fulfilled" | "refunded" | "failed" | "cancelled";
  txHash: Hex | null;
  voucherReady?: boolean;
};

const orderPaidEvent = parseAbiItem(
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid)"
);
const orderFulfilledEvent = parseAbiItem("event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash)");
const orderStatusLabels: UnifiedOrderHistoryItem["status"][] = ["paid", "fulfilled", "refunded"];
const logChunkSize = BigInt(9_999);
const defaultLookbackBlocks = parseEnvBigInt(process.env.ORDER_HISTORY_LOOKBACK_BLOCKS) ?? BigInt(250_000);
const configuredStartBlock = parseEnvBigInt(process.env.ARC_VOUCHER_START_BLOCK);
const productNameFallbacks: Record<string, string> = {
  "1": "Steam Gift Card $10",
  "2": "Epic Games Gift Card $10",
  "3": "Amazon Gift Card $25",
  "4": "Google Play Gift Card $10",
  "5": "Apple Gift Card $15",
  "6": "Netflix Gift Card $15",
  "7": "Spotify Gift Card $10"
};

export async function getUnifiedOrderHistory(buyer: Address): Promise<UnifiedOrderHistoryItem[]> {
  const [directOrders, unifiedBalanceOrders] = await Promise.all([getDirectOrders(buyer), getUnifiedBalanceOrders(buyer)]);

  return [...directOrders, ...unifiedBalanceOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function getDirectOrders(buyer: Address): Promise<UnifiedOrderHistoryItem[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = getHistoryFromBlock(latestBlock);
  const [paidLogs, fulfilledLogs] = await Promise.all([
    getOrderPaidLogs(fromBlock, latestBlock, { buyer }),
    getOrderFulfilledLogs(fromBlock, latestBlock)
  ]);
  const fulfilledLogsByOrderId = mapFulfilledLogsByOrderId(fulfilledLogs);
  const orders = await Promise.all(
    paidLogs.map((log) => {
      const orderId = log.args.orderId;
      return orderId === undefined ? Promise.resolve(undefined) : getDirectOrder(orderId, log, fulfilledLogsByOrderId.get(orderId.toString()));
    })
  );

  return orders.filter((order): order is UnifiedOrderHistoryItem => Boolean(order));
}

async function getDirectOrder(
  orderId: bigint,
  paidLog: OrderPaidLog,
  fulfilledLog?: OrderFulfilledLog
): Promise<UnifiedOrderHistoryItem | undefined> {
  const order = (await publicClient.readContract({
    address: config.contractAddress,
    abi: arcVoucherStoreAbi,
    functionName: "orders",
    args: [orderId]
  })) as OrderTuple;
  const [id, , productId, amountPaid, status, , createdAt] = order;

  if (id === BigInt(0)) {
    return undefined;
  }

  return {
    amount: amountPaid.toString(),
    createdAt: new Date(Number(createdAt) * 1000).toISOString(),
    orderId: id.toString(),
    productId: productId.toString(),
    productName: await getProductName(productId),
    source: "direct",
    status: orderStatusLabels[status] ?? "paid",
    txHash: paidLog.transactionHash ?? null,
    voucherReady: Boolean(fulfilledLog)
  };
}

async function getUnifiedBalanceOrders(buyer: Address): Promise<UnifiedOrderHistoryItem[]> {
  const intents = intentStore.listIntentsByBuyer(buyer);

  return Promise.all(
    intents
      .filter((intent) => intent.status !== "created")
      .map(async (intent): Promise<UnifiedOrderHistoryItem> => {
        const voucherId = getIntentVoucherId(intent.intentId);
        const voucher = voucherStore.get(voucherId);
        const status = getUnifiedBalanceOrderStatus(intent.status, voucher?.status);

        return {
          amount: intent.spendAmount ?? intent.expectedAmount,
          createdAt: intent.spendConfirmedAt ?? intent.updatedAt ?? intent.createdAt,
          orderId: voucherId,
          productId: intent.productId,
          productName: await getProductName(BigInt(intent.productId)),
          source: "unified-balance",
          status,
          txHash: intent.spendTxHash ?? voucher?.txHash ?? null,
          voucherReady: voucher?.status === "fulfilled"
        };
      })
  );
}

function getUnifiedBalanceOrderStatus(
  intentStatus: string,
  voucherStatus: string | undefined
): UnifiedOrderHistoryItem["status"] {
  if (voucherStatus === "fulfilled" || intentStatus === "voucher_fulfilled") {
    return "fulfilled";
  }
  if (intentStatus === "failed" || voucherStatus === "failed") {
    return "failed";
  }
  if (intentStatus === "refunded") {
    return "refunded";
  }
  if (intentStatus === "cancelled") {
    return "cancelled";
  }

  return "paid";
}

async function getProductName(productId: bigint) {
  try {
    const product = (await publicClient.readContract({
      address: config.contractAddress,
      abi: arcVoucherStoreAbi,
      functionName: "products",
      args: [productId]
    })) as ProductTuple;

    return product[0] === BigInt(0) ? productNameFallbacks[productId.toString()] ?? `Product #${productId.toString()}` : product[2];
  } catch {
    return productNameFallbacks[productId.toString()] ?? `Product #${productId.toString()}`;
  }
}

async function getOrderPaidLogs(fromBlock: bigint, toBlock: bigint, args: { buyer?: Address; orderId?: bigint }) {
  const logs: OrderPaidLog[] = [];

  await forEachLogChunk(fromBlock, toBlock, async (chunkStart, chunkEnd) => {
    const chunkLogs = await publicClient.getLogs({
      address: config.contractAddress,
      args,
      event: orderPaidEvent,
      fromBlock: chunkStart,
      toBlock: chunkEnd
    });

    logs.push(...(chunkLogs as OrderPaidLog[]));
  });

  return logs;
}

async function getOrderFulfilledLogs(fromBlock: bigint, toBlock: bigint, orderId?: bigint) {
  const logs: OrderFulfilledLog[] = [];

  await forEachLogChunk(fromBlock, toBlock, async (chunkStart, chunkEnd) => {
    const chunkLogs = await publicClient.getLogs({
      address: config.contractAddress,
      args: orderId === undefined ? undefined : { orderId },
      event: orderFulfilledEvent,
      fromBlock: chunkStart,
      toBlock: chunkEnd
    });

    logs.push(...(chunkLogs as OrderFulfilledLog[]));
  });

  return logs;
}

async function forEachLogChunk(fromBlock: bigint, toBlock: bigint, readChunk: (fromBlock: bigint, toBlock: bigint) => Promise<void>) {
  for (let chunkStart = fromBlock; chunkStart <= toBlock; chunkStart += logChunkSize + BigInt(1)) {
    const chunkEnd = chunkStart + logChunkSize > toBlock ? toBlock : chunkStart + logChunkSize;
    await readChunk(chunkStart, chunkEnd);
  }
}

function mapFulfilledLogsByOrderId(logs: OrderFulfilledLog[]) {
  const logsByOrderId = new Map<string, OrderFulfilledLog>();

  for (const log of logs) {
    const orderId = log.args.orderId;

    if (orderId !== undefined) {
      logsByOrderId.set(orderId.toString(), log);
    }
  }

  return logsByOrderId;
}

function getHistoryFromBlock(latestBlock: bigint) {
  if (configuredStartBlock !== undefined) {
    return configuredStartBlock;
  }

  return latestBlock > defaultLookbackBlocks ? latestBlock - defaultLookbackBlocks : BigInt(0);
}

function parseEnvBigInt(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}
