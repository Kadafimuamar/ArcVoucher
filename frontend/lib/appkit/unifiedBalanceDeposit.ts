"use client";

import type { UnifiedBalanceChainIdentifier } from "@circle-fin/app-kit";
import { createBrowserViemAdapter, getArcAppKit, getBrowserEthereumProvider } from "@/lib/appkit/client";
import type { UnifiedBalanceChainOption, UnifiedBalanceDepositEvidence } from "@/lib/appkit/types";
import { getErrorText } from "@/lib/wallet/errors";

type WagmiSwitchChainAsync = (parameters: { chainId: number }) => Promise<unknown>;

// TODO: Replace this with a dedicated App Kit pending-deposit method if one is
// exported in a future SDK. In @circle-fin/app-kit 1.7.0, pending deposits are
// only public through getBalances({ includePending: true }).
export const unifiedBalancePendingDepositSupportMessage =
  "The installed App Kit SDK does not expose a separate getPendingDeposits() method. ArcVoucher checks getBalances({ includePending: true }) for pending deposit transactions instead.";

export async function depositToUnifiedBalance({
  amount,
  sourceChain
}: {
  amount: string;
  sourceChain: UnifiedBalanceChainIdentifier;
}): Promise<UnifiedBalanceDepositEvidence> {
  const adapter = await createBrowserViemAdapter();
  const result = await getArcAppKit().unifiedBalance.deposit({
    amount,
    from: {
      adapter,
      chain: sourceChain
    },
    token: "USDC"
  });

  return parseUnifiedBalanceDepositResult(result);
}

export async function switchWalletToUnifiedBalanceSourceChain({
  sourceChain,
  switchChainAsync
}: {
  sourceChain: UnifiedBalanceChainOption;
  switchChainAsync?: WagmiSwitchChainAsync;
}) {
  if (!sourceChain.evmChainId) {
    throw new Error(`${sourceChain.title} does not expose an EVM chain ID for wallet switching.`);
  }

  if (switchChainAsync) {
    try {
      await switchChainAsync({ chainId: sourceChain.evmChainId });
      return;
    } catch (error) {
      if (!isChainNotConfiguredError(error)) {
        throw error;
      }
    }
  }

  await switchBrowserWalletToSourceChain(sourceChain);
}

export function getUnifiedBalanceDepositErrorMessage(error: unknown, sourceChain?: UnifiedBalanceChainOption) {
  const message = getErrorText(error);
  const lowerMessage = message.toLowerCase();
  const sourceChainLabel = sourceChain?.title ?? "the selected source chain";

  if (
    lowerMessage.includes("user rejected") ||
    lowerMessage.includes("user denied") ||
    lowerMessage.includes("rejected the request") ||
    lowerMessage.includes("request rejected") ||
    lowerMessage.includes("cancelled") ||
    lowerMessage.includes("canceled")
  ) {
    return "Transaction rejected in wallet.";
  }

  if (lowerMessage.includes("chainid should be same as current chainid") || (lowerMessage.includes("chainid") && lowerMessage.includes("current"))) {
    return `Wallet chain mismatch. Switch wallet to ${sourceChainLabel} before depositing.`;
  }

  if (
    lowerMessage.includes("insufficient") ||
    lowerMessage.includes("exceeds balance") ||
    lowerMessage.includes("not enough") ||
    lowerMessage.includes("allowance")
  ) {
    return `Insufficient USDC or gas on ${sourceChainLabel}. Fund the wallet with testnet USDC and the native gas token for that source chain.`;
  }

  return message || "Unified Balance deposit failed.";
}

export function parseUnifiedBalanceDepositResult(result: unknown): UnifiedBalanceDepositEvidence {
  const record = isObject(result) ? result : {};

  return {
    amount: getString(record.amount),
    chain: getString(record.chain),
    depositedBy: getString(record.depositedBy),
    depositedTo: getString(record.depositedTo),
    explorerUrl: getString(record.explorerUrl),
    raw: result,
    token: getString(record.token),
    txHash: getString(record.txHash)
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function switchBrowserWalletToSourceChain(sourceChain: UnifiedBalanceChainOption) {
  const provider = getBrowserEthereumProvider();

  if (!provider) {
    throw new Error("No browser wallet provider found.");
  }

  if (!sourceChain.evmChainId) {
    throw new Error(`${sourceChain.title} does not expose an EVM chain ID for wallet switching.`);
  }

  const chainId = toRpcChainId(sourceChain.evmChainId);

  try {
    await requestWallet(provider, {
      method: "wallet_switchEthereumChain",
      params: [{ chainId }]
    });
  } catch (error) {
    if (!isUnknownChainError(error)) {
      throw error;
    }

    await requestWallet(provider, {
      method: "wallet_addEthereumChain",
      params: [
        {
          blockExplorerUrls: sourceChain.explorerUrl ? [toExplorerBaseUrl(sourceChain.explorerUrl)] : undefined,
          chainId,
          chainName: sourceChain.title,
          nativeCurrency: sourceChain.nativeCurrency,
          rpcUrls: sourceChain.rpcEndpoints?.length ? [...sourceChain.rpcEndpoints] : undefined
        }
      ]
    });

    await requestWallet(provider, {
      method: "wallet_switchEthereumChain",
      params: [{ chainId }]
    });
  }
}

function isChainNotConfiguredError(error: unknown) {
  const message = getErrorText(error).toLowerCase();

  return message.includes("chain not configured") || message.includes("not configured for connector");
}

function isUnknownChainError(error: unknown) {
  const message = getErrorText(error).toLowerCase();
  const code = isObject(error) ? error.code : undefined;

  return code === 4902 || message.includes("unrecognized chain") || message.includes("chain has not been added");
}

async function requestWallet(provider: unknown, parameters: { method: string; params?: unknown[] }) {
  const request = isObject(provider) && typeof provider.request === "function" ? provider.request : undefined;

  if (!request) {
    throw new Error("Connected wallet does not support chain switching.");
  }

  return request.call(provider, parameters);
}

function toRpcChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function toExplorerBaseUrl(explorerUrl: string) {
  return explorerUrl.replace(/\/(?:tx|transaction)\/\{hash\}.*/, "");
}
