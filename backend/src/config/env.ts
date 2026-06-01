import "dotenv/config";
import type { Address, Hex } from "viem";

const DEFAULT_RPC_URL = "https://rpc.testnet.arc.network";
const DEFAULT_STORE_ADDRESS = "0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c";
const DEFAULT_INTENT_RECEIVER_ADDRESS = "0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971";
const DEFAULT_GATEWAY_ADDRESS = "0x0022222abe238cc2c7bb1f21003f0a260052475b";
const DEFAULT_NATIVE_USDC_ADDRESS = "0xfffffffffffffffffffffffffffffffffffffffe";

export type BackendConfig = {
  arcRpcUrl: string;
  contractAddress: Address;
  fulfillerPrivateKey: Hex;
  gatewayAddress: Address;
  intentReceiverAddress: Address;
  nativeUsdcAddress: Address;
  port: number;
};

export function loadConfig(): BackendConfig {
  const fulfillerPrivateKey = process.env.FULFILLER_PRIVATE_KEY;

  if (!fulfillerPrivateKey) {
    throw new Error("FULFILLER_PRIVATE_KEY is required");
  }

  return {
    arcRpcUrl: process.env.ARC_TESTNET_RPC_URL ?? DEFAULT_RPC_URL,
    contractAddress: (process.env.ARC_VOUCHER_STORE_ADDRESS ?? DEFAULT_STORE_ADDRESS) as Address,
    fulfillerPrivateKey: normalizePrivateKey(fulfillerPrivateKey),
    gatewayAddress: (process.env.ARC_GATEWAY_ADDRESS ?? DEFAULT_GATEWAY_ADDRESS) as Address,
    intentReceiverAddress: (process.env.ARC_VOUCHER_INTENT_PAYMENT_RECEIVER_ADDRESS ?? DEFAULT_INTENT_RECEIVER_ADDRESS) as Address,
    nativeUsdcAddress: (process.env.ARC_NATIVE_USDC_ADDRESS ?? DEFAULT_NATIVE_USDC_ADDRESS) as Address,
    port: Number(process.env.PORT ?? 4000)
  };
}

function normalizePrivateKey(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}
