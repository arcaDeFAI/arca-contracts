# Shadow Vault Withdrawal Flow Analysis & Fix Plan

## Context

This document analyzes the withdrawal flow differences between Metropolis and Shadow vault systems in the Arca protocol, identifies an accounting issue in the Shadow implementation, and provides a concrete fix plan.

## Problem Statement

**Symptom**: After a Shadow vault rebalance, tokens are present in the vault but `getRedeemableAmounts()` returns zero. There's an accounting mismatch between actual token balances and tracked withdrawal amounts.

**Root Cause**: Shadow's "complete position exit" approach conflicts with vault accounting logic that expects only proportional queued withdrawal tokens.

## Metropolis Reference Implementation (Working System)

### Architecture Overview
- **Position Management**: Bin-based liquidity (discrete price ranges)
- **Token Standard**: Uses Liquidity Book (LB) pairs with bin tokens
- **Withdrawal Strategy**: Partial position management - only removes liquidity proportional to queued withdrawals

### Withdrawal Flow (4 Phases)

#### Phase 1: Queue Withdrawal
**Location**: `BaseVault.queueWithdrawal()` (BaseVault.sol:625)

```solidity
// User queues shares for withdrawal
_transfer(msg.sender, strategy, shares);
queuedWithdrawals.totalQueuedShares += shares;
queuedWithdrawals.userWithdrawals[recipient] += shares;
```

#### Phase 2: Strategy Execution During Rebalance
**Location**: `MetropolisStrategy._withdrawAndApplyAumAnnualFee()` (MetropolisStrategy.sol:880)

```solidity
// 1. Calculate proportional amounts for queued withdrawals
(queuedAmountX, queuedAmountY) = totalShares == 0 || queuedShares == 0
    ? (0, 0)
    : (
        queuedShares.mulDivRoundDown(balanceX, totalShares),
        queuedShares.mulDivRoundDown(balanceY, totalShares)
    );

// 2. Remove only necessary liquidity from bins
_withdrawFromLB(removedLower, removedUpper);

// 3. Apply AUM fees
// 4. Transfer ONLY queued amounts to vault
```

#### Phase 3: Vault Execution
**Location**: `BaseVault.executeQueuedWithdrawals()` (BaseVault.sol:816)

```solidity
// Calculate tokens received (expects only queued amounts)
uint256 receivedX = _tokenX().balanceOf(address(this)) - totalAmountX - _rewardX();
uint256 receivedY = _tokenY().balanceOf(address(this)) - totalAmountY - _rewardY();

// Store for user redemption
queuedWithdrawals.totalAmountX = uint128(receivedX);
queuedWithdrawals.totalAmountY = uint128(receivedY);
```

#### Phase 4: User Redemption
**Location**: `BaseVault.redeemQueuedWithdrawal()` (BaseVault.sol:720)

```solidity
// Pro-rata distribution based on user's queued shares
amountX = uint256(queuedWithdrawals.totalAmountX).mulDivRoundDown(shares, totalQueuedShares);
amountY = uint256(queuedWithdrawals.totalAmountY).mulDivRoundDown(shares, totalQueuedShares);
```

### Key Characteristics
- **Proportional Withdrawal**: Only removes liquidity needed for queued withdrawals
- **Direct Operations**: Bin operations are direct (add/remove liquidity)
- **Simple Accounting**: Vault expects to receive exactly what was calculated

## Shadow Implementation Differences

### Architecture Overview
- **Position Management**: NFT-based concentrated liquidity positions
- **Token Standard**: Uses Ramses V3 pools with NonFungiblePositionManager
- **Withdrawal Strategy**: **Complete position exit** - always burns entire NFT position

### Critical Design Decision: Complete Exit Approach

**Philosophy**: Shadow always exits positions completely, processes everything, then re-enters new positions if needed. This approach:
- Simplifies position management (no partial position modifications)
- Ensures clean state between rebalances
- Aligns with NFT-based position architecture

### Withdrawal Flow Differences

#### Phase 2: Strategy Execution (COMPLETELY DIFFERENT)
**Location**: `ShadowStrategy._exitPosition()` (ShadowStrategy.sol:799)

