// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherIntentPaymentReceiver} from "../src/ArcVoucherIntentPaymentReceiver.sol";

interface IntentReceiverDeployVm {
    function envAddress(string calldata name) external returns (address);
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys ArcVoucherIntentPaymentReceiver for an existing ArcVoucherStore.
contract DeployArcVoucherIntentPaymentReceiver {
    IntentReceiverDeployVm private constant vm =
        IntentReceiverDeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ArcVoucherIntentPaymentReceiver receiver) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address store = vm.envAddress("ARC_VOUCHER_STORE_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        receiver = new ArcVoucherIntentPaymentReceiver(store);
        vm.stopBroadcast();
    }
}
