import type {
  ChainDefinition,
  DepositResult,
  EstimateSpendResult,
  GetBalancesResult,
  SpendResult,
  UnifiedBalanceChainIdentifier
} from "@circle-fin/app-kit";
import type { Address, Hex } from "viem";

export type UnifiedBalanceFeeEntry = EstimateSpendResult["fees"][number];

export type UnifiedBalanceChainOption = {
  chain: UnifiedBalanceChainIdentifier;
  evmChainId?: number;
  explorerUrl?: string;
  id: string;
  isEvm: boolean;
  isTestnet: boolean;
  name: string;
  nativeCurrency?: {
    decimals: number;
    name: string;
    symbol: string;
  };
  rpcEndpoints?: readonly string[];
  title: string;
  usdcAddress?: string | null;
};

export type UnifiedBalanceChainBalance = {
  chain: string;
  confirmedBalance: string;
  pendingBalance?: string;
  pendingTransactions?: UnifiedBalancePendingTransaction[];
};

export type UnifiedBalancePendingTransaction = {
  amount: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type UnifiedBalanceSnapshot = {
  breakdown: UnifiedBalanceChainBalance[];
  raw: GetBalancesResult;
  totalConfirmedBalance: string;
  totalPendingBalance?: string;
};

export type UnifiedBalanceAllocation = {
  amount: string;
  chain: UnifiedBalanceChainIdentifier;
  chainId: string;
};

export type UnifiedBalanceFeeEstimate = {
  fees: UnifiedBalanceFeeEntry[];
  raw: EstimateSpendResult;
  totalFees: string;
};

export type UnifiedBalanceSpendEvidence = {
  destinationChain?: string;
  explorerUrl?: string;
  raw: SpendResult | unknown;
  recipientAddress?: string;
  transferId?: string;
  txHash?: string;
};

export type UnifiedBalanceDepositEvidence = {
  amount?: string;
  chain?: string;
  depositedBy?: string;
  depositedTo?: string;
  explorerUrl?: string;
  raw: DepositResult | unknown;
  token?: string;
  txHash?: string;
};

export type UnifiedBalanceDepositStatus = "idle" | "waiting_wallet" | "success" | "failed";

export type UnifiedBalancePendingDepositStatus = "confirmed_on_chain" | "waiting_gateway" | "balance_updated";

export type UnifiedBalancePendingDeposit = {
  amount: string;
  confirmedAt: number;
  explorerUrl?: string;
  sourceChainId: string;
  sourceChainLabel: string;
  startingConfirmedBalance: string;
  status: UnifiedBalancePendingDepositStatus;
  txHash?: string;
};

export type UnifiedBalanceStatus = "not_connected" | "loading" | "ready" | "insufficient" | "unavailable" | "error";

export type UnifiedBalanceSpendPreparation = {
  allocations: UnifiedBalanceAllocation[];
  amount: string;
  amountWei: bigint;
  buyer: Address;
  createdAt: number;
  estimatedFees?: UnifiedBalanceFeeEstimate;
  productId: number;
  receiverAddress: Address;
  referenceId: Hex;
  selectedChainIds: string[];
};

export type UnifiedBalanceCheckoutStage = "spend" | "receiver" | "settlement";

export type BrowserEthereumProvider = Parameters<typeof import("@circle-fin/adapter-viem-v2").createViemAdapterFromProvider>[0]["provider"];

export type SupportedChainDefinition = ChainDefinition & {
  chain: string;
  chainId?: number;
  explorerUrl?: string;
  isTestnet?: boolean;
  name: string;
  nativeCurrency?: {
    decimals: number;
    name: string;
    symbol: string;
  };
  rpcEndpoints?: readonly string[];
  title?: string;
  type?: string;
  usdcAddress?: string | null;
};
