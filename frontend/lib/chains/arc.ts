import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 5042002),
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC"
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network"]
    }
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app"
    }
  },
  testnet: true
});

