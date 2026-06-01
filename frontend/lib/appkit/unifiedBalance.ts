"use client";

import { encodeAbiParameters, formatEther, keccak256, parseAbiParameters, toHex } from "viem";
import type { Address, Hex } from "viem";
import type { UnifiedBalanceChainIdentifier } from "@circle-fin/app-kit";
import { createBrowserViemAdapter, getArcAppKit } from "@/lib/appkit/client";
import type {
  SupportedChainDefinition,
  UnifiedBalanceAllocation,
  UnifiedBalanceCheckoutStage,
  UnifiedBalanceChainBalance,
  UnifiedBalanceFeeEntry,
  UnifiedBalanceChainOption,
  UnifiedBalanceFeeEstimate,
  UnifiedBalanceSpendEvidence,
  UnifiedBalanceSpendPreparation,
  UnifiedBalanceSnapshot
} from "@/lib/appkit/types";

const usdcDecimalPlaces = 6;
const usdcUnit = BigInt(10) ** BigInt(usdcDecimalPlaces);

export function getUnifiedBalanceSourceChains(): UnifiedBalanceChainOption[] {
  const chains = getArcAppKit().unifiedBalance.getSupportedChains("USDC", {
    forwarderSupported: "source"
  }) as SupportedChainDefinition[];

  return chains
    .filter((chain) => chain.isTestnet && chain.type === "evm")
    .map((chain) => ({
      chain,
      evmChainId: chain.chainId,
      explorerUrl: chain.explorerUrl,
      id: chain.chain,
      isEvm: chain.type === "evm",
      isTestnet: Boolean(chain.isTestnet),
      name: chain.name,
      nativeCurrency: chain.nativeCurrency,
      rpcEndpoints: chain.rpcEndpoints,
      title: chain.title ?? chain.name,
      usdcAddress: chain.usdcAddress
    }));
}

export async function checkUnifiedBalance({
  address,
  chains
}: {
  address: Address;
  chains: UnifiedBalanceChainIdentifier[];
}): Promise<UnifiedBalanceSnapshot> {
  const result = await getArcAppKit().unifiedBalance.getBalances({
    includePending: true,
    networkType: "testnet",
    sources: {
      address,
      chains: chains.length > 0 ? chains : undefined
    },
    token: "USDC"
  });

  return {
    breakdown: result.breakdown.flatMap((account) =>
      account.breakdown.map(
        (chainBalance): UnifiedBalanceChainBalance => ({
          chain: String(chainBalance.chain),
          confirmedBalance: chainBalance.confirmedBalance,
          pendingBalance: chainBalance.pendingBalance,
          pendingTransactions: chainBalance.pendingTransactions?.map((transaction) => ({
            amount: transaction.amount,
            blockTimestamp: transaction.blockTimestamp,
            transactionHash: transaction.transactionHash
          }))
        })
      )
    ),
    raw: result,
    totalConfirmedBalance: result.totalConfirmedBalance,
    totalPendingBalance: result.totalPendingBalance
  };
}

export async function estimateUnifiedBalanceSpend({
  allocations,
  amount,
  recipientAddress
}: {
  allocations: UnifiedBalanceAllocation[];
  amount: string;
  recipientAddress: Address;
}): Promise<UnifiedBalanceFeeEstimate> {
  const adapter = await createBrowserViemAdapter();
  const result = await getArcAppKit().unifiedBalance.estimateSpend({
    amount,
    from: {
      adapter,
      allocations: allocations.map((allocation) => ({
        amount: allocation.amount,
        chain: allocation.chain
      }))
    },
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress
    },
    token: "USDC"
  });

  return {
    fees: result.fees,
    raw: result,
    totalFees: sumFees(result.fees)
  };
}

export async function executeUnifiedBalanceSpend({
  allocations,
  amount,
  recipientAddress
}: {
  allocations: UnifiedBalanceAllocation[];
  amount: string;
  recipientAddress: Address;
}): Promise<UnifiedBalanceSpendEvidence> {
  const adapter = await createBrowserViemAdapter();
  const result = await getArcAppKit().unifiedBalance.spend({
    amount,
    from: {
      adapter,
      allocations: allocations.map((allocation) => ({
        amount: allocation.amount,
        chain: allocation.chain
      }))
    },
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress
    },
    token: "USDC"
  });

  return parseUnifiedBalanceSpendResult(result);
}

export function getProductPriceAsUsdcAmount(price: bigint) {
  return trimDecimal(formatEther(price));
}

