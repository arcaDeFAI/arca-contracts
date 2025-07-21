# Shadow Integration Plan for Arca

## Executive Summary

This document outlines the plan to add Shadow (Ramses V3) concentrated liquidity support to the existing Arca vault system. The approach maximizes code reuse from the audited Metropolis contracts while adapting to Shadow's NFT-based position management.

## Architecture Overview

### Core Design Principles

1. **Minimal Changes to Audited Code**: Reuse existing vault contracts without modification
2. **NFT Position Management**: Each strategy owns one active NFT position at a time
3. **Unified Interface**: Shadow strategies implement the same IStrategy interface as Metropolis
4. **Direct Integration**: Use Shadow's deployed NonfungiblePositionManager directly

### Key Components

```
┌─────────────────┐     ┌─────────────────┐
│ OracleRewardVault│     │ OracleRewardVault│
│   (Unchanged)    │     │   (Unchanged)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ Uses                  │ Uses
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ MetropolisStrategy│    │  ShadowStrategy  │
│  (Existing)       │    │     (New)        │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ Interacts             │ Owns NFTs
         ▼                       ▼
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
- Cannot partially modify ranges like Metropolis bins

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
- [ ] Create `contracts-metropolis/src/ShadowStrategy.sol`
- [ ] Import and adapt from existing Strategy.sol
- [ ] Add NFT position tracking variables
- [ ] Implement IStrategy interface

#### Step 1.2: Implement Position Management
- [ ] Add `_exitPosition()` internal function
  - [ ] Decrease liquidity to 0
  - [ ] Collect all fees and tokens
  - [ ] Claim gauge rewards if available
  - [ ] Burn NFT (with option to skip)
- [ ] Add `_enterPosition()` internal function
  - [ ] Calculate token amounts
  - [ ] Mint new NFT position
  - [ ] Store position ID

#### Step 1.3: Implement Core Functions
- [ ] `rebalance()` - Main rebalancing logic
  - [ ] Exit current position if exists
  - [ ] Process queued withdrawals
  - [ ] Calculate and apply AUM fees
  - [ ] Enter new position
  - [ ] Emit events
- [ ] `withdrawAll()` - Emergency withdrawal
  - [ ] Exit position without burning NFT
  - [ ] Transfer all tokens to vault
- [ ] `getBalances()` - Calculate total value
  - [ ] Query position liquidity from NFT
  - [ ] Add idle balances

#### Step 1.4: Implement Helper Functions
- [ ] `getRange()` - Return current tick range
- [ ] `hasRewards()` - Check if gauge exists
- [ ] `_harvestRewards()` - Claim and forward rewards
- [ ] `_validateTicks()` - Tick range validation

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

## Next Steps

1. Review and approve this plan
2. Create feature branch for Shadow integration
3. Begin Phase 1 implementation
4. Set up regular sync meetings for progress updates