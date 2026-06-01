import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig } from "../config/env.js";

export const config = loadConfig();

export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC"
  },
  rpcUrls: {
    default: {
      http: [config.arcRpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app"
    }
  }
} as const;

export const account = privateKeyToAccount(config.fulfillerPrivateKey);

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(config.arcRpcUrl)
});

export const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(config.arcRpcUrl)
});

