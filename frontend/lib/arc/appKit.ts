import { supportedWalletOrigins } from "@/lib/wallet/errors";

export const arcAppKitDefaults = {
  chain: "Arc_Testnet",
  paymentAsset: "USDC",
  paymentMode: "NATIVE",
  supportedOrigins: supportedWalletOrigins
} as const;
