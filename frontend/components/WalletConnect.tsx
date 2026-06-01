"use client";

import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { arcTestnet } from "@/lib/chains/arc";
import { shortAddress } from "@/lib/format";
import { isWalletAuthorizationError, walletAuthorizationMessage } from "@/lib/wallet/errors";

type WalletConnectProps = {
  onAuthorizationIssue?: (message: string) => void;
  showAuthorizationMessage?: boolean;
};

export function WalletConnect({ onAuthorizationIssue, showAuthorizationMessage = false }: WalletConnectProps) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const authorizationMessage = isWalletAuthorizationError(error) ? walletAuthorizationMessage : null;

  useEffect(() => {
    if (authorizationMessage) {
      onAuthorizationIssue?.(authorizationMessage);
    }
  }, [authorizationMessage, onAuthorizationIssue]);

  if (isConnected && address) {
    const onArc = chainId === arcTestnet.id;

    return (
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.1]"
        type="button"
        onClick={() => disconnect()}
      >
        <span className={`h-2 w-2 rounded-full ${onArc ? "bg-emerald-300" : "bg-amber-300"}`} />
        {shortAddress(address)}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <div className="space-y-2">
      <button
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
        type="button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting" : "Connect"}
      </button>
      {showAuthorizationMessage && authorizationMessage ? (
        <p className="max-w-sm text-xs text-amber-700 dark:text-amber-100/80">{authorizationMessage}</p>
      ) : null}
    </div>
  );
}
