// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {GovToken} from "../src/GovToken.sol";
import {TimeLock} from "../src/TimeLock.sol";
import {MyGovernor} from "../src/MyGovernor.sol";
import {Box} from "../src/Box.sol";

contract DeployDAO is Script {
    GovToken govToken;
    TimeLock timelock;
    MyGovernor governor;
    Box box;

    address[] proposers;
    address[] executors;

    function run()
        external
        returns (Box, GovToken, MyGovernor, TimeLock, HelperConfig)
    {
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();

        vm.startBroadcast(config.account);

        // 1. Deploy GovToken
        govToken = new GovToken();

        // Mint initial supply for testing
        uint256 INITIAL_SUPPLY = 1000 * 10 ** 18;
        govToken.mint(config.account, INITIAL_SUPPLY);
        govToken.mint(config.account2, INITIAL_SUPPLY);

        // Self-delegate to unlock voting power for the deployer if they have tokens
        govToken.delegate(config.account);
        // Also delegate for account2 (for testing purposes, we do it via broadcast if we have their pk, or they can do it themselves.
        // But wait, delegate() is a transaction. We are broadcasting as config.account.
        // We can't delegate FOR account2 unless we broadcast as account2.
        // For simplicity in the script, we only delegate for account1.
        // Account2 will need to call delegate(account2) themselves in the UI.

        // 2. Deploy TimeLock
        // We'll leave proposers/executors empty for now and grant later,
        // or we could pass them here. Let's grant them later for cleaner flow.
        timelock = new TimeLock(config.minDelay, proposers, executors);

        // 3. Deploy Governor
        governor = new MyGovernor(govToken, timelock);

        // 4. Setup Roles
        bytes32 proposerRole = timelock.PROPOSER_ROLE();
        bytes32 executorRole = timelock.EXECUTOR_ROLE();
        bytes32 adminRole = timelock.TIMELOCK_ADMIN_ROLE();

        timelock.grantRole(proposerRole, address(governor));
        timelock.grantRole(executorRole, address(0)); // Anyone can execute
        timelock.revokeRole(adminRole, config.account); // Deployer is no longer admin

        // 5. Deploy Box and Transfer Ownership to Timelock
        box = new Box();
        box.transferOwnership(address(timelock));

        vm.stopBroadcast();

        return (box, govToken, governor, timelock, helperConfig);
    }
}
