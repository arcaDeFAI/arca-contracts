# Shadow Strategy NPM-Centric Refactor Plan

## Executive Summary

This document outlines a comprehensive refactor of the Shadow Strategy to maximize reliance on the NonfungiblePositionManager (NPM) while intelligently leveraging the gauge for reward management. The refactor evolves the reward interface to support multiple tokens, adds comprehensive monitoring, and emphasizes defensive programming when interacting with external contracts.

## Goals

1. **Maximize NPM Usage**: Use NPM as the primary interface for all position-related operations
2. **Evolve Reward Interface**: Change from single to multiple reward tokens support
3. **Defensive External Interactions**: Robust error handling for all gauge/NPM calls
4. **Comprehensive Monitoring**: Add events for debugging and production monitoring
5. **Handle xSHADOW**: Use gauge's built-in conversion functionality

## Current Issues

1. **Strategy reports `hasRewards() = true` but `getRewardToken()` reverts**
2. **Single reward token model doesn't fit Shadow's multiple rewards**
3. **xSHADOW tokens would be stuck in strategy (non-transferable)**
4. **Lack of visibility into reward operations**

## Architecture Overview

### NPM Responsibilities (Trusted Audited Code)
- Position creation/deletion (`mint`, `burn`)
- Liquidity management (`increaseLiquidity`, `decreaseLiquidity`)
- Fee collection (`collect`)
- Position data queries (`positions`)

### Gauge Responsibilities (Rewards Only)
- Reward token discovery (`rewardsList`)
- Earned amount queries (`earned`)
- Reward claiming with xSHADOW conversion (`getRewardAndExit`)

### Strategy Responsibilities
- Orchestration of NPM calls
- Single position tracking (`_positionTokenId`)
- Rebalancing logic
- Reward discovery and forwarding

## Implementation Plan

### Step 1: Evolve IStrategyCommon Interface

Add new method while keeping backward compatibility:

```solidity
// In IStrategyCommon
interface IStrategyCommon {
    
    // NEW: Returns array of reward token addresses
    // Replaces getRewardToken() and getExtraRewardToken() in IStrategyCommon
    function getRewardTokens() external view returns (address[] memory);
}
```

### Step 2: Update IMinimalGauge Interface

Create a minimal gauge interface with defensive programming in mind:

```solidity
// contracts-shadow/src/interfaces/IMinimalGauge.sol
interface IMinimalGauge {
    // Core reward functions
    function rewardsList() external view returns (address[] memory);
    function earned(address token, address account) external view returns (uint256);
    function getReward(address account, address[] calldata tokens) external;
    function getRewardAndExit(address account, address[] calldata tokens) external;
    
    // For monitoring
    function rewardData(address token) external view returns (
        uint256 rewardRate,
        uint256 periodFinish,
        uint256 lastUpdateTime,
        uint256 rewardPerTokenStored
    );
}
```

### Step 3: Add Comprehensive Events

```solidity
// Add to ShadowStrategy.sol

// Reward discovery and claiming events
event RewardTokensDiscovered(address[] tokens);
event RewardEarned(address indexed token, uint256 amount);
event RewardClaimed(address indexed token, uint256 amount);
event RewardForwarded(address indexed token, address indexed vault, uint256 amount);

// Error events for monitoring
event RewardDiscoveryFailed(address gauge);
event RewardClaimFailed(address[] tokens);
event XShadowConversionFailed();

// Position events (existing)
event PositionMinted(uint256 indexed tokenId, int24 tickLower, int24 tickUpper, uint128 liquidity);
event PositionBurned(uint256 indexed tokenId);
```

### Step 4: Implement getRewardTokens() with Defensive Programming

```solidity
function getRewardTokens() external view returns (address[] memory) {
    // Early return if no position
    if (_positionTokenId == 0) {
        return new address[](0);
    }
    
    // Defensive: Wrap all external calls in try-catch
    IMinimalVoter voter;
    try _factory.getShadowVoter() returns (address voterAddress) {
        if (voterAddress == address(0)) {
            return new address[](0);
        }
        voter = IMinimalVoter(voterAddress);
    } catch {
        // Factory call failed
        return new address[](0);
    }
    
    // Get gauge address defensively
    address gaugeAddress;
    try voter.gaugeForPool(address(_pool())) returns (address gauge) {
        gaugeAddress = gauge;
    } catch {
        // Voter call failed
        emit RewardDiscoveryFailed(address(0));
        return new address[](0);
    }
    
    if (gaugeAddress == address(0)) {
        return new address[](0);
    }
    
    // Get reward list defensively
    try IMinimalGauge(gaugeAddress).rewardsList() returns (address[] memory tokens) {
        emit RewardTokensDiscovered(tokens);
        return tokens;
    } catch {
        emit RewardDiscoveryFailed(gaugeAddress);
        return new address[](0);
    }
}
```

### Step 5: Refactor _harvestRewards() with Maximum Safety

