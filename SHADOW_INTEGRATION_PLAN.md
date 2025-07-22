# Shadow Integration Plan for Arca (MVP)

## Executive Summary

This document outlines the plan to add Shadow (Ramses V3) concentrated liquidity support to the existing Arca vault system. The approach maximizes code reuse from the audited Metropolis contracts while adapting to Shadow's NFT-based position management. This MVP prioritizes simplicity and correctness over gas optimization.

**Current Status**: Core implementation complete, blocked on version compatibility issues.

## Critical Issues & Decisions Required

### 1. Solidity Version Compatibility (BLOCKING)
- **Issue**: Metropolis contracts use Solidity 0.8.10, Shadow uses ^0.8.26
- **Impact**: Cannot directly inherit Strategy.sol when importing Shadow interfaces
- **Specific Problems**:
  - Cannot import TickMath, FullMath, LiquidityAmounts libraries (version mismatch)
  - Cannot compile ShadowStrategy that inherits from Strategy.sol
- **Options**:
  1. **Aggregation Pattern**: ShadowStrategy holds a reference to Strategy instead of inheriting
  2. **Minimal Interfaces**: Create 0.8.10-compatible interfaces for Shadow contracts
  3. **Fork Libraries**: Copy needed math functions into 0.8.10-compatible libraries
  4. **Upgrade Metropolis**: Update all contracts to 0.8.26 (requires re-audit)
- **Recommendation**: Aggregation pattern maintains audit assumptions while allowing version flexibility

### 2. License Compatibility (RESOLVED)
- **Issue**: Shadow uses GPL-3.0 and BUSL-1.1, project was MIT
- **Solution**: 
  - Changed project to GPL-3.0
  - Created clean-room minimal interfaces to avoid BUSL-1.1 dependencies
  - Must delete all BUSL-1.1 files from repo
- **Status**: Minimal interfaces created (IMinimalVoter, IMinimalGauge)
- **TODO**: Update all MIT SPDX headers to GPL-3.0 across the codebase

## Current Implementation Status

### Completed Work

1. **ShadowStrategy.sol** (contracts-shadow/src/ShadowStrategy.sol)
   - ✅ Position state tracking variables
   - ✅ _exitPosition() - full position exit with NFT burn
   - ✅ _enterPosition() - new position creation
   - ✅ rebalanceShadow() - Shadow-specific rebalance function
   - ✅ withdrawAll() - emergency withdrawal
   - ✅ _getBalances() - position value calculation (needs math libraries)
   - ✅ Tick validation helpers
   - ✅ Basic reward claiming structure

2. **Minimal Interfaces** (contracts-shadow/src/interfaces/)
   - ✅ IMinimalVoter.sol - GPL-3.0 replacement for BUSL-1.1 IVoter
   - ✅ IMinimalGauge.sol - GPL-3.0 replacement for BUSL-1.1 IGaugeV3

3. **Configuration Updates**
   - ✅ Updated hardhat.config.ts to include Shadow contracts
   - ❌ Compilation blocked due to version conflicts

### Blocked Work

1. **Math Libraries**
   - Need TickMath.getSqrtRatioAtTick() for position value calculation
   - Need MIN_TICK and MAX_TICK constants
   - Need LiquidityAmounts.getAmountsForLiquidity()

2. **Pool Address Calculation**
   - Need PoolAddress library or equivalent
   - Currently using placeholder address(0) in _getPoolAddress()

3. **Factory Integration**
   - Need to add NPM and Voter addresses to VaultFactory
   - Need deployment functions for Shadow strategies

## Architecture Overview

### Core Design Principles

1. **Minimal Changes to Audited Code**: Reuse existing vault contracts without modification
2. **NFT Position Management**: Each strategy owns one active NFT position at a time
3. **Unified Interface**: Shadow strategies implement the same IStrategy interface as Metropolis
4. **Direct Integration**: Use Shadow's deployed NonfungiblePositionManager directly

### Key Components

```
┌──────────────────┐     ┌──────────────────┐
│ OracleRewardVault│     │ OracleRewardVault│
│   (Unchanged)    │     │   (Unchanged)    │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │ Uses                   │ Uses
         ▼                        ▼
┌───────────────────┐     ┌──────────────────┐
│ MetropolisStrategy│     │  ShadowStrategy  │
│  (Existing)       │     │     (New)        │
└────────┬──────────┘     └─────────┬────────┘
         │                          │
         │ Interacts                │ Owns NFTs
         ▼                          ▼
┌─────────────────┐     ┌─────────────────────┐
│  LB Pair (Bins) │     │ NonfungiblePosition │
│                 │     │      Manager        │
└─────────────────┘     └──────────┬──────────┘
                                   │
                                   │ Manages
                                   ▼
                        ┌─────────────────┐
                        │ Shadow V3 Pool  │
                        └─────────────────┘
```

