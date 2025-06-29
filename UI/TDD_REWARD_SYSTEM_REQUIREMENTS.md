# TDD Phase 2: Real Reward System Test Requirements

## Overview

Following TDD methodology, this document outlines the test requirements that have been defined for integrating real reward data from `ArcaRewardClaimerV1` contracts into the vault metrics system. These tests are currently **FAILING** (RED phase) and define the expected behavior.

## Test Files Updated

### 1. `/src/hooks/__tests__/use-vault.test.ts`

**New Test Section**: `🎯 TDD: Real Reward Data Integration`

**Requirements Defined**:

- ✅ Read `totalCompoundedTokenX` and `totalCompoundedTokenY` from ArcaRewardClaimerV1 contract
- ✅ Handle reward claimer contract unavailable gracefully (return "0.0")
- ✅ Get reward claimer address dynamically from registry
- ✅ Support any token pair for reward data (token-agnostic)

**Expected useVault Hook Returns**:

```typescript
{
  // Existing fields...
  totalCompoundedTokenX: "50.0",  // Formatted string from contract
  totalCompoundedTokenY: "75.0",  // Formatted string from contract
  rewardDataAvailable: true,      // Boolean flag
  rewardClaimerAddress: "0x...",  // Contract address from registry
}
```

### 2. `/src/hooks/__tests__/use-vault-metrics-multi-vault.test.ts`

**Updated Test Section**: `🎯 TDD: Token-Agnostic APR Calculations`

**Requirements Defined**:

- ✅ Calculate real APR using contract reward data: `(Total Reward Value USD / TVL / Time Window) × 365`
- ✅ Fall back to estimated APR when reward data unavailable
- ✅ Handle unequal token distributions in reward compounding
- ✅ Use time window from transaction history

**Expected useVaultMetrics Hook Returns**:

```typescript
{
  metrics: {
    // Existing fields...
    realApr: 36.27,              // Real APR from blockchain data
    estimatedApr: undefined,     // Undefined when real data available
    isRealData: true,           // Data source indicator
    timeWindowDays: 30,         // From transaction history
    rewardDataSource: "blockchain", // "blockchain" | "estimated"
  }
}
```

### 3. `/src/hooks/__tests__/use-blockchain-transaction-history.test.ts`

**New Test Section**: `🎯 TDD: Time Window Calculation for Real APR`

**Requirements Defined**:

- ✅ Calculate time window from first successful deposit to current date
- ✅ Return minimum 1 day for recent deposits (avoid division by zero)
- ✅ Ignore failed deposits when calculating time window
- ✅ Return 1 day when no deposits exist

**Expected useTransactionHistory Hook Addition**:

```typescript
{
  // Existing fields...
  calculateTimeWindowDays: () => number, // New function
}
```

### 4. `/src/hooks/__tests__/use-vault-metrics-real-rewards.test.ts` (NEW FILE)

**Comprehensive TDD Test Suite for Real Reward Integration**

**Requirements Defined**:

- ✅ Real APR calculation using ArcaRewardClaimerV1 contract data
- ✅ Handle zero reward compounding gracefully
- ✅ Fall back to estimated APR when reward claimer unavailable
- ✅ Handle different token pair reward distributions
- ✅ Performance: Handle very small time windows without division errors
- ✅ Performance: Handle very large reward amounts without overflow

## Infrastructure Updates

### 1. Mock Contract System (`/src/test-utils/mock-contracts.ts`)

**Added**:

- `MOCK_REWARD_DATA`: Test data for reward calculations
- Enhanced `createMockVaultData()` to include reward fields
- Enhanced `createMockReadContract()` to support error states

### 2. Contract ABIs (`/src/lib/contracts.ts`)

**Added**:

- `REWARD_CLAIMER_ABI`: ABI for reading `getTotalCompounded` function
- Support for reward claimer contract interactions

## Business Logic Requirements

### Real APR Calculation Formula

```
Real APR = (Total Compounded Rewards USD / TVL USD / Time Window Days) × 365 × 100

Where:
- Total Compounded Rewards USD = (totalCompoundedTokenX × tokenXPrice) + (totalCompoundedTokenY × tokenYPrice)
- TVL USD = (vaultBalanceX × tokenXPrice) + (vaultBalanceY × tokenYPrice)
- Time Window Days = Days since first successful deposit (minimum 1)
```

### Data Flow Architecture

1. **useVault Hook** → Reads reward claimer contract → Returns formatted reward data
2. **useTransactionHistory Hook** → Calculates time window → Returns calculateTimeWindowDays function
3. **useVaultMetrics Hook** → Combines vault + reward + history data → Calculates real APR

### Error Handling Requirements

- **Contract Unavailable**: Gracefully fall back to estimated APR
- **Zero Rewards**: Return 0% real APR (not undefined)
- **Small Time Windows**: Enforce minimum 1-day window
- **Large Numbers**: Handle without overflow
- **Missing Data**: Provide clear data source indicators

## Current Test Status (RED Phase)

### Failing Tests (Expected)

- `use-vault.test.ts`: 4 failing tests (reward integration)
- `use-vault-metrics-multi-vault.test.ts`: 2 failing tests (real APR)
- `use-vault-metrics-real-rewards.test.ts`: 6 failing tests (comprehensive)

### Passing Tests (Preserved)

- `use-vault.test.ts`: 27 passing tests (existing functionality)
- `use-vault-metrics-multi-vault.test.ts`: 11 passing tests (existing functionality)

## Next Steps (GREEN Phase)

1. **Update useVault Hook**:

   - Add reward claimer contract reading
   - Add registry integration for reward claimer address
   - Add error handling for contract unavailability

2. **Update useTransactionHistory Hook**:

   - Add `calculateTimeWindowDays()` function
   - Implement time window calculation logic

3. **Update useVaultMetrics Hook**:

   - Integrate real reward data from useVault
   - Implement real APR calculation formula
   - Add fallback logic for estimated APR

4. **Integration Testing**:
   - Verify all tests pass (GREEN phase)
   - Test with different token pairs
   - Test edge cases and error conditions

## Success Criteria

When implementation is complete, all tests should pass and the system should:

- Calculate real APR using blockchain reward data
- Fall back gracefully to estimated APR when needed
- Support any token pair configuration
- Handle all edge cases robustly
- Maintain existing functionality

**TDD Status**: 🔴 RED PHASE (Tests Defined, Implementation Pending)
**Next Phase**: 🟢 GREEN PHASE (Implement to make tests pass)
