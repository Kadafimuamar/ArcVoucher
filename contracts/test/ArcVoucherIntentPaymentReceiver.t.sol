// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherIntentPaymentReceiver} from "../src/ArcVoucherIntentPaymentReceiver.sol";
import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface IntentReceiverVm {
    function deal(address account, uint256 newBalance) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
}

contract ArcVoucherIntentPaymentReceiverTest {
    IntentReceiverVm private constant vm = IntentReceiverVm(address(uint160(uint256(keccak256("hevm cheat code")))));

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

    ArcVoucherStore private store;
    ArcVoucherIntentPaymentReceiver private receiver;

    address private constant BUYER = address(0xB0B);
    address private constant GATEWAY_SENDER = address(0xA11CE);
    address private constant BACKEND = address(0xBACC);
    address private constant NON_OPERATOR = address(0xBAD);

    uint256 private constant PRICE = 10 ether;
    uint256 private constant GATEWAY_BALANCE = 100 ether;
    bytes32 private constant REFERENCE_ID = keccak256("arcvoucher-intent-1");
    bytes32 private constant SECOND_REFERENCE_ID = keccak256("arcvoucher-intent-2");

    function setUp() public {
        store = new ArcVoucherStore();
        receiver = new ArcVoucherIntentPaymentReceiver(address(store));
        receiver.setOperator(BACKEND);

        uint256 productId = store.addProduct("Steam", "Steam Gift Card $10", PRICE, true);
        store.addStock(productId, 5);

        vm.deal(GATEWAY_SENDER, GATEWAY_BALANCE);
        vm.deal(BUYER, 0);
    }

    function testCreateIntent() public {
        vm.expectEmit(true, true, true, true);
        emit IntentCreated(1, BUYER, 1, PRICE, REFERENCE_ID);

        uint256 intentId = _createIntent(REFERENCE_ID);
        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);

        assertEq(intentId, 1);
        assertEq(intent.id, intentId);
        assertEq(intent.buyer, BUYER);
        assertEq(intent.productId, 1);
        assertEq(intent.expectedAmount, PRICE);
        assertEq(intent.referenceId, REFERENCE_ID);
        assertEq(uint256(intent.status), uint256(ArcVoucherIntentPaymentReceiver.IntentStatus.Created));
        assertEq(intent.rawPaymentId, 0);
        assertEq(intent.createdAt, block.timestamp);
        assertEq(receiver.findIntentByReferenceId(REFERENCE_ID), intentId);
    }

    function testReceiveRawPayment() public {
        vm.expectEmit(true, true, false, true);
        emit RawPaymentReceived(1, GATEWAY_SENDER, PRICE);

        uint256 rawPaymentId = _receiveRawPayment(PRICE);
        ArcVoucherIntentPaymentReceiver.RawPayment memory rawPayment = receiver.getRawPayment(rawPaymentId);

        assertEq(rawPaymentId, 1);
        assertEq(rawPayment.id, rawPaymentId);
        assertEq(rawPayment.sender, GATEWAY_SENDER);
        assertEq(rawPayment.amount, PRICE);
        assertFalse(rawPayment.attached);
        assertEq(rawPayment.createdAt, block.timestamp);
        assertEq(address(receiver).balance, PRICE);
    }

    function testAttachPayment() public {
        uint256 intentId = _createIntent(REFERENCE_ID);
        uint256 rawPaymentId = _receiveRawPayment(PRICE);

        vm.expectEmit(true, true, true, true);
        emit PaymentAttached(intentId, rawPaymentId, BUYER, PRICE);

        vm.prank(BACKEND);
        receiver.attachPayment(intentId, rawPaymentId);

        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);
        ArcVoucherIntentPaymentReceiver.RawPayment memory rawPayment = receiver.getRawPayment(rawPaymentId);

        assertEq(uint256(intent.status), uint256(ArcVoucherIntentPaymentReceiver.IntentStatus.PaymentAttached));
        assertEq(intent.rawPaymentId, rawPaymentId);
        assertTrue(rawPayment.attached);
    }

    function testRejectAmountMismatch() public {
        uint256 intentId = _createIntent(REFERENCE_ID);
        uint256 rawPaymentId = _receiveRawPayment(PRICE - 1);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.AmountMismatch.selector);
        vm.prank(BACKEND);
        receiver.attachPayment(intentId, rawPaymentId);
    }

    function testRejectDoubleAttach() public {
        uint256 intentId = _createIntent(REFERENCE_ID);
        uint256 rawPaymentId = _receiveRawPayment(PRICE);

        vm.prank(BACKEND);
        receiver.attachPayment(intentId, rawPaymentId);

        uint256 secondIntentId = _createIntent(SECOND_REFERENCE_ID);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.RawPaymentAlreadyAttached.selector);
        vm.prank(BACKEND);
        receiver.attachPayment(secondIntentId, rawPaymentId);
    }

    function testSettleIntent() public {
        uint256 intentId = _createAttachedIntent();

        vm.prank(BACKEND);
        uint256 storeOrderId = receiver.settleIntent(intentId);

        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);
        (
            uint256 orderId,
            address orderBuyer,
            uint256 orderProductId,
            uint256 amountPaid,
            ArcVoucherStore.OrderStatus orderStatus,,
        ) = store.orders(storeOrderId);

        assertEq(uint256(intent.status), uint256(ArcVoucherIntentPaymentReceiver.IntentStatus.Settled));
        assertEq(orderId, storeOrderId);
        assertEq(orderBuyer, address(receiver));
        assertEq(orderProductId, 1);
        assertEq(amountPaid, PRICE);
        assertEq(uint256(orderStatus), uint256(ArcVoucherStore.OrderStatus.Paid));
        assertEq(address(receiver).balance, 0);
        assertEq(address(store).balance, PRICE);
    }

    function testRejectDoubleSettle() public {
        uint256 intentId = _createAttachedIntent();

        vm.prank(BACKEND);
        receiver.settleIntent(intentId);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.IntentNotPaymentAttached.selector);
        vm.prank(BACKEND);
        receiver.settleIntent(intentId);
    }

    function testRefundAttachedIntent() public {
        uint256 intentId = _createAttachedIntent();
        uint256 buyerBalanceBeforeRefund = BUYER.balance;

        vm.expectEmit(true, true, false, true);
        emit IntentRefunded(intentId, BUYER, PRICE);

        vm.prank(BACKEND);
        receiver.refundIntent(intentId);

        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);

        assertEq(uint256(intent.status), uint256(ArcVoucherIntentPaymentReceiver.IntentStatus.Refunded));
        assertEq(BUYER.balance, buyerBalanceBeforeRefund + PRICE);
        assertEq(address(receiver).balance, 0);
    }

    function testRejectRefundAfterSettle() public {
        uint256 intentId = _createAttachedIntent();

        vm.prank(BACKEND);
        receiver.settleIntent(intentId);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.IntentNotPaymentAttached.selector);
        vm.prank(BACKEND);
        receiver.refundIntent(intentId);
    }

    function testCancelCreatedIntent() public {
        uint256 intentId = _createIntent(REFERENCE_ID);

        vm.expectEmit(true, true, false, true);
        emit IntentCancelled(intentId, BUYER);

        vm.prank(BACKEND);
        receiver.cancelIntent(intentId);

        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);
        assertEq(uint256(intent.status), uint256(ArcVoucherIntentPaymentReceiver.IntentStatus.Cancelled));
    }

    function testRejectCancelAfterPaymentAttached() public {
        uint256 intentId = _createAttachedIntent();

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.IntentNotCreated.selector);
        vm.prank(BACKEND);
        receiver.cancelIntent(intentId);
    }

    function testOperatorAccessControl() public {
        vm.expectRevert(ArcVoucherIntentPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.createIntent(BUYER, 1, PRICE, REFERENCE_ID);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.setOperator(NON_OPERATOR);

        uint256 intentId = _createIntent(REFERENCE_ID);
        uint256 rawPaymentId = _receiveRawPayment(PRICE);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.attachPayment(intentId, rawPaymentId);

        vm.prank(BACKEND);
        receiver.attachPayment(intentId, rawPaymentId);

        vm.expectRevert(ArcVoucherIntentPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.settleIntent(intentId);
    }

    function testOriginalBuyerPreservedInIntent() public {
        uint256 intentId = _createAttachedIntent();

        vm.expectEmit(true, true, true, true);
        emit IntentSettled(intentId, 1, BUYER, 1, PRICE);

        vm.prank(BACKEND);
        uint256 storeOrderId = receiver.settleIntent(intentId);

        ArcVoucherIntentPaymentReceiver.Intent memory intent = receiver.getIntent(intentId);
        (, address orderBuyer,,,,,) = store.orders(storeOrderId);

        assertEq(intent.buyer, BUYER);
        assertEq(orderBuyer, address(receiver));
    }

    function _createIntent(bytes32 referenceId) private returns (uint256 intentId) {
        vm.prank(BACKEND);
        intentId = receiver.createIntent(BUYER, 1, PRICE, referenceId);
    }

    function _receiveRawPayment(uint256 amount) private returns (uint256 rawPaymentId) {
        rawPaymentId = receiver.nextRawPaymentId();

        vm.prank(GATEWAY_SENDER);
        (bool success,) = address(receiver).call{value: amount}("");
        assertTrue(success);
    }

    function _createAttachedIntent() private returns (uint256 intentId) {
        intentId = _createIntent(REFERENCE_ID);
        uint256 rawPaymentId = _receiveRawPayment(PRICE);

        vm.prank(BACKEND);
        receiver.attachPayment(intentId, rawPaymentId);
    }

    function assertTrue(bool condition) private pure {
        if (!condition) {
            revert("assert true failed");
        }
    }

    function assertFalse(bool condition) private pure {
        if (condition) {
            revert("assert false failed");
        }
    }

    function assertEq(uint256 actual, uint256 expected) private pure {
        if (actual != expected) {
            revert("assert uint failed");
        }
    }

    function assertEq(address actual, address expected) private pure {
        if (actual != expected) {
            revert("assert address failed");
        }
    }

    function assertEq(bytes32 actual, bytes32 expected) private pure {
        if (actual != expected) {
            revert("assert bytes32 failed");
        }
    }
}
