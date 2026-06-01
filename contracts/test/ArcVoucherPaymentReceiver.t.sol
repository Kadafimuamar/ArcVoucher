// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherPaymentReceiver} from "../src/ArcVoucherPaymentReceiver.sol";
import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface ReceiverVm {
    function deal(address account, uint256 newBalance) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
}

contract ArcVoucherPaymentReceiverTest {
    ReceiverVm private constant vm = ReceiverVm(address(uint160(uint256(keccak256("hevm cheat code")))));

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

    ArcVoucherStore private store;
    ArcVoucherPaymentReceiver private receiver;

    address private constant BUYER = address(0xB0B);
    address private constant BACKEND = address(0xBACC);
    address private constant NON_OPERATOR = address(0xBAD);

    uint256 private constant PRICE = 10 ether;
    uint256 private constant BUYER_BALANCE = 100 ether;
    bytes32 private constant REFERENCE_ID = keccak256("arcvoucher-unified-payment-1");

    function setUp() public {
        store = new ArcVoucherStore();
        receiver = new ArcVoucherPaymentReceiver(address(store));
        receiver.setBackend(BACKEND);

        uint256 productId = store.addProduct("Steam", "Steam Gift Card $10", PRICE, true);
        store.addStock(productId, 5);

        vm.deal(BUYER, BUYER_BALANCE);
    }

    function testReceiveUnifiedPayment() public {
        vm.prank(BUYER);
        uint256 paymentId = receiver.receiveUnifiedPayment{value: PRICE}(BUYER, 1, REFERENCE_ID);

        (
            uint256 id,
            address buyer,
            uint256 productId,
            uint256 amount,
            bytes32 referenceId,
            ArcVoucherPaymentReceiver.PaymentStatus status,
            uint256 createdAt,
            uint256 storeOrderId
        ) = receiver.payments(paymentId);

        assertEq(paymentId, 1);
        assertEq(id, paymentId);
        assertEq(buyer, BUYER);
        assertEq(productId, 1);
        assertEq(amount, PRICE);
        assertEq(referenceId, REFERENCE_ID);
        assertEq(uint256(status), uint256(ArcVoucherPaymentReceiver.PaymentStatus.Received));
        assertEq(createdAt, block.timestamp);
        assertEq(storeOrderId, 0);
        assertEq(receiver.paymentByReferenceId(REFERENCE_ID), paymentId);
        assertEq(address(receiver).balance, PRICE);
    }

    function testRejectZeroValue() public {
        vm.expectRevert(ArcVoucherPaymentReceiver.InvalidPaymentAmount.selector);
        vm.prank(BUYER);
        receiver.receiveUnifiedPayment{value: 0}(BUYER, 1, REFERENCE_ID);
    }

    function testSettleToArcVoucherStore() public {
        uint256 paymentId = _createPayment();

        vm.prank(BACKEND);
        uint256 storeOrderId = receiver.settleToStore(paymentId);

        (,,,, ArcVoucherPaymentReceiver.PaymentStatus paymentStatus,, uint256 storedOrderId) =
            _paymentStatusFields(paymentId);
        (
            uint256 orderId,
            address orderBuyer,
            uint256 orderProductId,
            uint256 amountPaid,
            ArcVoucherStore.OrderStatus orderStatus,,
        ) = store.orders(storeOrderId);

        assertEq(uint256(paymentStatus), uint256(ArcVoucherPaymentReceiver.PaymentStatus.Settled));
        assertEq(storedOrderId, storeOrderId);
        assertEq(orderId, storeOrderId);
        assertEq(orderBuyer, address(receiver));
        assertEq(orderProductId, 1);
        assertEq(amountPaid, PRICE);
        assertEq(uint256(orderStatus), uint256(ArcVoucherStore.OrderStatus.Paid));
        assertEq(address(receiver).balance, 0);
        assertEq(address(store).balance, PRICE);
    }

    function testPreventDoubleSettlement() public {
        uint256 paymentId = _createPayment();

        vm.prank(BACKEND);
        receiver.settleToStore(paymentId);

        vm.expectRevert(ArcVoucherPaymentReceiver.PaymentNotReceived.selector);
        vm.prank(BACKEND);
        receiver.settleToStore(paymentId);
    }

    function testRefundUnsettledPayment() public {
        uint256 paymentId = _createPayment();
        uint256 buyerBalanceBeforeRefund = BUYER.balance;

        vm.prank(BACKEND);
        receiver.refundUnifiedPayment(paymentId);

        (,,,, ArcVoucherPaymentReceiver.PaymentStatus paymentStatus,, uint256 storeOrderId) =
            _paymentStatusFields(paymentId);

        assertEq(uint256(paymentStatus), uint256(ArcVoucherPaymentReceiver.PaymentStatus.Refunded));
        assertEq(storeOrderId, 0);
        assertEq(BUYER.balance, buyerBalanceBeforeRefund + PRICE);
        assertEq(address(receiver).balance, 0);
    }

    function testPreventRefundAfterSettlement() public {
        uint256 paymentId = _createPayment();

        vm.prank(BACKEND);
        receiver.settleToStore(paymentId);

        vm.expectRevert(ArcVoucherPaymentReceiver.PaymentNotReceived.selector);
        vm.prank(BACKEND);
        receiver.refundUnifiedPayment(paymentId);
    }

    function testPreserveBuyerInReceiverEvents() public {
        vm.expectEmit(true, true, true, true);
        emit UnifiedPaymentReceived(1, BUYER, 1, PRICE, REFERENCE_ID);

        vm.prank(BUYER);
        uint256 paymentId = receiver.receiveUnifiedPayment{value: PRICE}(BUYER, 1, REFERENCE_ID);

        vm.expectEmit(true, true, true, true);
        emit UnifiedPaymentSettled(paymentId, BUYER, 1, PRICE, 1);

        vm.prank(BACKEND);
        receiver.settleToStore(paymentId);
    }

    function testNonOperatorCannotSettle() public {
        uint256 paymentId = _createPayment();

        vm.expectRevert(ArcVoucherPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.settleToStore(paymentId);
    }

    function testNonOperatorCannotRefund() public {
        uint256 paymentId = _createPayment();

        vm.expectRevert(ArcVoucherPaymentReceiver.Unauthorized.selector);
        vm.prank(NON_OPERATOR);
        receiver.refundUnifiedPayment(paymentId);
    }

    function _createPayment() private returns (uint256 paymentId) {
        vm.prank(BUYER);
        paymentId = receiver.receiveUnifiedPayment{value: PRICE}(BUYER, 1, REFERENCE_ID);
    }

    function _paymentStatusFields(uint256 paymentId)
        private
        view
        returns (
            uint256 id,
            address buyer,
            uint256 productId,
            uint256 amount,
            ArcVoucherPaymentReceiver.PaymentStatus status,
            uint256 createdAt,
            uint256 storeOrderId
        )
    {
        (id, buyer, productId, amount,, status, createdAt, storeOrderId) = receiver.payments(paymentId);
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
