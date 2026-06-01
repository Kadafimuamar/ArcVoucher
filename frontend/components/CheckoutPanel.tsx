"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { WalletConnect } from "@/components/WalletConnect";
import { StockBadge } from "@/components/StockBadge";
import { arcTestnet } from "@/lib/chains/arc";
import { arcVoucherStoreAbi, arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { formatUsdc, shortAddress } from "@/lib/format";
import { getAvailableStock, type Product } from "@/lib/products";
import {
  getErrorText,
  isReceiptTimeoutError,
  isSupportedWalletOrigin,
  isWalletAuthorizationError,
  supportedWalletOrigins,
  walletAuthorizationMessage
} from "@/lib/wallet/errors";

type CheckoutPanelProps = {
  onPurchaseConfirmed?: () => void;
  onRefreshState?: () => void;
  product: Product;
};

type TransactionState =
  | "idle"
  | "waiting wallet confirmation"
  | "transaction submitted"
  | "confirming"
  | "still confirming"
  | "success"
  | "failed";

const RECEIPT_TIMEOUT_MS = 90_000;

export function CheckoutPanel({ onPurchaseConfirmed, onRefreshState, product }: CheckoutPanelProps) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [isConfirmationSlow, setIsConfirmationSlow] = useState(false);
  const [authorizationNotice, setAuthorizationNotice] = useState<string | null>(null);
  const [currentOrigin] = useState(() => (typeof window === "undefined" ? null : window.location.origin));
  const {
    data: hash,
    error: writeError,
    isPending: isWaitingWallet,
    reset,
    writeContract
  } = useWriteContract();
  const {
    data: receipt,
    error: receiptError,
    isError: isReceiptError,
    isPending: isConfirming,
    isSuccess: isConfirmed,
    refetch: refetchReceipt
  } = useWaitForTransactionReceipt({
    chainId: arcTestnet.id,
    confirmations: 1,
    hash,
    pollingInterval: 3_000,
    timeout: RECEIPT_TIMEOUT_MS,
    query: {
      enabled: Boolean(hash),
      retry: false
    }
  });
  const availableStock = getAvailableStock(product);
  const isOnArcTestnet = chainId === arcTestnet.id;
  const receiptTimedOut = isConfirmationSlow || (isReceiptError && isReceiptTimeoutError(receiptError));
  const hasAuthorizationIssue = Boolean(authorizationNotice) || isWalletAuthorizationError(writeError) || isWalletAuthorizationError(receiptError);
  const hasFailed = Boolean(writeError || (isReceiptError && !receiptTimedOut) || receipt?.status === "reverted");
  const hasSucceeded = isConfirmed && receipt?.status === "success";
  const transactionState = getTransactionState({
    hasFailed,
    hasHash: Boolean(hash),
    hasSucceeded,
    isConfirmationSlow: receiptTimedOut,
    isConfirming,
    isWaitingWallet
  });
  const isTransactionPending = isWaitingWallet || (Boolean(hash) && !hasSucceeded && !hasFailed);
  const buyDisabled =
    !isConnected || !isOnArcTestnet || !product.active || availableStock === 0 || isTransactionPending || hasSucceeded;
  const explorerTxUrl = hash ? `${arcTestnet.blockExplorers.default.url}/tx/${hash}` : undefined;
  const errorMessage = getTransactionErrorMessage({
    hasAuthorizationIssue,
    receiptError,
    receiptTimedOut,
    writeError
  });
  const unsupportedLocalOrigin =
    currentOrigin?.startsWith("http://") && !isSupportedWalletOrigin(currentOrigin) ? currentOrigin : null;

  useEffect(() => {
    if (hasSucceeded) {
      onPurchaseConfirmed?.();
    }
  }, [hasSucceeded, onPurchaseConfirmed]);

  useEffect(() => {
    if (!hash || hasSucceeded || hasFailed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsConfirmationSlow(true);
    }, RECEIPT_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [hasFailed, hasSucceeded, hash]);

  useEffect(() => {
    function handlePotentialAuthorizationError(error: unknown) {
      if (isWalletAuthorizationError(error)) {
        setAuthorizationNotice(walletAuthorizationMessage);
        return true;
      }

      return false;
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (handlePotentialAuthorizationError(event.reason)) {
        event.preventDefault();
      }
    }

    function handleWindowError(event: ErrorEvent) {
      if (handlePotentialAuthorizationError(event.error ?? event.message)) {
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  function handleBuy() {
    if (buyDisabled) {
      return;
    }

    setAuthorizationNotice(null);
    setSubmittedAt(null);
    setIsConfirmationSlow(false);
    reset();
    writeContract({
      address: arcVoucherStoreAddress,
      abi: arcVoucherStoreAbi,
      functionName: "buyProduct",
      args: [BigInt(product.id)],
      chainId: arcTestnet.id,
      value: product.price
    }, {
      onSuccess: () => {
        setSubmittedAt(Date.now());
        setIsConfirmationSlow(false);
      }
    });
  }

  function handleRefreshState() {
    onRefreshState?.();

    if (hash && !hasSucceeded && !hasFailed) {
      setIsConfirmationSlow(false);
      void refetchReceipt();
    }
  }

  function handleResetTransaction() {
    reset();
    setSubmittedAt(null);
    setIsConfirmationSlow(false);
    setAuthorizationNotice(null);
  }

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-sm font-medium text-zinc-400">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{product.name}</h1>
        </div>
        <StockBadge active={product.active} availableStock={availableStock} />
      </div>

      <div className="space-y-4 py-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Price</span>
          <span className="text-xl font-semibold text-emerald-200">{formatUsdc(product.price)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Network</span>
          <span className="text-sm font-medium text-white">Arc Testnet</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-400">Contract</span>
          <span className="text-sm font-medium text-white">{shortAddress(arcVoucherStoreAddress)}</span>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-5">
        <WalletConnect onAuthorizationIssue={setAuthorizationNotice} showAuthorizationMessage />
        {authorizationNotice ? (
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
            <p className="font-semibold">Wallet authorization required</p>
            <p className="mt-1 text-xs text-amber-100/80">{authorizationNotice}</p>
          </div>
        ) : null}
        {unsupportedLocalOrigin ? (
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100/80">
            Local checkout supports {supportedWalletOrigins.join(" and ")}. Current origin: {unsupportedLocalOrigin}.
          </div>
        ) : null}
        {isConnected && !isOnArcTestnet ? (
          <button
            className="min-h-12 w-full rounded-full border border-amber-300/30 bg-amber-300/10 px-5 text-sm font-bold text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSwitchingChain}
            type="button"
            onClick={() => switchChain({ chainId: arcTestnet.id })}
          >
            {isSwitchingChain ? "Switching network" : "Switch to Arc Testnet"}
          </button>
        ) : null}
        <button
          className="min-h-12 w-full rounded-full bg-emerald-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={buyDisabled}
          type="button"
          onClick={handleBuy}
        >
          {getBuyButtonLabel({
            availableStock,
            hasSucceeded,
            isConnected,
            isOnArcTestnet,
            isTransactionPending,
            productActive: product.active
          })}
        </button>
        <TransactionStatus
          errorMessage={errorMessage}
          explorerTxUrl={explorerTxUrl}
          hash={hash}
          onRefreshState={handleRefreshState}
          onResetTransaction={handleResetTransaction}
          submittedAt={submittedAt}
          state={transactionState}
        />
        <Link
          className="block rounded-full border border-white/10 px-5 py-3 text-center text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04]"
          href={`/product/${product.id}`}
        >
          Product details
        </Link>
      </div>
    </section>
  );
}

function TransactionStatus({
  errorMessage,
  explorerTxUrl,
  hash,
  onRefreshState,
  onResetTransaction,
  submittedAt,
  state
}: {
  errorMessage?: string;
  explorerTxUrl?: string;
  hash?: `0x${string}`;
  onRefreshState: () => void;
  onResetTransaction: () => void;
  submittedAt: number | null;
  state: TransactionState;
}) {
  const tone =
    state === "failed"
      ? "border-red-400/25 bg-red-400/10 text-red-100"
      : state === "success"
        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
        : state === "still confirming"
          ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
        : "border-white/10 bg-white/[0.04] text-zinc-300";
  const message = getTransactionStatusMessage(state);
  const canReset = state !== "idle";

  return (
    <div className={`rounded-lg border p-3 text-sm ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">Transaction</span>
        <span className="text-right capitalize">{state}</span>
      </div>
      <p className="mt-2 text-xs opacity-80">{message}</p>
      {submittedAt ? (
        <p className="mt-1 text-xs opacity-70">Submitted {new Date(submittedAt).toLocaleTimeString()}</p>
      ) : null}
      {hash && explorerTxUrl ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium opacity-80">Transaction hash</p>
          <a
            className="block break-all text-xs font-medium underline-offset-4 hover:underline"
            href={explorerTxUrl}
            rel="noreferrer"
            target="_blank"
          >
            {hash}
          </a>
          <a className="inline-flex text-xs font-semibold underline-offset-4 hover:underline" href={explorerTxUrl} rel="noreferrer" target="_blank">
            View on ArcScan
          </a>
        </div>
      ) : null}
      {state === "failed" && errorMessage ? <p className="mt-2 line-clamp-3 text-xs text-red-100/80">{errorMessage}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.04]"
          type="button"
          onClick={onRefreshState}
        >
          Refresh product/order state
        </button>
        <button
          className="min-h-10 rounded-full border border-white/10 px-4 text-xs font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canReset}
          type="button"
          onClick={onResetTransaction}
        >
          Reset transaction state
        </button>
      </div>
    </div>
  );
}

function getTransactionState({
  hasFailed,
  hasHash,
  hasSucceeded,
  isConfirmationSlow,
  isConfirming,
  isWaitingWallet
}: {
  hasFailed: boolean;
  hasHash: boolean;
  hasSucceeded: boolean;
  isConfirmationSlow: boolean;
  isConfirming: boolean;
  isWaitingWallet: boolean;
}): TransactionState {
  if (hasFailed) {
    return "failed";
  }
  if (hasSucceeded) {
    return "success";
  }
  if (hasHash && isConfirmationSlow) {
    return "still confirming";
  }
  if (isConfirming) {
    return "confirming";
  }
  if (hasHash) {
    return "transaction submitted";
  }
  if (isWaitingWallet) {
    return "waiting wallet confirmation";
  }

  return "idle";
}

function getTransactionStatusMessage(state: TransactionState) {
  switch (state) {
    case "waiting wallet confirmation":
      return "Approve this purchase in your wallet.";
    case "transaction submitted":
      return "Your wallet submitted the transaction. Waiting for Arc Testnet confirmation.";
    case "confirming":
      return "Confirming on Arc Testnet. The transaction hash is available below.";
    case "still confirming":
      return "Still confirming. You can keep this page open, check ArcScan, refresh state, or reset the local transaction UI.";
    case "success":
      return "Order paid on-chain. Fulfillment comes next.";
    case "failed":
      return "The transaction failed, reverted, or was rejected.";
    case "idle":
    default:
      return "No transaction has been submitted yet.";
  }
}

function getTransactionErrorMessage({
  hasAuthorizationIssue,
  receiptError,
  receiptTimedOut,
  writeError
}: {
  hasAuthorizationIssue: boolean;
  receiptError: unknown;
  receiptTimedOut: boolean;
  writeError: unknown;
}) {
  if (hasAuthorizationIssue) {
    return walletAuthorizationMessage;
  }

  if (receiptTimedOut) {
    return "Still confirming. Use ArcScan or refresh state to continue checking this transaction.";
  }

  return getErrorText(writeError) || getErrorText(receiptError) || undefined;
}

function getBuyButtonLabel({
  availableStock,
  hasSucceeded,
  isConnected,
  isOnArcTestnet,
  isTransactionPending,
  productActive
}: {
  availableStock: number;
  hasSucceeded: boolean;
  isConnected: boolean;
  isOnArcTestnet: boolean;
  isTransactionPending: boolean;
  productActive: boolean;
}) {
  if (hasSucceeded) {
    return "Purchase confirmed";
  }
  if (!isConnected) {
    return "Connect wallet to buy";
  }
  if (!isOnArcTestnet) {
    return "Switch to Arc Testnet";
  }
  if (!productActive) {
    return "Product inactive";
  }
  if (availableStock === 0) {
    return "Out of stock";
  }
  if (isTransactionPending) {
    return "Processing transaction";
  }

  return "Buy with Arc USDC";
}
