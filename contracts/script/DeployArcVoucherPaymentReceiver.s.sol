// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherPaymentReceiver} from "../src/ArcVoucherPaymentReceiver.sol";

interface Vm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys ArcVoucherPaymentReceiver for an existing ArcVoucherStore.
contract DeployArcVoucherPaymentReceiver {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ArcVoucherPaymentReceiver receiver) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address store = vm.envAddress("ARC_VOUCHER_STORE_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        receiver = new ArcVoucherPaymentReceiver(store);
        vm.stopBroadcast();
    }
}
