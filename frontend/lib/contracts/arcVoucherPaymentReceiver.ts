import { parseAbi, type Address } from "viem";

export const arcVoucherPaymentReceiverAddress = (
  process.env.NEXT_PUBLIC_ARC_VOUCHER_PAYMENT_RECEIVER_ADDRESS ?? "0xBcB39b7c36B22B1Da4DfF828Cd392233c84893f6"
) as Address;

export const arcVoucherPaymentReceiverAbi = parseAbi([
  "function store() view returns (address)",
  "function owner() view returns (address)",
  "function backend() view returns (address)",
  "function nextPaymentId() view returns (uint256)",
  "function payments(uint256 paymentId) view returns (uint256 id, address buyer, uint256 productId, uint256 amount, bytes32 referenceId, uint8 status, uint256 createdAt, uint256 storeOrderId)",
  "function paymentByReferenceId(bytes32 referenceId) view returns (uint256 paymentId)",
  "function receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId) payable returns (uint256 paymentId)",
  "function settleToStore(uint256 paymentId) returns (uint256 storeOrderId)",
  "function refundUnifiedPayment(uint256 paymentId)",
  "event UnifiedPaymentReceived(uint256 indexed paymentId, address indexed buyer, uint256 indexed productId, uint256 amount, bytes32 referenceId)",
  "event UnifiedPaymentSettled(uint256 indexed paymentId, address indexed buyer, uint256 indexed productId, uint256 amount, uint256 storeOrderId)",
  "event UnifiedPaymentRefunded(uint256 indexed paymentId, address indexed buyer, uint256 amount)"
]);

export const unifiedPaymentStatusLabels = ["Received", "Settled", "Refunded"] as const;

export type UnifiedPaymentStatusLabel = (typeof unifiedPaymentStatusLabels)[number];

export function unifiedPaymentStatusFromContract(status: number): UnifiedPaymentStatusLabel {
  return unifiedPaymentStatusLabels[status] ?? "Received";
}
