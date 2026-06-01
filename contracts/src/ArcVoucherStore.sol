// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ArcVoucherStore
/// @notice Stores ArcVoucher product, stock, order, refund, revenue, and voucher hash state.
contract ArcVoucherStore {
    enum OrderStatus {
        Paid,
        Fulfilled,
        Refunded
    }

    struct Product {
        uint256 id;
        string brand;
        string name;
        uint256 price;
        uint256 totalStock;
        uint256 soldStock;
        bool active;
    }

    struct Order {
        uint256 id;
        address buyer;
        uint256 productId;
        uint256 amountPaid;
        OrderStatus status;
        bytes32 voucherHash;
        uint256 createdAt;
    }

    event ProductCreated(uint256 indexed productId, string brand, string name, uint256 price, bool active);
    event StockAdded(uint256 indexed productId, uint256 quantity, uint256 totalStock);
    event ProductStatusUpdated(uint256 indexed productId, bool active);
    event OrderPaid(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 amountPaid);
    event OrderFulfilled(uint256 indexed orderId, bytes32 voucherHash);
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amountRefunded);
    event RevenueWithdrawn(address indexed to, uint256 amount);
    event FulfillerUpdated(address indexed previousFulfiller, address indexed newFulfiller);

    error Unauthorized();
    error InvalidProduct();
    error InvalidPrice();
    error InvalidStockQuantity();
    error ProductInactive();
    error OutOfStock();
    error IncorrectPayment();
    error InvalidOrder();
    error OrderNotPaid();
    error EmptyVoucherHash();
    error InvalidRecipient();
    error InsufficientRevenue();
    error TransferFailed();

    address public immutable owner;
    address public fulfiller;
    uint256 public nextProductId = 1;
    uint256 public nextOrderId = 1;
    uint256 public withdrawableRevenue;

    mapping(uint256 productId => Product product) public products;
    mapping(uint256 orderId => Order order) public orders;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyFulfillmentOperator() {
        if (msg.sender != owner && msg.sender != fulfiller) {
            revert Unauthorized();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addProduct(string calldata brand, string calldata name, uint256 price, bool active)
        external
        onlyOwner
        returns (uint256 productId)
    {
        if (price == 0) {
            revert InvalidPrice();
        }

        productId = nextProductId++;
        products[productId] = Product({
            id: productId, brand: brand, name: name, price: price, totalStock: 0, soldStock: 0, active: active
        });

        emit ProductCreated(productId, brand, name, price, active);
    }

    function addStock(uint256 productId, uint256 quantity) external onlyOwner {
        Product storage product = _requireProduct(productId);
        if (quantity == 0) {
            revert InvalidStockQuantity();
        }

        product.totalStock += quantity;

        emit StockAdded(productId, quantity, product.totalStock);
    }

    function setProductActive(uint256 productId, bool active) external onlyOwner {
        Product storage product = _requireProduct(productId);
        product.active = active;

        emit ProductStatusUpdated(productId, active);
    }

    function setFulfiller(address newFulfiller) external onlyOwner {
        address previousFulfiller = fulfiller;
        fulfiller = newFulfiller;

        emit FulfillerUpdated(previousFulfiller, newFulfiller);
    }

    function buyProduct(uint256 productId) external payable returns (uint256 orderId) {
        Product storage product = _requireProduct(productId);
        if (!product.active) {
            revert ProductInactive();
        }
        if (product.totalStock - product.soldStock == 0) {
            revert OutOfStock();
        }
        if (msg.value != product.price) {
            revert IncorrectPayment();
        }

        product.soldStock += 1;

        orderId = nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            productId: productId,
            amountPaid: msg.value,
            status: OrderStatus.Paid,
            voucherHash: bytes32(0),
            createdAt: block.timestamp
        });

        emit OrderPaid(orderId, msg.sender, productId, msg.value);
    }

    function fulfillOrder(uint256 orderId, bytes32 voucherHash) external onlyFulfillmentOperator {
        Order storage order = _requireOrder(orderId);
        if (order.status != OrderStatus.Paid) {
            revert OrderNotPaid();
        }
        if (voucherHash == bytes32(0)) {
            revert EmptyVoucherHash();
        }

        order.status = OrderStatus.Fulfilled;
        order.voucherHash = voucherHash;
        withdrawableRevenue += order.amountPaid;

        emit OrderFulfilled(orderId, voucherHash);
    }

    function refundOrder(uint256 orderId) external onlyFulfillmentOperator {
        Order storage order = _requireOrder(orderId);
        if (order.status != OrderStatus.Paid) {
            revert OrderNotPaid();
        }

        Product storage product = products[order.productId];
        uint256 refundAmount = order.amountPaid;
        address buyer = order.buyer;

        product.soldStock -= 1;
        order.status = OrderStatus.Refunded;

        (bool success,) = buyer.call{value: refundAmount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit OrderRefunded(orderId, buyer, refundAmount);
    }

    function withdrawRevenue(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (amount > withdrawableRevenue) {
            revert InsufficientRevenue();
        }

        withdrawableRevenue -= amount;

        (bool success,) = to.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }

        emit RevenueWithdrawn(to, amount);
    }

    function availableStock(uint256 productId) public view returns (uint256) {
        Product storage product = _requireProduct(productId);
        return product.totalStock - product.soldStock;
    }

    function _requireProduct(uint256 productId) internal view returns (Product storage product) {
        product = products[productId];
        if (product.id == 0) {
            revert InvalidProduct();
        }
    }

    function _requireOrder(uint256 orderId) internal view returns (Order storage order) {
        order = orders[orderId];
        if (order.id == 0) {
            revert InvalidOrder();
        }
    }
}
