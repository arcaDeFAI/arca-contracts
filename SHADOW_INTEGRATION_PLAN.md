# Shadow Integration Plan for Arca (MVP)

## Executive Summary

This document outlines the plan to add Shadow (Ramses V3) concentrated liquidity support to the existing Arca vault system. The approach maximizes code reuse from the audited Metropolis contracts while adapting to Shadow's NFT-based position management. This MVP prioritizes simplicity and correctness over gas optimization.

**Current Status**: Factory integration complete. Deployment scripts updated. Critical architectural issues identified that need resolution before production use.

## Critical Issues & Decisions Required

### 1. Solidity Version Compatibility (RESOLVED ✅)
- **Issue**: Metropolis contracts use Solidity 0.8.10, Shadow uses ^0.8.26
- **Solution Implemented**: Upgraded all contracts to 0.8.26. Complete.

### 2. Parameter Type Mismatch (RESOLVED ✅)
- **Issue**: Metropolis uses uint24 for bins, Shadow uses int24 for ticks (can be negative)
- **Solution Implemented**: Unified interface using int32 parameters
  - IStrategy interface now uses int32 for all tick/bin parameters
  - Metropolis validates non-negative and converts to uint24 internally
  - Shadow validates tick bounds and converts to int24 internally
  - Clean type conversions without overflow/underflow risks
- **Benefits**:
  - Single interface works for both strategy types
  - Python bot can send negative ticks for Shadow vaults
  - Future-proof for any tick/bin range

### 3. License Compatibility (RESOLVED ✅)
- **Issue**: Shadow uses GPL-3.0 and BUSL-1.1, project was MIT
- **Solution**: 
  - Changed project to GPL-3.0
  - Created clean-room minimal interfaces to avoid BUSL-1.1 dependencies
  - Must delete all BUSL-1.1 files from repo
- **Status**: ✅ Minimal interfaces created (IMinimalVoter, IMinimalGauge). Complete.

## Current Implementation Status

### Completed Work

1. **ShadowStrategy.sol** (contracts-shadow/src/ShadowStrategy.sol)
   - ✅ Position state tracking variables
   - ✅ _exitPosition() - full position exit with NFT burn
   - ✅ _enterPosition() - new position creation
   - ✅ rebalance() - Shadow-specific rebalance using int32 params
   - ✅ withdrawAll() - emergency withdrawal
   - ✅ _getBalances() - position value calculation with math libraries
   - ✅ Tick validation helpers
   - ✅ Basic reward claiming structure
   - ⚠️ ISSUE: Inherits from Strategy which expects LBPair immutable data

2. **Minimal Interfaces** (contracts-shadow/src/interfaces/)
   - ✅ IMinimalVoter.sol - GPL-3.0 replacement for BUSL-1.1 IVoter
   - ✅ IMinimalGauge.sol - GPL-3.0 replacement for BUSL-1.1 IGaugeV3

3. **Configuration Updates**
   - ✅ Updated hardhat.config.ts to include Shadow contracts
   - ✅ Compilation successful with version 0.8.26

4. **Interface Updates** 
   - ✅ IStrategy.sol - Updated to use int32 for all tick/bin parameters
   - ✅ Strategy.sol - Accepts int32, validates non-negative, converts to uint24
   - ✅ ShadowStrategy.sol - Accepts int32, validates tick bounds, converts to int24

### Completed Work (Phase 2)

4. **Factory Integration** ✅
   - [x] Added NPM and Voter addresses to VaultFactory interface and implementation
   - [x] Added getShadowNonfungiblePositionManager() and getShadowVoter() getters
   - [x] Added setShadowNonfungiblePositionManager() and setShadowVoter() setters
   - [x] Added createShadowStrategy() and createOracleVaultAndShadowStrategy() functions
   - [x] Added Shadow to StrategyType enum

5. **Deployment Scripts** ✅
   - [x] Enhanced deploy-metropolis.ts to deploy ShadowStrategy implementation
   - [x] Added Shadow protocol address configuration
   - [x] Updated deployment artifacts to include Shadow addresses
   - [x] Created create-shadow-vault.ts template script
   - [x] Updated verify-metropolis.ts to verify Shadow contracts

### Critical Issues - Resolution Status

1. **LBPair Interface Mismatch** (RESOLVED ✅)
   - **Solution**: Created separate Shadow vault contracts instead of forcing abstraction
   - BaseShadowVault uses IRamsesV3Pool instead of ILBPair
   - Factory will deploy appropriate vault type based on DEX

2. **Missing Pool Factory Address** (RESOLVED ✅)
   - **Solution**: No additional storage needed
   - Pool factory address is obtained from `npm.deployer()` 
   - ShadowStrategy correctly implements this in `_getPoolAddress()`

3. **Vault Contract Compatibility** (RESOLVED ✅)
   - **Solution**: Separate vault implementations for Shadow
   - No modifications to audited Metropolis vaults
   - Clean separation of concerns

4. **Strategy Inheritance Issue** (NEW)
   - **Issue**: ShadowStrategy inherits from Strategy which expects LBPair data
   - **Solution**: Create new interface hierarchy
   - ShadowStrategy should not inherit from Strategy

