// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
}

contract ArcVoucherStoreTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ArcVoucherStore private store;

    address private constant BUYER = address(0xB0B);
    address private constant NON_OWNER = address(0xBAD);
    address private constant FULFILLER = address(0xF11F11);
    address payable private constant REVENUE_RECIPIENT = payable(address(0xCAFE));

    uint256 private constant PRICE = 25_000_000;
    uint256 private constant BUYER_BALANCE = 100_000_000;

    function setUp() public {
        store = new ArcVoucherStore();
        store.setFulfiller(FULFILLER);
        vm.deal(BUYER, BUYER_BALANCE);
        vm.deal(REVENUE_RECIPIENT, 0);
    }

    function testOwnerCanAddProduct() public {
        uint256 productId = store.addProduct("Steam", "Steam 25 USDC", PRICE, true);

        (
            uint256 id,
            string memory brand,
            string memory name,
            uint256 price,
            uint256 totalStock,
            uint256 soldStock,
            bool active
        ) = store.products(productId);

        assertEq(productId, 1);
        assertEq(id, productId);
        assertEq(brand, "Steam");
        assertEq(name, "Steam 25 USDC");
        assertEq(price, PRICE);
        assertEq(totalStock, 0);
        assertEq(soldStock, 0);
        assertTrue(active);
    }

    function testNonOwnerCannotAddProduct() public {
        vm.expectRevert(ArcVoucherStore.Unauthorized.selector);
        vm.prank(NON_OWNER);
        store.addProduct("Steam", "Steam 25 USDC", PRICE, true);
    }

    function testOwnerCanAddStock() public {
        uint256 productId = store.addProduct("Steam", "Steam 25 USDC", PRICE, true);

        store.addStock(productId, 5);

        (,,,, uint256 totalStock, uint256 soldStock,) = store.products(productId);
        assertEq(totalStock, 5);
        assertEq(soldStock, 0);
        assertEq(store.availableStock(productId), 5);
    }

    function testBuyerCanBuyAvailableProduct() public {
        uint256 productId = _createStockedProduct(true, 2);

        vm.prank(BUYER);
        uint256 orderId = store.buyProduct{value: PRICE}(productId);

        (,,,, uint256 totalStock, uint256 soldStock,) = store.products(productId);
        (
            uint256 id,
            address buyer,
            uint256 orderProductId,
            uint256 amountPaid,
            ArcVoucherStore.OrderStatus status,
            bytes32 voucherHash,
            uint256 createdAt
        ) = store.orders(orderId);

        assertEq(totalStock, 2);
        assertEq(soldStock, 1);
        assertEq(store.availableStock(productId), 1);
        assertEq(id, orderId);
        assertEq(buyer, BUYER);
        assertEq(orderProductId, productId);
        assertEq(amountPaid, PRICE);
        assertEq(uint256(status), uint256(ArcVoucherStore.OrderStatus.Paid));
        assertEq(voucherHash, bytes32(0));
        assertEq(createdAt, block.timestamp);
        assertEq(address(store).balance, PRICE);
    }

    function testCannotBuyInactiveProduct() public {
        uint256 productId = _createStockedProduct(false, 1);

        vm.expectRevert(ArcVoucherStore.ProductInactive.selector);
        vm.prank(BUYER);
        store.buyProduct{value: PRICE}(productId);
    }

    function testCannotBuyOutOfStock() public {
        uint256 productId = _createStockedProduct(true, 1);

        vm.prank(BUYER);
        store.buyProduct{value: PRICE}(productId);

        vm.expectRevert(ArcVoucherStore.OutOfStock.selector);
        vm.prank(BUYER);
        store.buyProduct{value: PRICE}(productId);
    }

    function testCannotBuyWithWrongPrice() public {
        uint256 productId = _createStockedProduct(true, 1);

        vm.expectRevert(ArcVoucherStore.IncorrectPayment.selector);
        vm.prank(BUYER);
        store.buyProduct{value: PRICE - 1}(productId);
    }

    function testFulfillOrderWithVoucherHash() public {
        uint256 orderId = _createPaidOrder();
        bytes32 voucherHash = keccak256("hashed-voucher-code");

        vm.prank(FULFILLER);
        store.fulfillOrder(orderId, voucherHash);

        (,,,, ArcVoucherStore.OrderStatus status, bytes32 storedVoucherHash,) = store.orders(orderId);
        assertEq(uint256(status), uint256(ArcVoucherStore.OrderStatus.Fulfilled));
        assertEq(storedVoucherHash, voucherHash);
        assertEq(store.withdrawableRevenue(), PRICE);
    }

    function testCannotFulfillWithZeroHash() public {
        uint256 orderId = _createPaidOrder();

        vm.expectRevert(ArcVoucherStore.EmptyVoucherHash.selector);
        vm.prank(FULFILLER);
        store.fulfillOrder(orderId, bytes32(0));
    }

    function testNonFulfillerCannotFulfill() public {
        uint256 orderId = _createPaidOrder();

        vm.expectRevert(ArcVoucherStore.Unauthorized.selector);
        vm.prank(NON_OWNER);
        store.fulfillOrder(orderId, keccak256("hashed-voucher-code"));
    }

    function testRefundPaidOrder() public {
        uint256 productId = _createStockedProduct(true, 1);

        vm.prank(BUYER);
        uint256 orderId = store.buyProduct{value: PRICE}(productId);

        uint256 buyerBalanceBeforeRefund = BUYER.balance;

        vm.prank(FULFILLER);
        store.refundOrder(orderId);

        (,,,, uint256 totalStock, uint256 soldStock,) = store.products(productId);
        (,,,, ArcVoucherStore.OrderStatus status, bytes32 voucherHash,) = store.orders(orderId);

        assertEq(totalStock, 1);
        assertEq(soldStock, 0);
        assertEq(store.availableStock(productId), 1);
        assertEq(uint256(status), uint256(ArcVoucherStore.OrderStatus.Refunded));
        assertEq(voucherHash, bytes32(0));
        assertEq(BUYER.balance, buyerBalanceBeforeRefund + PRICE);
        assertEq(address(store).balance, 0);
        assertEq(store.withdrawableRevenue(), 0);
    }

    function testCannotRefundFulfilledOrder() public {
        uint256 orderId = _createPaidOrder();

        vm.prank(FULFILLER);
        store.fulfillOrder(orderId, keccak256("hashed-voucher-code"));

        vm.expectRevert(ArcVoucherStore.OrderNotPaid.selector);
        vm.prank(FULFILLER);
        store.refundOrder(orderId);
    }

    function testOwnerCanWithdrawFulfilledRevenue() public {
        uint256 orderId = _createPaidOrder();

        vm.prank(FULFILLER);
        store.fulfillOrder(orderId, keccak256("hashed-voucher-code"));

        uint256 recipientBalanceBeforeWithdraw = REVENUE_RECIPIENT.balance;

        store.withdrawRevenue(REVENUE_RECIPIENT, PRICE);

        assertEq(REVENUE_RECIPIENT.balance, recipientBalanceBeforeWithdraw + PRICE);
        assertEq(store.withdrawableRevenue(), 0);
        assertEq(address(store).balance, 0);
    }

    function _createStockedProduct(bool active, uint256 quantity) private returns (uint256 productId) {
        productId = store.addProduct("Steam", "Steam 25 USDC", PRICE, active);
        store.addStock(productId, quantity);
    }

    function _createPaidOrder() private returns (uint256 orderId) {
        uint256 productId = _createStockedProduct(true, 1);

        vm.prank(BUYER);
        orderId = store.buyProduct{value: PRICE}(productId);
    }

    function assertTrue(bool condition) private pure {
        if (!condition) {
            revert("assert true failed");
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

    function assertEq(string memory actual, string memory expected) private pure {
        if (keccak256(bytes(actual)) != keccak256(bytes(expected))) {
            revert("assert string failed");
        }
    }
}