## Design Considerations

### 1. NFT Lifecycle Management

**Decision**: Burn old NFTs after rebalancing
- **Rationale**: Keeps contract state clean, prevents NFT accumulation
- **Alternative**: Keep NFTs for historical tracking (can be added later if needed)

### 2. Position Range Management

**Shadow's Model**:
- Positions have immutable tick ranges (tickLower, tickUpper)
- To change range: must exit position completely and create new one
- Cannot partially modify ranges like Metropolis binsR

**Implications**:
- Each rebalance creates a new NFT
- Must handle full position exit/entry atomically
- Gas costs higher than Metropolis bin adjustments

### 3. Reward Integration

**Shadow Gauge Rewards**:
- Claimed via `NonfungiblePositionManager.getReward(tokenId, tokens[])`
- Rewards accrue to specific NFT positions
- Must claim before burning NFT

**Integration Plan**:
- Claim rewards during each rebalance
- Forward rewards to vault for distribution
- Support multiple reward tokens like Metropolis

### 4. Rebalancing Interface

**Current Metropolis**:
```solidity
rebalance(uint256 lowerRange, uint256 upperRange, bytes distributions, ...)
```

**Proposed Shadow**:
```solidity
rebalance(int24 tickLower, int24 tickUpper, uint24 slippageActiveId)
```

**Bot Integration**:
- Python bot provides tick values directly
- Bot calculates optimal tick range off-chain
- Slippage protection via current tick check

### 5. Error Handling

**Key Failure Points**:
- NFT mint fails due to invalid ticks
- Position manager paused/upgraded
- Gauge not yet deployed
- Insufficient liquidity for range

**Mitigation**:
- Validate tick ranges before operations
- Graceful handling of missing gauges
- Emergency withdrawal without burning NFT

## Implementation Steps

### Phase 1: Core Strategy Implementation

#### Step 1.1: Create ShadowStrategy Base Contract
- [x] Create `contracts-shadow/src/ShadowStrategy.sol`
- [x] Import and adapt from existing Strategy.sol
- [x] Add NFT position tracking variables
- [x] Implement IStrategy interface (attempted, blocked by version)

#### Step 1.2: Implement Position Management
- [x] Add `_exitPosition()` internal function
  - [x] Decrease liquidity to 0
  - [x] Collect all fees and tokens
  - [x] Claim gauge rewards if available
  - [x] Burn NFT
- [x] Add `_enterPosition()` internal function
  - [x] Approve tokens to NPM
  - [x] Mint new NFT position
  - [x] Store position ID
  - [x] Remove approvals after mint

#### Step 1.3: Implement Core Functions
- [x] `rebalanceShadow()` - Shadow-specific rebalancing
  - [x] Exit current position if exists
  - [x] Process queued withdrawals
  - [x] Apply AUM fees (inherited)
  - [x] Enter new position
  - [x] Emit events
- [x] `withdrawAll()` - Emergency withdrawal
  - [x] Exit position completely
  - [x] Transfer all tokens to vault
  - [x] Execute queued withdrawals
- [x] `_getBalances()` - Calculate total value
  - [x] Query position liquidity from NFT
  - [x] Add idle balances
  - [ ] BLOCKED: Need math libraries for calculation

#### Step 1.4: Implement Helper Functions
- [x] `getRange()` - Return current tick range (compatibility hack)
- [x] `hasRewards()` - Check if gauge exists
- [x] `_claimRewards()` - Basic reward claiming
- [x] `_validateTicks()` - Tick range validation
- [x] `_getPoolAddress()` - Pool address calculation (needs deployer)

### Phase 2: Factory Integration

#### Step 2.1: Update VaultFactory
- [ ] Add Shadow strategy deployment logic
- [ ] Create `deployVaultAndShadowStrategy()` function
- [ ] Add Shadow-specific configuration parameters

#### Step 2.2: Create Deployment Helpers
- [ ] Add `IShadowStrategy` interface
- [ ] Update deployment scripts
- [ ] Add Shadow pool verification logic