```solidity
function _harvestRewards() internal {
    if (_positionTokenId == 0) return;
    
    // Get gauge address with defensive programming
    address gaugeAddress = _getGaugeAddressSafely();
    if (gaugeAddress == address(0)) return;
    
    IMinimalGauge gauge = IMinimalGauge(gaugeAddress);
    
    // Discover rewards defensively
    address[] memory rewardTokens;
    try gauge.rewardsList() returns (address[] memory tokens) {
        rewardTokens = tokens;
        emit RewardTokensDiscovered(tokens);
    } catch {
        emit RewardDiscoveryFailed(gaugeAddress);
        return;
    }
    
    if (rewardTokens.length == 0) return;
    
    // Check earned amounts before claiming
    for (uint i = 0; i < rewardTokens.length; i++) {
        try gauge.earned(rewardTokens[i], address(this)) returns (uint256 amount) {
            if (amount > 0) {
                emit RewardEarned(rewardTokens[i], amount);
            }
        } catch {
            // Continue with other tokens even if one fails
        }
    }
    
    // Track balances before claiming
    uint256[] memory balancesBefore = new uint256[](rewardTokens.length);
    for (uint i = 0; i < rewardTokens.length; i++) {
        balancesBefore[i] = _getTokenBalanceSafely(rewardTokens[i]);
    }
    
    // Try to claim with xSHADOW conversion first
    bool claimSuccess = false;
    try gauge.getRewardAndExit(address(this), rewardTokens) {
        claimSuccess = true;
    } catch {
        emit XShadowConversionFailed();
        // Fallback to regular claim
        try gauge.getReward(address(this), rewardTokens) {
            claimSuccess = true;
        } catch {
            emit RewardClaimFailed(rewardTokens);
        }
    }
    
    if (!claimSuccess) return;
    
    // Process claimed rewards
    for (uint i = 0; i < rewardTokens.length; i++) {
        uint256 balanceAfter = _getTokenBalanceSafely(rewardTokens[i]);
        uint256 received = balanceAfter > balancesBefore[i] 
            ? balanceAfter - balancesBefore[i] 
            : 0;
        
        if (received > 0) {
            emit RewardClaimed(rewardTokens[i], received);
            
            // Forward to vault with defensive programming
            _forwardRewardToVault(IERC20(rewardTokens[i]), received);
        }
    }
}

// Helper function for safe token balance checking
function _getTokenBalanceSafely(address token) internal view returns (uint256) {
    if (token == address(0)) return 0;
    
    try IERC20(token).balanceOf(address(this)) returns (uint256 balance) {
        return balance;
    } catch {
        return 0;
    }
}

// Helper function for safe gauge address retrieval
function _getGaugeAddressSafely() internal view returns (address) {
    try _factory.getShadowVoter() returns (address voterAddress) {
        if (voterAddress == address(0)) return address(0);
        
        try IMinimalVoter(voterAddress).gaugeForPool(address(_pool())) returns (address gauge) {
            return gauge;
        } catch {
            return address(0);
        }
    } catch {
        return address(0);
    }
}

// Helper function for safe reward forwarding
function _forwardRewardToVault(IERC20 token, uint256 amount) internal {
    address vault = _vault();
    
    // Notify vault about the reward token (defensive)
    try IOracleRewardVault(vault).notifyRewardToken(token) {
        // Success
    } catch {
        // Continue anyway - vault might already know about this token
    }
    
    // Transfer to vault (defensive)
    try token.transfer(vault, amount) returns (bool success) {
        if (success) {
            emit RewardForwarded(address(token), vault, amount);
        }
    } catch {
        // Log failure but don't revert
        emit RewardForwarded(address(token), vault, 0);
    }
    
    // Update vault accounting (defensive)
    if (_factory.getVaultType(vault) != IVaultFactory.VaultType.Simple) {
        try IOracleRewardVault(vault).updateAccRewardsPerShare() {
            // Success
        } catch {
            // Non-critical failure
        }
    }
}
```

### Step 6: Update Vault's _updatePool()

```solidity
function _updatePool() internal virtual {
    if (address(getStrategy()) != address(0)) {
        // Get all reward tokens
        try getStrategy().getRewardTokens() returns (address[] memory tokens) {
            // Notify vault about all tokens
            for (uint i = 0; i < tokens.length; i++) {
                if (tokens[i] != address(0)) {
                    _notifyRewardToken(IERC20(tokens[i]));
                }
            }
        } catch {
            // Strategy doesn't support getRewardTokens() yet - try legacy approach
            _handleLegacyRewardTokens();
        }
        
        // Harvest rewards
        try getStrategy().harvestRewards() {} catch {}
    }
    updateAccRewardsPerShare();
}

// Backward compatibility for strategies not yet updated
function _handleLegacyRewardTokens() internal {
    try getStrategy().hasRewards() returns (bool hasRewards) {
        if (hasRewards) {
            try getStrategy().getRewardToken() returns (IERC20 rewardToken) {
                if (address(rewardToken) != address(0)) {
                    _notifyRewardToken(rewardToken);
                }
            } catch {}
        }
    } catch {}
    
    // Similar for extra rewards...
}
```

