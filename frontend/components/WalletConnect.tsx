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
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1]"
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
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting" : "Connect"}
      </button>
      {showAuthorizationMessage && authorizationMessage ? (
        <p className="max-w-sm text-xs text-amber-100/80">{authorizationMessage}</p>
      ) : null}
    </div>
  );
}
