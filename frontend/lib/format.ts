import { formatEther } from "viem";

export function formatUsdc(value: bigint) {
  const formatted = formatEther(value);
  return `${Number(formatted).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(formatted) % 1 === 0 ? 0 : 2
  })} USDC`;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

