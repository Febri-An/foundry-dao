# DAO Governance Smart Contract Suite

This project is a fully on-chain governance system built with Solidity and **OpenZeppelin's modular governance framework**. It simulates a real DAO flow involving proposal creation, voting, time-delayed execution, and on-chain contract state mutation (writing to a `Box` contract).

## ✨ Key Features
- **Upgradeable Governance System** using `Governor`, `TimeLock`, and `Votes`
- **ERC20 Governance Token** with snapshot & permit support
- **Ownership Transfer** to Timelock for decentralized execution
- **Proposal Life Cycle Test** that walks through a full DAO proposal


## 🏠 Contracts Overview

### `Box.sol`
A simple contract that holds a single `uint256` number. It is the target of governance proposals.
```solidity
function store(uint256 newNumber) external onlyOwner;
function getNumber() external view returns (uint256);
```

### `GovToken.sol`
ERC20 governance token with voting and snapshot capability using OpenZeppelin's `ERC20Votes` extension. Used to participate in proposals.
```solidity
function mint(address to, uint256 amount) external;
function delegate(address delegatee) external;
```

### `TimeLock.sol`
Handles execution delay of governance decisions. Acts as the owner of the `Box` contract.
```solidity
constructor(uint256 minDelay, address[] memory proposers, address[] memory executors);
```

### `MyGovernor.sol`
The DAO's brain. Inherits all logic to manage proposals, quorum, voting, timelock, and execution.

Key extensions:
- `GovernorSettings`
- `GovernorVotes`
- `GovernorVotesQuorumFraction`
- `GovernorTimelockControl`
- `GovernorCountingSimple`


## 📅 Test Flow: `testGovernanceUpdatesBox`

This test simulates a complete DAO interaction cycle:

1. **Propose**
```solidity
uint256 proposalId = governor.propose(targets, values, calldatas, description);
```
Create a proposal to call `box.store(999)`.

2. **Voting Delay**
Time is advanced to skip the voting delay.
```solidity
vm.warp(block.timestamp + VOTING_DELAY + 1);
```

3. **Vote**
```solidity
governor.castVoteWithReason(proposalId, 1, "I like it");
```
`USER` casts a "for" vote with a reason.

4. **Voting Period Ends**
Time is advanced to skip the voting period.

5. **Queue**
```solidity
governor.queue(targets, values, calldatas, descriptionHash);
```
The proposal is queued in the timelock.

6. **Execution Delay**
Time is advanced past the `MIN_DELAY`.

7. **Execute**
```solidity
governor.execute(targets, values, calldatas, descriptionHash);
```
Proposal is executed by the timelock, which calls `box.store(999)`.

8. **Assert State**
```solidity
assertEq(box.getNumber(), 999);
```
Success: the `Box` state has changed.


## 🚀 How to Use

1. Install dependencies
```bash
forge install OpenZeppelin/openzeppelin-contracts@5.3.0 --no-commit
```

2. Run tests
```bash
forge test
```

3. (Optional) Deploy contracts and simulate on testnet using `forge script`


## 🔧 Tech Stack
- Solidity ^0.8.18
- Foundry (Forge)
- OpenZeppelin Contracts 4.x
- Hardhat-compatible Governance modules


## 📚 Learn More
- [OpenZeppelin Governor Docs](https://docs.openzeppelin.com/contracts/4.x/governance)
- [Solidity by Example: Governance](https://solidity-by-example.org/app/governance/)


## 🌟 Credits
Made with love by a passionate Web3 builder looking to decentralize control, one `propose()` at a time.

Happy BUIDLing ✨


> "Don't trust. Verify. Then delegate."