## Architecture Overview - Updated

### Core Design Principles

1. **Separate Vault Implementations**: Shadow has its own vault contracts to avoid modifying audited code
2. **NFT Position Management**: Each strategy owns one active NFT position at a time
3. **Unified Interface**: Shadow strategies implement the same IStrategy interface as Metropolis
4. **Direct Integration**: Use Shadow's deployed NonfungiblePositionManager directly

### Key Components

```
┌──────────────────┐     ┌──────────────────────┐
│ OracleRewardVault│     │OracleRewardShadowVault│
│   (Metropolis)   │     │      (Shadow)         │
└────────┬─────────┘     └────────┬───────────┘
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
                        │   + Gauge       │
                        └─────────────────┘
```

### Vault Architecture Decision

**Approach**: Separate Shadow vault implementations
- **Rationale**: Avoids modifying audited Metropolis contracts
- **Benefits**: Clean separation, protocol-specific optimizations
- **Trade-off**: Some code duplication, mitigated by shared libraries

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
- Gauge address obtained from Voter contract using pool address

**Implementation Details**:
- ShadowStrategy owns NFT and claims rewards from gauge
- Rewards forwarded to OracleRewardShadowVault
- Vault distributes rewards to users using phantom shares accounting
- Same distribution pattern as Metropolis, different reward source

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

## Implementation Progress

### Phase 1: Core Strategy Implementation ✅
- [x] ShadowStrategy contract fully implemented
- [x] Position management (enter/exit/rebalance)
- [x] NFT lifecycle management
- [x] Value calculations using LiquidityAmounts
- [x] Reward claiming structure

### Phase 2: Factory Integration ✅
- [x] VaultFactory updated with Shadow support
- [x] Deployment scripts enhanced
- [x] Verification scripts updated

### Phase 3: Architecture Resolution - Revised Approach 🚧

#### Step 3.1: Shadow Vault Implementation ✅
- [x] Created BaseShadowVault.sol - Core vault functionality adapted for Shadow pools
- [x] Created OracleShadowVault.sol - Oracle pricing for Shadow vaults  
- [x] Created OracleRewardShadowVault.sol - Reward distribution for Shadow
- [x] Created IShadowVault interface extending IBaseVault
- [x] Implemented proper _harvestRewards() in ShadowStrategy using gauge rewards

#### Step 3.2: Factory Integration ✅
- [x] Add ShadowOracle and ShadowOracleReward to VaultType enum
- [x] Add Shadow NPM and Voter address storage and setters
- [x] Pool factory configuration (not needed - obtained from NPM)
- [x] Remove half-baked Shadow methods from factory

#### Step 3.3: Strategy Refactoring (NEW)
- [ ] Create IStrategyCommon interface with shared methods
- [ ] Rename IStrategy to IStrategyMetropolis
- [ ] Create IShadowStrategy interface
- [ ] Update ShadowStrategy to implement IShadowStrategy directly (no inheritance)
- [ ] Update VaultFactory to use IStrategyCommon where appropriate
- [ ] Update vault interfaces to return IStrategyCommon

#### Step 3.4: Factory Methods
- [ ] Create proper Shadow vault creation methods
- [ ] Add Shadow strategy creation that doesn't expect LBPair
- [ ] Update deployment scripts for Shadow vaults
- [ ] Create comprehensive test suite for Shadow components

### Phase 4: Testing Infrastructure
- [ ] Mock contracts for Shadow components
- [ ] Unit tests for position lifecycle
- [ ] Integration tests with vault
- [ ] Gas optimization analysis

### Phase 5: Production Readiness
- [ ] Resolve all critical issues
- [ ] Complete testing suite
- [ ] Security review
- [ ] Documentation update

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

## Next Steps

### Priority 1: Strategy Refactoring
1. **Create Interface Hierarchy**
   - Extract IStrategyCommon from current IStrategy
   - Create IStrategyMetropolis and IShadowStrategy
   - Update existing contracts to use new interfaces

2. **Fix ShadowStrategy**
   - Remove inheritance from Strategy base class
   - Implement IShadowStrategy directly
   - Define proper immutable data layout for Shadow

### Priority 2: Factory Integration
1. **Create Shadow Methods**
   - Add createShadowOracleVault() that accepts pool address
   - Add createShadowStrategy() with correct data layout
   - Ensure no LBPair dependencies

2. **Deployment Scripts**
   - Deploy Shadow vault implementations
   - Configure factory with Shadow addresses
   - Complete create-shadow-vault.ts script

### Priority 2: Testing
- Implement comprehensive test suite once architecture issues resolved
- Focus on integration testing with mock contracts

### Priority 3: Production Deployment
- Complete security review
- Deploy to testnet
- Mainnet deployment

## Technical Notes
- **Tick Range**: -887,272 to +887,272 (validated in _validateTicks)
- **Gas**: NFT operations more expensive than bin adjustments
- **Architecture**: Current design too coupled to Metropolis patterns