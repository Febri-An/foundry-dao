// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";

contract HelperConfig is Script {
    struct NetworkConfig {
        uint256 minDelay;
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 quorumPercentage;
        address account;
        address account2;
    }

    NetworkConfig public activeNetworkConfig;

    constructor() {
        if (block.chainid == 11155111) {
            activeNetworkConfig = getSepoliaEthConfig();
        } else {
            activeNetworkConfig = getOrCreateAnvilEthConfig();
        }
    }

    function getConfig() public view returns (NetworkConfig memory) {
        return activeNetworkConfig;
    }

    function getSepoliaEthConfig() public pure returns (NetworkConfig memory) {
        return
            NetworkConfig({
                minDelay: 1, // 1 second
                votingDelay: 1, // 1 block
                votingPeriod: 5, // 5 blocks
                quorumPercentage: 1,
                account: 0xD087B81247bc4bf037c261a827eF81E52e1E796e,
                account2: 0x04f2C067868e2C6C667cB2997FF7f0f2063413FB
            });
    }

    function getOrCreateAnvilEthConfig()
        public
        pure
        returns (NetworkConfig memory)
    {
        return
            NetworkConfig({
                minDelay: 1, // 1 second
                votingDelay: 1, // 1 block
                votingPeriod: 5, // 5 blocks
                quorumPercentage: 1,
                account: 0xD087B81247bc4bf037c261a827eF81E52e1E796e,
                account2: 0x04f2C067868e2C6C667cB2997FF7f0f2063413FB
            });
    }
}