### Phase 3: Testing Infrastructure

#### Step 3.1: Create Mock Contracts
- [ ] `MockNonfungiblePositionManager.sol`
- [ ] `MockShadowV3Pool.sol`
- [ ] `MockGaugeV3.sol`

#### Step 3.2: Write Unit Tests
- [ ] Position lifecycle tests
- [ ] Rebalancing scenarios
- [ ] Reward claiming tests
- [ ] Emergency withdrawal tests
- [ ] Edge cases and error conditions

#### Step 3.3: Integration Tests
- [ ] Full vault + strategy integration
- [ ] Multi-user scenarios
- [ ] Fee calculation accuracy
- [ ] Gas optimization tests

### Phase 4: Deployment & Integration

#### Step 4.1: Testnet Deployment
- [ ] Deploy ShadowStrategy implementation
- [ ] Deploy test vaults with Shadow strategies
- [ ] Verify contract interactions

#### Step 4.2: Bot Integration
- [ ] Update Python bot for Shadow rebalancing
- [ ] Add tick calculation logic
- [ ] Test rebalancing automation

#### Step 4.3: UI Integration
- [ ] Add Shadow vault display
- [ ] Show position ranges in UI
- [ ] Display gauge rewards

### Phase 5: Documentation & Audit Prep

#### Step 5.1: Technical Documentation
- [ ] Document Shadow-specific functions
- [ ] Create integration guide
- [ ] Add code comments

#### Step 5.2: Audit Preparation
- [ ] Prepare diff report vs Metropolis
- [ ] Document security considerations
- [ ] Create test scenarios document

## Risk Analysis

### Technical Risks

1. **NFT Gas Costs**
   - **Risk**: Higher gas for NFT operations
   - **Mitigation**: Optimize rebalancing frequency

2. **Position Manager Changes**
   - **Risk**: Shadow upgrades contract
   - **Mitigation**: Monitor for changes, upgradeable design

3. **Tick Range Precision**
   - **Risk**: Calculation errors in tick conversion
   - **Mitigation**: Extensive testing, validation

### Operational Risks

1. **Bot Compatibility**
   - **Risk**: Python bot tick calculation issues
   - **Mitigation**: Thorough testing, gradual rollout

2. **Liquidity Fragmentation**
   - **Risk**: Suboptimal range selection
   - **Mitigation**: Data-driven range optimization

## Success Criteria

1. **Functional Requirements**
   - [ ] Users can deposit/withdraw from Shadow vaults
   - [ ] Bot can rebalance Shadow positions
   - [ ] Rewards are properly distributed
   - [ ] Emergency functions work correctly

2. **Performance Metrics**
   - [ ] Gas costs within 2x of Metropolis
   - [ ] Rebalancing success rate > 99%
   - [ ] No locked funds scenarios

3. **Code Quality**
   - [ ] 100% test coverage for new code
   - [ ] No high/critical audit findings
   - [ ] Clean integration with existing system

## Timeline Estimate

- **Phase 1**: 1 week - Core implementation
- **Phase 2**: 3 days - Factory integration  
- **Phase 3**: 1 week - Testing
- **Phase 4**: 3 days - Deployment
- **Phase 5**: 3 days - Documentation

**Total**: ~3 weeks for MVP

## Handoff: What's Next

### Blocker: Version Compatibility
**Problem**: Can't compile - Strategy.sol (0.8.10) vs Shadow imports (^0.8.26)

**Option 1 - Aggregation (Recommended)**:
```solidity
contract ShadowStrategy { // No inheritance
    IStrategy private strategy; // Delegate to existing strategy
    // Shadow-specific logic here
}
```

**Option 2 - Port Math Libraries**:
- Copy only needed functions to 0.8.10
- MIN_TICK = -887272, MAX_TICK = 887272
- getSqrtRatioAtTick() and getAmountsForLiquidity()

### Immediate TODOs
1. Delete all BUSL-1.1 files from contracts-shadow/
2. Update factory with NPM/Voter/Deployer addresses
3. Fix _getPoolAddress() - needs deployer from NPM
4. Decide on version solution and implement

### What's Working
- Position management (_exitPosition, _enterPosition)
- Rebalancing flow (rebalanceShadow)
- Clean-room interfaces (IMinimalVoter, IMinimalGauge)
- GPL-3.0 licensing structure

### What's Missing
- Math libraries (blocked by version)
- Factory integration
- Tests
- Deployment scripts