### Step 7: Implement Metropolis getRewardTokens()

For completeness, here's how Metropolis strategies would implement the new interface:

```solidity
// In Metropolis Strategy
function getRewardTokens() external view returns (address[] memory tokens) {
    uint count = 0;
    address rewardToken;
    address extraRewardToken;
    
    // Count valid tokens
    if (hasRewards()) {
        try this.getRewardToken() returns (IERC20 token) {
            if (address(token) != address(0)) {
                rewardToken = address(token);
                count++;
            }
        } catch {}
    }
    
    if (hasExtraRewards()) {
        try this.getExtraRewardToken() returns (IERC20 token) {
            if (address(token) != address(0)) {
                extraRewardToken = address(token);
                count++;
            }
        } catch {}
    }
    
    // Build array
    tokens = new address[](count);
    uint index = 0;
    
    if (rewardToken != address(0)) {
        tokens[index++] = rewardToken;
    }
    if (extraRewardToken != address(0)) {
        tokens[index++] = extraRewardToken;
    }
}
```

### Step 8: Clean Up and Monitoring Functions

```solidity
// Remove dead functions
// - getVoter() - Not used anywhere
// - _claimRewards() - Merged into _harvestRewards()

// Add monitoring functions
function getRewardStatus() external view returns (
    address[] memory tokens,
    uint256[] memory earned,
    address gauge,
    bool hasActivePosition
) {
    hasActivePosition = _positionTokenId != 0;
    gauge = _getGaugeAddressSafely();
    
    if (!hasActivePosition || gauge == address(0)) {
        return (new address[](0), new uint256[](0), gauge, hasActivePosition);
    }
    
    // Get tokens defensively
    try IMinimalGauge(gauge).rewardsList() returns (address[] memory rewardTokens) {
        tokens = rewardTokens;
        earned = new uint256[](tokens.length);
        
        // Get earned amounts defensively
        for (uint i = 0; i < tokens.length; i++) {
            try IMinimalGauge(gauge).earned(tokens[i], address(this)) returns (uint256 amount) {
                earned[i] = amount;
            } catch {
                earned[i] = 0;
            }
        }
    } catch {
        tokens = new address[](0);
        earned = new uint256[](0);
    }
}
```

## Defensive Programming Principles Applied

1. **Every External Call in Try-Catch**: No assumptions about external contract behavior
2. **Graceful Degradation**: Continue operations even if some parts fail
3. **No Reverts on External Failures**: Log events instead
4. **Validate All Returns**: Check for zero addresses and zero amounts
5. **Fallback Strategies**: xSHADOW conversion → regular claim → skip

## Testing Plan

### Phase 1: Manual Testing (Priority)

1. **Deploy Updated Contracts**
   - Deploy new strategy implementation
   - Test with existing vaults (backward compatibility)

2. **Monitoring Verification**
   - Monitor events in real-time
   - Verify all events fire correctly
   - Check event parameters accuracy

3. **Defensive Programming Tests**
   - Test with non-existent gauge
   - Test with gauge that reverts
   - Test with tokens that revert on balance check
   - Test partial failures in reward claiming

4. **Integration Tests**
   - Full lifecycle with monitoring
   - Verify xSHADOW conversion
   - Test reward forwarding to vault

### Phase 2: Automated Tests (After Manual Testing Success)

Will be developed based on manual testing findings.

## Migration Strategy

1. **Interface Addition**: `getRewardTokens()` is additive, no breaking changes
2. **Vault Compatibility**: Vault handles both old and new strategies
3. **Phased Rollout**: 
   - Deploy Shadow strategy with new interface
   - Update Metropolis strategies later
   - Vault works with both

## Benefits

1. **Unified Multi-Token Model**: Both Shadow and Metropolis use arrays
2. **Complete Visibility**: Events for every operation
3. **Production Ready**: Defensive programming throughout
4. **No Breaking Changes**: Additive interface evolution
5. **xSHADOW Handled**: Automatic conversion to SHADOW

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gauge reverts | Medium | Low | Try-catch, continue operation |
| Token discovery fails | Low | Medium | Return empty array, log event |
| xSHADOW conversion fails | Medium | Low | Fallback to regular claim |
| Reward transfer fails | Low | High | Log event, manual recovery possible |
| Gas limit issues | Low | Medium | Defensive loops with bounds |

## Monitoring Dashboard

Events enable building a monitoring dashboard showing:
- Reward tokens discovered per strategy
- Amounts earned vs claimed
- Conversion success rates
- Failed operations for investigation
- Gas usage patterns

## Summary

This refactor creates a robust, monitorable system that:
- Handles multiple reward tokens elegantly
- Never reverts due to external contract issues  
- Provides complete visibility via events
- Maintains backward compatibility
- Solves the xSHADOW challenge

The defensive programming approach ensures the strategy continues operating even when external contracts misbehave, while comprehensive events provide the visibility needed for production operations.