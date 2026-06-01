import { parseAbi } from "viem";

export const arcVoucherStoreAbi = parseAbi([
  "function fulfillOrder(uint256 orderId, bytes32 voucherHash)",
  "function orders(uint256 orderId) view returns (uint256 id, address buyer, uint256 productId, uint256 amountPaid, uint8 status, bytes32 voucherHash, uint256 createdAt)",
  "function products(uint256 productId) view returns (uint256 id, string brand, string name, uint256 price, uint256 totalStock, uint256 soldStock, bool active)",
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid)",
  "event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash)"
]);