```solidity
// 1. Remove ALL liquidity from NFT position
if (liquidity > 0) {
    npm.decreaseLiquidity(decreaseParams); // Removes all liquidity
}

// 2. Collect ALL tokens (fees + principal)
npm.collect(collectParams);

// 3. Sweep ALL tokens from NPM to strategy
npm.sweepToken(address(_tokenX()), 0, address(this)); // 0 = sweep all
npm.sweepToken(address(_tokenY()), 0, address(this));

// 4. Burn the NFT completely
npm.burn(_positionTokenId);
_positionTokenId = 0; // Reset state
```

#### Current Transfer Logic (THE PROBLEM)
**Location**: `ShadowStrategy._transferAndExecuteQueuedAmounts()` (ShadowStrategy.sol:1144)

```solidity
// Currently tries to send only calculated queued amounts
if (queuedAmountX > 0) _tokenX().safeTransfer(vault, queuedAmountX);
if (queuedAmountY > 0) _tokenY().safeTransfer(vault, queuedAmountY);
```

**The Mismatch**: Strategy exits EVERYTHING but only sends proportional amounts, leaving surplus tokens in strategy that get lost.

## The Accounting Problem

### Current Broken Flow
1. **Shadow Strategy**: Exits entire position (gets 100% of tokens)
2. **Current Transfer**: Sends only queued portion (e.g., 30% of tokens)
3. **Vault Accounting**: Expects to receive only queued portion
4. **Result**: 70% of tokens remain in strategy (lost) OR are transferred but not properly accounted for

### Why Metropolis Works
- Strategy removes exactly what's needed (30% of liquidity)
- Strategy sends exactly what was removed (30% of tokens)
- Vault receives exactly what it expects (30% of tokens)
- Perfect 1:1 correspondence

### Why Shadow Breaks
- Strategy removes 100% of liquidity (complete exit)
- Strategy has 100% of tokens but sends 30% (mismatch)
- Vault receives either 30% (missing tokens) or 100% (accounting error)

## Fix Plan

### Strategy: Embrace Complete Exit, Fix Vault Accounting

**Principle**: Keep Shadow's complete exit approach but make vault accounting handle total withdrawals correctly.

### Implementation Changes

#### 1. Modify Strategy Transfer Logic
**File**: `ShadowStrategy.sol`
**Function**: `_transferAndExecuteQueuedAmounts()`

```solidity
function _transferAndExecuteQueuedAmounts(
    uint256 queuedShares,
    uint256 queuedAmountX, // Remove - not needed
    uint256 queuedAmountY  // Remove - not needed
) private {
    if (queuedShares > 0) {
        address vault = _vault();

        // CHANGE: Send ALL available tokens (complete exit approach)
        uint256 availableX = _tokenX().balanceOf(address(this));
        uint256 availableY = _tokenY().balanceOf(address(this));

        // Debug events
        emit StrategyTokenTransfer(address(_tokenX()), availableX, "Complete exit - sending all X");
        emit StrategyTokenTransfer(address(_tokenY()), availableY, "Complete exit - sending all Y");

        if (availableX > 0) _tokenX().safeTransfer(vault, availableX);
        if (availableY > 0) _tokenY().safeTransfer(vault, availableY);

        IOracleRewardShadowVault(vault).executeQueuedWithdrawals();
    }
}
```

#### 2. Modify Vault Accounting Logic
**File**: `OracleRewardShadowVault.sol`
**Function**: `executeQueuedWithdrawals()`

```solidity
function executeQueuedWithdrawals() public virtual nonReentrant {
    address strategy = address(_strategy);
    if (strategy != msg.sender) revert ShadowVault__OnlyStrategy();

    uint256 round = _queuedWithdrawalsByRound.length - 1;
    QueuedWithdrawal storage queuedWithdrawals = _queuedWithdrawalsByRound[round];

    uint256 totalQueuedShares = queuedWithdrawals.totalQueuedShares;
    if (totalQueuedShares == 0) return;

    _burn(strategy, totalQueuedShares);
    _queuedWithdrawalsByRound.push();

    uint256 totalAmountX = _totalAmountX;
    uint256 totalAmountY = _totalAmountY;

    // Calculate total tokens received from complete exit
    uint256 totalReceivedX = _tokenX().balanceOf(address(this)) - totalAmountX - _rewardX();
    uint256 totalReceivedY = _tokenY().balanceOf(address(this)) - totalAmountY - _rewardY();

    // CRITICAL: Separate queued vs surplus portions
    uint256 totalSharesBeforeBurn = totalSupply() + totalQueuedShares;
    uint256 queuedPortionX = totalReceivedX.mulDivRoundDown(totalQueuedShares, totalSharesBeforeBurn);
    uint256 queuedPortionY = totalReceivedY.mulDivRoundDown(totalQueuedShares, totalSharesBeforeBurn);

    // Store queued portions for user redemption
    queuedWithdrawals.totalAmountX = uint128(queuedPortionX);
    queuedWithdrawals.totalAmountY = uint128(queuedPortionY);

    // Add surplus back to vault totals (remains for future operations)
    uint256 surplusX = totalReceivedX - queuedPortionX;
    uint256 surplusY = totalReceivedY - queuedPortionY;
    _totalAmountX = totalAmountX + surplusX;
    _totalAmountY = totalAmountY + surplusY;

    // Debug events
    emit WithdrawalAccountingDebug(
        totalReceivedX, totalReceivedY,
        queuedPortionX, queuedPortionY,
        totalSharesBeforeBurn, totalQueuedShares
    );
    emit SurplusProcessed(surplusX, surplusY);
    emit WithdrawalExecuted(round, totalQueuedShares, queuedPortionX, queuedPortionY);
}
```

