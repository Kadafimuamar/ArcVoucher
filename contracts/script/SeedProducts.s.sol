// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Seeds demo ArcVoucher products on an already deployed ArcVoucherStore.
contract SeedProducts {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        ArcVoucherStore store = ArcVoucherStore(vm.envAddress("ARC_VOUCHER_STORE_ADDRESS"));

        vm.startBroadcast(deployerPrivateKey);

        _addProductWithStock(store, "Steam", "Steam Gift Card $10", 10 ether, 10);
        _addProductWithStock(store, "Epic Games", "Epic Games Gift Card $10", 10 ether, 8);
        _addProductWithStock(store, "Amazon", "Amazon Gift Card $25", 25 ether, 5);
        _addProductWithStock(store, "Google Play", "Google Play Gift Card $10", 10 ether, 12);
        _addProductWithStock(store, "Apple", "Apple Gift Card $15", 15 ether, 7);
        _addProductWithStock(store, "Netflix", "Netflix Gift Card $15", 15 ether, 6);
        _addProductWithStock(store, "Spotify", "Spotify Gift Card $10", 10 ether, 9);

        vm.stopBroadcast();
    }

    function _addProductWithStock(
        ArcVoucherStore store,
        string memory brand,
        string memory name,
        uint256 price,
        uint256 stock
    ) private {
        uint256 productId = store.addProduct(brand, name, price, true);
        store.addStock(productId, stock);
    }
}
