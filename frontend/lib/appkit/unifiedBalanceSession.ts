"use client";

import type { Address, Hex } from "viem";

export type UnifiedBalanceSessionStep = "deposit" | "spend" | "receiver" | "store_order" | "voucher" | "failed";

export type UnifiedBalanceCheckoutSession = {
  buyer: Address;
  createdAt: number;
  currentStep: UnifiedBalanceSessionStep;
  depositAmount?: string;
  depositSourceChainId?: string;
  depositTxHash?: string;
  intentId?: string;
  productId: number;
  referenceId?: Hex;
  spendTxHash?: string;
  transferId?: string;
  updatedAt: number;
};

const sessionTtlMs = 60 * 60 * 1000;
const storagePrefix = "arcvoucher:unified-balance-session";

export function loadUnifiedBalanceSession({
  buyer,
  productId
}: {
  buyer: Address;
  productId: number;
}): UnifiedBalanceCheckoutSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(getSessionKey({ buyer, productId }));
    if (!raw) {
      return undefined;
    }

    const session = JSON.parse(raw) as UnifiedBalanceCheckoutSession;
    if (!isMatchingSession({ buyer, productId, session }) || Date.now() - session.updatedAt > sessionTtlMs) {
      clearUnifiedBalanceSession({ buyer, productId });
      return undefined;
    }

    return session;
  } catch {
    clearUnifiedBalanceSession({ buyer, productId });
    return undefined;
  }
}

export function saveUnifiedBalanceSession(session: UnifiedBalanceCheckoutSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getSessionKey({ buyer: session.buyer, productId: session.productId }),
    JSON.stringify({
      ...session,
      updatedAt: Date.now()
    })
  );
}

export function clearUnifiedBalanceSession({
  buyer,
  productId
}: {
  buyer: Address;
  productId: number;
}) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getSessionKey({ buyer, productId }));
}

function getSessionKey({ buyer, productId }: { buyer: Address; productId: number }) {
  return `${storagePrefix}:${buyer.toLowerCase()}:${productId}`;
}

function isMatchingSession({
  buyer,
  productId,
  session
}: {
  buyer: Address;
  productId: number;
  session: UnifiedBalanceCheckoutSession;
}) {
  return session.buyer.toLowerCase() === buyer.toLowerCase() && session.productId === productId;
}
