import { parseAbi } from "viem";

export const arcVoucherStoreAbi = parseAbi([
  "function fulfillOrder(uint256 orderId, bytes32 voucherHash)",
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid)",
  "event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash)"
]);

