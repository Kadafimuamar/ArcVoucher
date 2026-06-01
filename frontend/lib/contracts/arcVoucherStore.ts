import { parseAbi } from "viem";

export const arcVoucherStoreAddress = (
  process.env.NEXT_PUBLIC_ARC_VOUCHER_STORE_ADDRESS ?? "0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c"
) as `0x${string}`;

export const arcVoucherStoreAbi = parseAbi([
  "function owner() view returns (address)",
  "function fulfiller() view returns (address)",
  "function nextProductId() view returns (uint256)",
  "function nextOrderId() view returns (uint256)",
  "function withdrawableRevenue() view returns (uint256)",
  "function products(uint256 productId) view returns (uint256 id, string brand, string name, uint256 price, uint256 totalStock, uint256 soldStock, bool active)",
  "function orders(uint256 orderId) view returns (uint256 id, address buyer, uint256 productId, uint256 amountPaid, uint8 status, bytes32 voucherHash, uint256 createdAt)",
  "function availableStock(uint256 productId) view returns (uint256)",
  "function addProduct(string brand, string name, uint256 price, bool active) returns (uint256 productId)",
  "function addStock(uint256 productId, uint256 quantity)",
  "function setProductActive(uint256 productId, bool active)",
  "function setFulfiller(address newFulfiller)",
  "function buyProduct(uint256 productId) payable returns (uint256 orderId)",
  "function fulfillOrder(uint256 orderId, bytes32 voucherHash)",
  "function refundOrder(uint256 orderId)",
  "function withdrawRevenue(address to, uint256 amount)",
  "event ProductCreated(uint256 indexed productId, string brand, string name, uint256 price, bool active)",
  "event StockAdded(uint256 indexed productId, uint256 quantity, uint256 totalStock)",
  "event ProductStatusUpdated(uint256 indexed productId, bool active)",
  "event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid)",
  "event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash)",
  "event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amountRefunded)",
  "event RevenueWithdrawn(address indexed to, uint256 amount)",
  "event FulfillerUpdated(address indexed previousFulfiller, address indexed newFulfiller)"
]);

