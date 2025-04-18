// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {MyGovernor} from "src/MyGovernor.sol";
import {Box} from "src/Box.sol";
import {TimeLock} from "src/TimeLock.sol";
import {GovToken} from "src/GovToken.sol";

contract MyGovernorTest is Test {
    MyGovernor governor;
    Box box;
    TimeLock timelock;
    GovToken govToken;

    address USER = makeAddr("user");
    uint256 public constant INITIAL_SUPPLY = 1 ether;
    uint256 public constant MIN_DELAY = 3600; // sec after a vote passes
    uint256 public constant VOTING_DELAY = 1; // blocks till a vote is active
    uint256 public constant VOTING_PERIOD = 50400; // blocks till a vote ends
    address[] proposers;
    address[] executors;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;

    function setUp() public {
        govToken = new GovToken();
        govToken.mint(USER, INITIAL_SUPPLY);

        vm.startBroadcast(USER);
        govToken.delegate(USER);
        timelock = new TimeLock(MIN_DELAY, proposers, executors);
        governor = new MyGovernor(govToken, timelock);

        bytes32 proposerRole = timelock.PROPOSER_ROLE();
        bytes32 executorRole = timelock.EXECUTOR_ROLE();
        bytes32 adminRole = timelock.TIMELOCK_ADMIN_ROLE();

        timelock.grantRole(proposerRole, address(governor));
        timelock.grantRole(executorRole, address(0));
        timelock.revokeRole(adminRole, USER);
        vm.stopBroadcast();

        box = new Box();
        box.transferOwnership(address(timelock));
    }

    function testCantUpdateBoxWithoutGovernance() public {
        vm.expectRevert();
        box.store(1);
    }

    function testGovernanceUpdatesBox() public {
        uint256 valueToStore = 999;
        bytes memory encodedCallData = abi.encodeWithSignature("store(uint256)", valueToStore);
        string memory description = "Store 999 in the box";

        targets.push(address(box));
        values.push(0);
        calldatas.push(encodedCallData);

        
        // 1. Propose to the DAO
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        // view the state
        console.log("Proposal state: ", uint256(governor.state(proposalId)));

        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + VOTING_DELAY + 1);

        console.log("Proposal state: ", uint256(governor.state(proposalId)));

        // 2. Vote
        string memory reason = "I like it";
        uint8 voteWay = 1; // 1 = for, 0 = against
        vm.prank(USER);
        governor.castVoteWithReason(proposalId, voteWay, reason);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.roll(block.number + VOTING_PERIOD + 1);

        // 3. Queue the proposal
        bytes32 descriptionHash = keccak256(abi.encodePacked(description));
        governor.queue(targets, values, calldatas, descriptionHash);

        vm.warp(block.timestamp + MIN_DELAY + 1);
        vm.roll(block.number + MIN_DELAY + 1);

        // 4. Execute the proposal
        governor.execute(targets, values, calldatas, descriptionHash);

        console.log("Box number: ", box.getNumber());
        assertEq(box.getNumber(), valueToStore);
    }
}