#### 3. Add Debug Events
**File**: `IOracleRewardShadowVault.sol`

```solidity
// Add these events to the interface
event SurplusProcessed(uint256 surplusX, uint256 surplusY);
event WithdrawalAccountingDebug(
    uint256 totalReceived0,
    uint256 totalReceived1,
    uint256 queuedPortion0,
    uint256 queuedPortion1,
    uint256 totalShares,
    uint256 queuedShares
);
event StrategyTokenTransfer(
    address indexed token,
    uint256 amount,
    string description
);
```

### Testing Strategy

#### 1. Debug Event Monitoring
Monitor these events to verify correct accounting:
- `WithdrawalAccountingDebug`: Verify proportional calculations
- `SurplusProcessed`: Confirm surplus tokens are retained
- `StrategyTokenTransfer`: Track token movements

#### 2. Test Scenarios
1. **Single User Withdrawal**: Queue 30% of shares, verify only 30% is redeemable
2. **Multiple User Withdrawal**: Queue different amounts, verify proportional redemption
3. **Complete Withdrawal**: Queue 100% of shares, verify all tokens are redeemable
4. **Rebalance After Withdrawal**: Verify surplus tokens are available for new positions

#### 3. Accounting Verification
Before/after each test:
```solidity
// Check total balances match expectations
uint256 vaultTotalX = _totalAmountX + _rewardX();
uint256 vaultTotalY = _totalAmountY + _rewardY();
uint256 actualBalanceX = _tokenX().balanceOf(address(this));
uint256 actualBalanceY = _tokenY().balanceOf(address(this));
// actualBalanceX should equal vaultTotalX
```

## Risk Assessment

### Low Risk Changes
- Debug event additions
- Strategy transfer logic modification (already working with complete exit)

### Medium Risk Changes
- Vault accounting logic (core financial calculations)
- New proportional calculation logic

### Mitigation Strategies
1. **Extensive Testing**: Test all withdrawal scenarios on testnet
2. **Event Monitoring**: Deploy with comprehensive logging
3. **Gradual Rollout**: Test with small amounts first
4. **Fallback Plan**: Keep ability to revert to current implementation

## Files to Modify

1. **contracts-shadow/src/ShadowStrategy.sol**
   - Modify `_transferAndExecuteQueuedAmounts()` (~line 1144)
   - Add debug events

2. **contracts-shadow/src/OracleRewardShadowVault.sol**
   - Modify `executeQueuedWithdrawals()` (~line 594)
   - Add accounting logic for surplus handling

3. **contracts-shadow/src/interfaces/IOracleRewardShadowVault.sol**
   - Add new debug event definitions

## Success Criteria

- [ ] `getRedeemableAmounts()` returns correct proportional amounts
- [ ] No tokens are lost in strategy after complete exit
- [ ] Surplus tokens remain in vault for future operations
- [ ] Multiple users can redeem proportional amounts correctly
- [ ] Debug events provide clear audit trail of token movements

## Next Steps

1. Implement changes in development environment
2. Deploy comprehensive tests with debug events
3. Verify accounting with multiple withdrawal scenarios
4. Deploy to testnet for integration testing
5. Monitor debug events to confirm correct operation
6. Deploy to mainnet with continued monitoring

This fix preserves Shadow's architectural decision to completely exit positions while ensuring proper vault accounting that matches user expectations for withdrawal redemption.