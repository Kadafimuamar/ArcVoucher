import "dotenv/config";
import type { Address, Hex } from "viem";

const DEFAULT_RPC_URL = "https://rpc.testnet.arc.network";
const DEFAULT_STORE_ADDRESS = "0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c";

export type BackendConfig = {
  arcRpcUrl: string;
  contractAddress: Address;
  fulfillerPrivateKey: Hex;
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
    port: Number(process.env.PORT ?? 4000)
  };
}

function normalizePrivateKey(value: string): Hex {
  return (value.startsWith("0x") ? value : `0x${value}`) as Hex;
}