export function generateUnifiedBalanceReferenceId({ buyer, productId }: { buyer: Address; productId: number }): Hex {
  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);

  return keccak256(
    encodeAbiParameters(parseAbiParameters("address buyer, uint256 productId, uint256 issuedAt, bytes32 entropy"), [
      buyer,
      BigInt(productId),
      BigInt(Date.now()),
      toHex(entropy, { size: 32 })
    ])
  );
}

export function buildUnifiedBalanceSpendPreparation({
  allocations,
  amount,
  amountWei,
  buyer,
  estimatedFees,
  productId,
  receiverAddress,
  referenceId,
  selectedChainIds
}: Omit<UnifiedBalanceSpendPreparation, "createdAt">): UnifiedBalanceSpendPreparation {
  return {
    allocations,
    amount,
    amountWei,
    buyer,
    createdAt: Date.now(),
    estimatedFees,
    productId,
    receiverAddress,
    referenceId,
    selectedChainIds
  };
}

export const unifiedBalanceCheckoutStages: { id: UnifiedBalanceCheckoutStage; label: string }[] = [
  { id: "spend", label: "Pay with Unified Balance" },
  { id: "receiver", label: "Payment Verification" },
  { id: "settlement", label: "Voucher Ready" }
];

export function parseUnifiedBalanceSpendResult(result: unknown): UnifiedBalanceSpendEvidence {
  const record = isObject(result) ? result : {};

  return {
    destinationChain: getString(record.destinationChain),
    explorerUrl: getString(record.explorerUrl),
    raw: result,
    recipientAddress: getString(record.recipientAddress),
    transferId: getString(record.transferId),
    txHash: getString(record.txHash)
  };
}

export function buildUnifiedBalanceAllocations({
  amount,
  balances,
  selectedChains,
  supportedChains
}: {
  amount: string;
  balances?: UnifiedBalanceSnapshot;
  selectedChains: string[];
  supportedChains: UnifiedBalanceChainOption[];
}): {
  allocations: UnifiedBalanceAllocation[];
  availableAmount: string;
  hasSufficientBalance: boolean;
} {
  const requiredUnits = parseUsdcUnits(amount);
  let remainingUnits = requiredUnits;
  let availableUnits = BigInt(0);
  const allocations: UnifiedBalanceAllocation[] = [];

  for (const chainId of selectedChains) {
    const chainOption = supportedChains.find((chain) => chain.id === chainId);
    const chainBalance = balances?.breakdown.find((balance) => balance.chain === chainId);

    if (!chainOption || !chainBalance) {
      continue;
    }

    const chainUnits = parseUsdcUnits(chainBalance.confirmedBalance);
    availableUnits += chainUnits;

    if (remainingUnits <= BigInt(0) || chainUnits <= BigInt(0)) {
      continue;
    }

    const allocationUnits = chainUnits < remainingUnits ? chainUnits : remainingUnits;
    remainingUnits -= allocationUnits;
    allocations.push({
      amount: formatUsdcUnits(allocationUnits),
      chain: chainOption.chain,
      chainId: chainOption.id
    });
  }

  return {
    allocations,
    availableAmount: formatUsdcUnits(availableUnits),
    hasSufficientBalance: availableUnits >= requiredUnits && requiredUnits > BigInt(0)
  };
}

export function getBalanceForChain(balances: UnifiedBalanceSnapshot | undefined, chainId: string) {
  return balances?.breakdown.find((balance) => balance.chain === chainId)?.confirmedBalance ?? "0";
}

export function sumFees(fees: UnifiedBalanceFeeEntry[] | undefined) {
  const total = (fees ?? []).reduce((sum, fee) => sum + parseUsdcUnits(fee.amount), BigInt(0));
  return formatUsdcUnits(total);
}

export function parseUsdcUnits(value: string | undefined) {
  const normalized = normalizeDecimalString(value ?? "0");
  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(usdcDecimalPlaces, "0").slice(0, usdcDecimalPlaces);

  return BigInt(whole || "0") * usdcUnit + BigInt(paddedFraction || "0");
}

export function formatUsdcUnits(value: bigint) {
  const whole = value / usdcUnit;
  const fraction = (value % usdcUnit).toString().padStart(usdcDecimalPlaces, "0").replace(/0+$/, "");
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function normalizeDecimalString(value: string) {
  const trimmed = value.trim();
  const safeValue = trimmed && /^[0-9]+(\.[0-9]+)?$/.test(trimmed) ? trimmed : "0";
  return safeValue.startsWith(".") ? `0${safeValue}` : safeValue;
}

function trimDecimal(value: string) {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
