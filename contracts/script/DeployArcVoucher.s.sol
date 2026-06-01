// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArcVoucherStore} from "../src/ArcVoucherStore.sol";

interface Vm {
    function envUint(string calldata name) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys ArcVoucherStore. Set PRIVATE_KEY before running with forge script.
contract DeployArcVoucher {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ArcVoucherStore store) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        store = new ArcVoucherStore();
        vm.stopBroadcast();
    }
}
