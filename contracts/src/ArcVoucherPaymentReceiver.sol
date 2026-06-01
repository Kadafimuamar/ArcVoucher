// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "./ArcVoucherStore.sol";

/// @title ArcVoucherPaymentReceiver
/// @notice Receives Arc native USDC from Unified Balance flows and settles into ArcVoucherStore.
/// @dev ArcVoucherStore.buyProduct records msg.sender as buyer. Because this receiver calls buyProduct,
/// store orders settled through this contract are owned by this receiver address, not the original buyer.
/// The original buyer is preserved in this contract's payment records and events for backend/order indexing.
contract ArcVoucherPaymentReceiver {
    enum PaymentStatus {
        Received,
        Settled,
        Refunded
    }

    struct UnifiedPayment {
        uint256 id;
        address buyer;
        uint256 productId;
        uint256 amount;
        bytes32 referenceId;
        PaymentStatus status;
        uint256 createdAt;
        uint256 storeOrderId;
    }

    event UnifiedPaymentReceived(
        uint256 indexed paymentId, address indexed buyer, uint256 indexed productId, uint256 amount, bytes32 referenceId
    );
    event UnifiedPaymentSettled(
        uint256 indexed paymentId,
        address indexed buyer,
        uint256 indexed productId,
        uint256 amount,
        uint256 storeOrderId
    );
    event UnifiedPaymentRefunded(uint256 indexed paymentId, address indexed buyer, uint256 amount);
    event BackendUpdated(address indexed previousBackend, address indexed newBackend);

    error Unauthorized();
    error InvalidStore();
    error InvalidBuyer();
    error InvalidPaymentAmount();
    error InvalidPayment();
    error InvalidPaymentMetadata();
    error PaymentNotReceived();
    error TransferFailed();

    ArcVoucherStore public immutable store;
    address public immutable owner;
    address public backend;
    uint256 public nextPaymentId = 1;

    mapping(uint256 paymentId => UnifiedPayment payment) public payments;
    mapping(bytes32 referenceId => uint256 paymentId) public paymentByReferenceId;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && msg.sender != backend) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address arcVoucherStore) {
        if (arcVoucherStore == address(0)) {
            revert InvalidStore();
        }

        store = ArcVoucherStore(arcVoucherStore);
        owner = msg.sender;
    }

    /// @notice Records a raw native Arc USDC transfer without checkout metadata.
    /// @dev These records cannot be settled until future metadata attachment support exists; they can be refunded.
    receive() external payable {
        _recordPayment(msg.sender, 0, bytes32(0), msg.value);
    }

    function setBackend(address newBackend) external onlyOwner {
        address previousBackend = backend;
        backend = newBackend;

        emit BackendUpdated(previousBackend, newBackend);
    }

    function receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId)
        external
        payable
        returns (uint256 paymentId)
    {
        if (buyer == address(0)) {
            revert InvalidBuyer();
        }

        paymentId = _recordPayment(buyer, productId, referenceId, msg.value);
    }

    function settleToStore(uint256 paymentId) external onlyOperator returns (uint256 storeOrderId) {
        UnifiedPayment storage payment = _requirePayment(paymentId);
        if (payment.status != PaymentStatus.Received) {
            revert PaymentNotReceived();
        }
        if (payment.productId == 0 || payment.buyer == address(0)) {
            revert InvalidPaymentMetadata();
        }

        payment.status = PaymentStatus.Settled;
        storeOrderId = store.buyProduct{value: payment.amount}(payment.productId);
        payment.storeOrderId = storeOrderId;

        emit UnifiedPaymentSettled(paymentId, payment.buyer, payment.productId, payment.amount, storeOrderId);
    }

    function refundUnifiedPayment(uint256 paymentId) external onlyOperator {
        UnifiedPayment storage payment = _requirePayment(paymentId);
        if (payment.status != PaymentStatus.Received) {
            revert PaymentNotReceived();
        }

        uint256 amount = payment.amount;
        address buyer = payment.buyer;
        payment.status = PaymentStatus.Refunded;

        (bool success,) = buyer.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit UnifiedPaymentRefunded(paymentId, buyer, amount);
    }

    function _recordPayment(address buyer, uint256 productId, bytes32 referenceId, uint256 amount)
        private
        returns (uint256 paymentId)
    {
        if (amount == 0) {
            revert InvalidPaymentAmount();
        }

        paymentId = nextPaymentId++;
        payments[paymentId] = UnifiedPayment({
            id: paymentId,
            buyer: buyer,
            productId: productId,
            amount: amount,
            referenceId: referenceId,
            status: PaymentStatus.Received,
            createdAt: block.timestamp,
            storeOrderId: 0
        });

        if (referenceId != bytes32(0)) {
            paymentByReferenceId[referenceId] = paymentId;
        }

        emit UnifiedPaymentReceived(paymentId, buyer, productId, amount, referenceId);
    }

    function _requirePayment(uint256 paymentId) private view returns (UnifiedPayment storage payment) {
        payment = payments[paymentId];
        if (payment.id == 0) {
            revert InvalidPayment();
        }
    }
}
