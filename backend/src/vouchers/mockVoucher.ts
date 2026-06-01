const productPrefixes: Record<string, string> = {
  "1": "STEAM",
  "2": "EPIC",
  "3": "AMAZON",
  "4": "GOOGLE",
  "5": "APPLE",
  "6": "NETFLIX",
  "7": "SPOTIFY"
};

export function generateMockVoucherCode(orderId: bigint, productId: bigint): string {
  const prefix = productPrefixes[productId.toString()] ?? "ARCVOUCHER";
  return `${prefix}-ARC-DEMO-${orderId.toString()}`;
}

