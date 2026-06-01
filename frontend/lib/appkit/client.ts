"use client";

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { BrowserEthereumProvider } from "@/lib/appkit/types";

declare global {
  interface Window {
    ethereum?: BrowserEthereumProvider;
  }
}

let appKit: AppKit | undefined;

export function getArcAppKit() {
  appKit ??= new AppKit({
    disableErrorReporting: true
  });

  return appKit;
}

export function getBrowserEthereumProvider() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.ethereum;
}

export async function createBrowserViemAdapter() {
  const provider = getBrowserEthereumProvider();

  if (!provider) {
    throw new Error("No browser wallet provider found.");
  }

  return createViemAdapterFromProvider({
    provider
  });
}
