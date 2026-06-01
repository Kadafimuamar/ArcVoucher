// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "./ArcVoucherStore.sol";

/// @title ArcVoucherIntentPaymentReceiver
/// @notice Receives raw Arc native USDC from Unified Balance spends and attaches them to checkout intents.
/// @dev ArcVoucherStore.buyProduct records msg.sender as buyer. Because this receiver calls buyProduct,
/// store orders settled through this contract are owned by this receiver address, not the original buyer.
/// The original buyer is preserved in intent state and IntentSettled events for backend/order indexing.
contract ArcVoucherIntentPaymentReceiver {
    enum IntentStatus {
        Created,
        PaymentAttached,
        Settled,
        Refunded,
        Cancelled
    }

    struct Intent {
        uint256 id;
        address buyer;
        uint256 productId;
        uint256 expectedAmount;
        bytes32 referenceId;
        IntentStatus status;
        uint256 rawPaymentId;
        uint256 createdAt;
    }

    struct RawPayment {
        uint256 id;
        address sender;
        uint256 amount;
        bool attached;
        uint256 createdAt;
    }

    event IntentCreated(
        uint256 indexed intentId,
        address indexed buyer,
        uint256 indexed productId,
        uint256 expectedAmount,
        bytes32 referenceId
    );
    event RawPaymentReceived(uint256 indexed rawPaymentId, address indexed sender, uint256 amount);
    event PaymentAttached(
        uint256 indexed intentId, uint256 indexed rawPaymentId, address indexed buyer, uint256 amount
    );
    event IntentSettled(
        uint256 indexed intentId, uint256 indexed storeOrderId, address indexed buyer, uint256 productId, uint256 amount
    );
    event IntentRefunded(uint256 indexed intentId, address indexed buyer, uint256 amount);
    event IntentCancelled(uint256 indexed intentId, address indexed buyer);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    error Unauthorized();
    error InvalidStore();
    error InvalidBuyer();
    error InvalidProduct();
    error InvalidAmount();
    error EmptyReferenceId();
    error DuplicateReferenceId();
    error InvalidIntent();
    error InvalidRawPayment();
    error IntentNotCreated();
    error IntentNotPaymentAttached();
    error RawPaymentAlreadyAttached();
    error AmountMismatch();
    error TransferFailed();

    ArcVoucherStore public immutable store;
    address public immutable owner;
    address public operator;
    uint256 public nextIntentId = 1;
    uint256 public nextRawPaymentId = 1;

    mapping(uint256 intentId => Intent intent) private intents;
    mapping(uint256 rawPaymentId => RawPayment rawPayment) private rawPayments;
    mapping(bytes32 referenceId => uint256 intentId) private intentByReferenceId;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != owner && msg.sender != operator) {
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

    receive() external payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }

        uint256 rawPaymentId = nextRawPaymentId++;
        rawPayments[rawPaymentId] = RawPayment({
            id: rawPaymentId, sender: msg.sender, amount: msg.value, attached: false, createdAt: block.timestamp
        });

        emit RawPaymentReceived(rawPaymentId, msg.sender, msg.value);
    }

    function setOperator(address newOperator) external onlyOwner {
        address previousOperator = operator;
        operator = newOperator;

        emit OperatorUpdated(previousOperator, newOperator);
    }

    function createIntent(address buyer, uint256 productId, uint256 expectedAmount, bytes32 referenceId)
        external
        onlyOperator
        returns (uint256 intentId)
    {
        if (buyer == address(0)) {
            revert InvalidBuyer();
        }
        if (productId == 0) {
            revert InvalidProduct();
        }
        if (expectedAmount == 0) {
            revert InvalidAmount();
        }
        if (referenceId == bytes32(0)) {
            revert EmptyReferenceId();
        }
        if (intentByReferenceId[referenceId] != 0) {
            revert DuplicateReferenceId();
        }

        intentId = nextIntentId++;
        intents[intentId] = Intent({
            id: intentId,
            buyer: buyer,
            productId: productId,
            expectedAmount: expectedAmount,
            referenceId: referenceId,
            status: IntentStatus.Created,
            rawPaymentId: 0,
            createdAt: block.timestamp
        });
        intentByReferenceId[referenceId] = intentId;

        emit IntentCreated(intentId, buyer, productId, expectedAmount, referenceId);
    }

    function attachPayment(uint256 intentId, uint256 rawPaymentId) external onlyOperator {
        Intent storage intent = _requireIntent(intentId);
        RawPayment storage rawPayment = _requireRawPayment(rawPaymentId);

        if (intent.status != IntentStatus.Created) {
            revert IntentNotCreated();
        }
        if (rawPayment.attached) {
            revert RawPaymentAlreadyAttached();
        }
        if (rawPayment.amount != intent.expectedAmount) {
            revert AmountMismatch();
        }

        rawPayment.attached = true;
        intent.rawPaymentId = rawPaymentId;
        intent.status = IntentStatus.PaymentAttached;

        emit PaymentAttached(intentId, rawPaymentId, intent.buyer, rawPayment.amount);
    }

    function settleIntent(uint256 intentId) external onlyOperator returns (uint256 storeOrderId) {
        Intent storage intent = _requireIntent(intentId);

        if (intent.status != IntentStatus.PaymentAttached) {
            revert IntentNotPaymentAttached();
        }

        intent.status = IntentStatus.Settled;
        storeOrderId = store.buyProduct{value: intent.expectedAmount}(intent.productId);

        emit IntentSettled(intentId, storeOrderId, intent.buyer, intent.productId, intent.expectedAmount);
    }

    function refundIntent(uint256 intentId) external onlyOperator {
        Intent storage intent = _requireIntent(intentId);

        if (intent.status != IntentStatus.PaymentAttached) {
            revert IntentNotPaymentAttached();
        }

        uint256 amount = intent.expectedAmount;
        address buyer = intent.buyer;
        intent.status = IntentStatus.Refunded;

        (bool success,) = buyer.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit IntentRefunded(intentId, buyer, amount);
    }

    function cancelIntent(uint256 intentId) external onlyOperator {
        Intent storage intent = _requireIntent(intentId);

        if (intent.status != IntentStatus.Created) {
            revert IntentNotCreated();
        }

        intent.status = IntentStatus.Cancelled;

        emit IntentCancelled(intentId, intent.buyer);
    }

    function getIntent(uint256 intentId) external view returns (Intent memory) {
        return _requireIntent(intentId);
    }

    function getRawPayment(uint256 rawPaymentId) external view returns (RawPayment memory) {
        return _requireRawPayment(rawPaymentId);
    }

    function findIntentByReferenceId(bytes32 referenceId) external view returns (uint256 intentId) {
        return intentByReferenceId[referenceId];
    }

    function _requireIntent(uint256 intentId) private view returns (Intent storage intent) {
        intent = intents[intentId];
        if (intent.id == 0) {
            revert InvalidIntent();
        }
    }

    function _requireRawPayment(uint256 rawPaymentId) private view returns (RawPayment storage rawPayment) {
        rawPayment = rawPayments[rawPaymentId];
        if (rawPayment.id == 0) {
            revert InvalidRawPayment();
        }
    }
}
