// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

library ScriptConsole {
    address private constant CONSOLE_ADDRESS = 0x000000000000000000636F6e736F6c652e6c6f67;

    function log(string memory message, uint256 value) internal view {
        bytes memory payload = abi.encodeWithSignature("log(string,uint256)", message, value);
        address console = CONSOLE_ADDRESS;

        assembly {
            pop(staticcall(gas(), console, add(payload, 32), mload(payload), 0, 0))
        }
    }
}

/// @notice Adds 100 stock to each seeded ArcVoucher product.
contract AddStockAll {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant STOCK_TO_ADD = 100;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        ArcVoucherStore store = ArcVoucherStore(vm.envAddress("ARC_VOUCHER_STORE_ADDRESS"));

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 productId = 1; productId <= 7; productId++) {
            store.addStock(productId, STOCK_TO_ADD);
            ScriptConsole.log("Added stock 100 to product", productId);
        }

        vm.stopBroadcast();
    }
}
