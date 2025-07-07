# Token Approval System - How It Really Works

## The Truth About Token Approvals

**Token approvals are PERSISTENT on the blockchain!** When you approve a token, it's stored permanently in the ERC20 contract until:

1. **You spend the approved amount** - Allowance decreases with each transfer
2. **You set a new approval** - Overwrites the previous allowance
3. **You revoke it** - Explicitly set allowance to 0

## What This Means for UX

✅ **Good UX**:
- Check existing allowance when user connects wallet
- Skip approval if allowance >= deposit amount
- Show "Deposit" button directly if already approved

❌ **Bad UX** (current issue):
- Always showing "Approve" even when already approved
- Not refreshing allowance after approval
- Confusing users with unnecessary approval steps

## The Real Problem

Looking at the logs, the issue is:
```
[handleDeposit] Has allowance: false  // <-- This is wrong after approval!
```

The current code DOES check allowance, but it's not updating properly because:

1. **Cache is too aggressive** - Using 10-30 second stale times
2. **No invalidation after approval** - Cache doesn't know to refetch
3. **State doesn't wait for confirmation** - Checks allowance before tx confirms

## Proper Implementation

### 1. Always Check On-Chain Allowance First

```typescript
// When component mounts or wallet connects
useEffect(() => {
  // Check if user already has allowance
  refetchAllowance();
}, [userAddress, tokenAddress, vaultAddress]);
```

### 2. Smart Caching Strategy

```typescript
// For allowance checks - shorter cache, always refetch on mount
{
  staleTime: 0,        // Always check fresh on mount
  cacheTime: 2000,     // Keep in cache briefly
  refetchOnMount: true,
  refetchOnWindowFocus: true
}
```

### 3. Proper State Flow

```
Component Mounts
    ↓
Check Allowance (fresh from chain)
    ↓
Has Allowance? → Show "Deposit" button
    ↓
No Allowance? → Show "Approve" button
    ↓
After Approval Confirms → Invalidate cache → Refetch → Update UI
```

### 4. Handle Common Scenarios

**Scenario 1: User Previously Approved**
- Mount → Check allowance → Find existing approval → Show "Deposit"

**Scenario 2: User Approves in Another Tab**
- refetchOnWindowFocus → Detect new allowance → Update UI

**Scenario 3: User Switches Accounts**
- Account change → Clear cache → Check new account's allowance

## Implementation Fixes Needed

1. **Fix useVault hook**:
   - Remove aggressive caching for allowance
   - Add proper invalidation after approval
   - Ensure allowance updates after confirmation

2. **Fix hasAllowance function**:
   - Make sure it's checking the right values
   - Handle edge cases (undefined, loading states)

3. **Add allowance display**:
   - Show current allowance to user
   - "Current allowance: 1000 USDC"
   - Helps debug and builds trust

## Common Patterns in DeFi

### 1. Exact Approval
- Approve only what's needed for current transaction
- Safer but requires approval for each deposit
- Example: Uniswap V3

### 2. Infinite Approval
- Approve MAX_UINT256 once
- Never need to approve again
- Example: Many yield farms

### 3. Batched Approval
- Approve a larger amount (e.g., 10x deposit)
- Reduces approval frequency
- Example: Aave

## The Fix Summary

The current implementation is checking allowance but:
1. Not refreshing after approval
2. Using stale cached data
3. Not waiting for blockchain confirmation

The solution ensures:
1. ✅ Fresh allowance check on mount
2. ✅ Automatic refresh after approval
3. ✅ Proper state management
4. ✅ Clear UX with correct button states