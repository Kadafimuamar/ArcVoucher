import { parseAbi } from "viem";

export const arcVoucherIntentPaymentReceiverAbi = parseAbi([
  "function createIntent(address buyer, uint256 productId, uint256 expectedAmount, bytes32 referenceId) returns (uint256 intentId)",
  "function attachPayment(uint256 intentId, uint256 rawPaymentId)",
  "function settleIntent(uint256 intentId) returns (uint256 storeOrderId)",
  "function refundIntent(uint256 intentId)",
  "function getIntent(uint256 intentId) view returns ((uint256 id, address buyer, uint256 productId, uint256 expectedAmount, bytes32 referenceId, uint8 status, uint256 rawPaymentId, uint256 createdAt))",
  "function getRawPayment(uint256 rawPaymentId) view returns ((uint256 id, address sender, uint256 amount, bool attached, uint256 createdAt))",
  "function findIntentByReferenceId(bytes32 referenceId) view returns (uint256 intentId)",
  "event IntentCreated(uint256 indexed intentId, address indexed buyer, uint256 indexed productId, uint256 expectedAmount, bytes32 referenceId)",
  "event RawPaymentReceived(uint256 indexed rawPaymentId, address indexed sender, uint256 amount)",
  "event PaymentAttached(uint256 indexed intentId, uint256 indexed rawPaymentId, address indexed buyer, uint256 amount)",
  "event IntentSettled(uint256 indexed intentId, uint256 indexed storeOrderId, address indexed buyer, uint256 productId, uint256 amount)",
  "event IntentRefunded(uint256 indexed intentId, address indexed buyer, uint256 amount)",
  "event IntentCancelled(uint256 indexed intentId, address indexed buyer)",
  "event OperatorUpdated(address indexed previousOperator, address indexed newOperator)"
]);
