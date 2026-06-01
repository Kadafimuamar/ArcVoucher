"use client";

import { useQuery } from "@tanstack/react-query";
import { getAddress, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherStoreAbi, arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { formatOrderTimestamp, orderStatusFromContract, type ChainOrder } from "@/lib/orders";
import { demoProducts } from "@/lib/products";

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

const orderPaidEvent = parseAbiItem(
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid)"
);
const orderFulfilledEvent = parseAbiItem("event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash)");
const logChunkSize = BigInt(9_999);
const defaultLookbackBlocks = parseEnvBigInt(process.env.NEXT_PUBLIC_ORDER_HISTORY_LOOKBACK_BLOCKS) ?? BigInt(250_000);
const configuredStartBlock = parseEnvBigInt(process.env.NEXT_PUBLIC_ARC_VOUCHER_START_BLOCK);

export function useArcVoucherOrders() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const normalizedAddress = address ? getAddress(address) : undefined;

  const query = useQuery({
    enabled: Boolean(isConnected && normalizedAddress && publicClient),
    queryFn: () => fetchWalletOrders(publicClient as PublicClient, normalizedAddress as Address),
    queryKey: ["arcvoucher-orders", normalizedAddress],
    refetchInterval: 15_000
  });

  return {
    ...query,
    address: normalizedAddress,
    isConnected,
    orders: query.data ?? []
  };
}

export function useArcVoucherOrder(orderId: number) {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const normalizedOrderId = Number.isSafeInteger(orderId) && orderId > 0 ? orderId : 0;

  const query = useQuery({
    enabled: Boolean(normalizedOrderId && publicClient),
    queryFn: () => fetchOrder(publicClient as PublicClient, normalizedOrderId),
    queryKey: ["arcvoucher-order", normalizedOrderId],
    refetchInterval: 15_000
  });

  return {
    ...query,
    order: query.data
  };
}

async function fetchWalletOrders(publicClient: PublicClient, buyer: Address): Promise<ChainOrder[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = getHistoryFromBlock(latestBlock);
  const [paidLogs, fulfilledLogs] = await Promise.all([
    getOrderPaidLogs(publicClient, fromBlock, latestBlock, { buyer }),
    getOrderFulfilledLogs(publicClient, fromBlock, latestBlock)
  ]);
  const paidLogsByOrderId = new Map<string, OrderPaidLog>();

  for (const log of paidLogs) {
    const orderId = log.args.orderId;

    if (orderId !== undefined) {
      paidLogsByOrderId.set(orderId.toString(), log);
    }
  }

  const fulfilledLogsByOrderId = mapFulfilledLogsByOrderId(fulfilledLogs);
  const orders = await Promise.all(
    [...paidLogsByOrderId.keys()].map((orderId) =>
      fetchOrder(publicClient, Number(orderId), paidLogsByOrderId.get(orderId), fulfilledLogsByOrderId.get(orderId))
    )
  );

  return orders
    .filter((order): order is ChainOrder => {
      if (!order) {
        return false;
      }

      return getAddress(order.buyer) === getAddress(buyer);
    })
    .sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
}

async function fetchOrder(
  publicClient: PublicClient,
  orderId: number,
  knownPaidLog?: OrderPaidLog,
  knownFulfilledLog?: OrderFulfilledLog
): Promise<ChainOrder | undefined> {
  const order = (await publicClient.readContract({
    address: arcVoucherStoreAddress,
    abi: arcVoucherStoreAbi,
    functionName: "orders",
    args: [BigInt(orderId)]
  })) as OrderTuple;
  const [id, buyer, productId, amountPaid, status, voucherHash, createdAt] = order;

  if (id === BigInt(0)) {
    return undefined;
  }

  const latestBlock = knownPaidLog && knownFulfilledLog ? undefined : await publicClient.getBlockNumber();
  const fromBlock = latestBlock ? getHistoryFromBlock(latestBlock) : undefined;
  const [paidLog, fulfilledLog] = await Promise.all([
    knownPaidLog ??
      (latestBlock && fromBlock !== undefined
        ? getFirstOrderPaidLog(publicClient, BigInt(orderId), fromBlock, latestBlock)
        : Promise.resolve(undefined)),
    knownFulfilledLog ??
      (latestBlock && fromBlock !== undefined
        ? getFirstOrderFulfilledLog(publicClient, BigInt(orderId), fromBlock, latestBlock)
        : Promise.resolve(undefined))
  ]);
  const productName = await getProductName(publicClient, productId);
  const createdAtTimestamp = Number(createdAt);

  return {
    amountPaid,
    buyer,
    createdAt: formatOrderTimestamp(createdAt),
    createdAtTimestamp,
    fulfilledTxHash: fulfilledLog?.transactionHash ?? null,
    id: Number(id),
    productId: Number(productId),
    productName,
    status: orderStatusFromContract(Number(status)),
    txHash: paidLog?.transactionHash ?? null,
    voucherHash
  };
}

async function getProductName(publicClient: PublicClient, productId: bigint) {
  const fallbackProduct = demoProducts.find((product) => product.id === Number(productId));

  try {
    const product = (await publicClient.readContract({
      address: arcVoucherStoreAddress,
      abi: arcVoucherStoreAbi,
      functionName: "products",
      args: [productId]
    })) as ProductTuple;

    return product[0] === BigInt(0) ? fallbackProduct?.name ?? `Product #${productId.toString()}` : product[2];
  } catch {
    return fallbackProduct?.name ?? `Product #${productId.toString()}`;
  }
}

async function getFirstOrderPaidLog(publicClient: PublicClient, orderId: bigint, fromBlock: bigint, toBlock: bigint) {
  const logs = await getOrderPaidLogs(publicClient, fromBlock, toBlock, { orderId });
  return logs[0];
}

async function getFirstOrderFulfilledLog(publicClient: PublicClient, orderId: bigint, fromBlock: bigint, toBlock: bigint) {
  const logs = await getOrderFulfilledLogs(publicClient, fromBlock, toBlock, orderId);
  return logs[0];
}

async function getOrderPaidLogs(
  publicClient: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  args: { buyer?: Address; orderId?: bigint }
) {
  const logs: OrderPaidLog[] = [];

  await forEachLogChunk(fromBlock, toBlock, async (chunkStart, chunkEnd) => {
    const chunkLogs = await publicClient.getLogs({
      address: arcVoucherStoreAddress,
      args,
      event: orderPaidEvent,
      fromBlock: chunkStart,
      toBlock: chunkEnd
    });

    logs.push(...(chunkLogs as OrderPaidLog[]));
  });

  return logs;
}

async function getOrderFulfilledLogs(publicClient: PublicClient, fromBlock: bigint, toBlock: bigint, orderId?: bigint) {
  const logs: OrderFulfilledLog[] = [];

  await forEachLogChunk(fromBlock, toBlock, async (chunkStart, chunkEnd) => {
    const chunkLogs = await publicClient.getLogs({
      address: arcVoucherStoreAddress,
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
