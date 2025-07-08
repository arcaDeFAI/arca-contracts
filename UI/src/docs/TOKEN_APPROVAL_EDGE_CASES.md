# Token Approval System - Complete Edge Case Analysis

## Core Scenarios

### 1. Fresh User Journey

- **First visit**: No allowance → Show "Approve"
- **After approval**: Allowance exists → Show "Deposit"
- **Return visit**: Check allowance → Show "Deposit" (no re-approval needed)

### 2. Multi-Tab/Window Scenarios

- **Approve in Tab A, deposit in Tab B**: Tab B must detect the approval
- **Approve in MetaMask directly**: UI must detect external approvals
- **Multiple tabs with same vault**: All tabs should sync state

### 3. Account Switching

- **Switch from approved account to new account**: Reset to "Approve"
- **Switch back to approved account**: Detect existing allowance
- **Multiple accounts with different allowances**: Track per account

## Complex Edge Cases

### 1. Partial Allowance Scenarios

```
Current Allowance: 100 USDC
User wants to deposit: 150 USDC
```

**Solutions**:

- Option A: Show "Increase Approval" (approve additional 50)
- Option B: Show "Approve" (overwrite with new 150)
- Option C: Show both current allowance and required amount

### 2. Failed Transaction Scenarios

#### Approval Failures

- **User rejects in wallet**: Stay on "needs_approval" state
- **Transaction fails on-chain**: Show error, allow retry
- **Insufficient gas**: Show specific error, suggest gas amount
- **Network congestion**: Show pending state, allow speed up

#### Post-Approval Failures

- **Approval succeeded but deposit fails**: Keep "Deposit" button active
- **Token balance changes during approval**: Re-validate before deposit
- **Contract paused between approve/deposit**: Show specific error

### 3. Concurrent Operations

- **User initiates approval while another is pending**: Prevent/queue
- **Approval from external source during UI approval**: Handle gracefully
- **Multiple deposits in quick succession**: Queue or prevent

### 4. Token-Specific Edge Cases

#### Weird Token Behaviors

- **Fee-on-transfer tokens**: Allowance might not match received amount
- **Rebasing tokens**: Balance/allowance changes over time
- **Pausable tokens**: Token transfers might be paused
- **Upgradeable tokens**: Token logic might change

#### Allowance Edge Cases

- **Infinite approval (MAX_UINT256)**: Never needs re-approval
- **Zero approval**: Some tokens require 0 before new approval
- **Approval front-running**: MEV bots might use your approval

### 5. Network & RPC Issues

#### RPC Failures

- **Allowance check fails**: Show fallback UI or retry
- **Intermittent connection**: Cache last known state
- **RPC returns stale data**: Multiple RPC endpoint fallback

#### Network Switching

- **Switch networks during approval**: Cancel pending, reset state
- **Wrong network**: Prevent operations, show warning
- **Network added mid-session**: Refresh token configs

### 6. Amount Input Edge Cases

- **Scientific notation**: 1e18 → parse correctly
- **Decimal precision**: More decimals than token supports
- **Copy-paste amounts**: "1,000.50" vs "1000.50"
- **Negative amounts**: Prevent/validate
- **MAX button precision**: Ensure exact balance usage

### 7. Race Conditions

#### State Updates

```
User clicks "Approve" →
Approval pending →
User edits amount →
Approval completes →
Which amount is approved?
```

#### Solutions:

- Lock amount during approval
- Show approved amount clearly
- Require re-approval if amount changed

### 8. Browser & Wallet Issues

#### Browser Scenarios

- **Page refresh during approval**: Detect pending tx on reload
- **Browser back button**: Maintain state or reset cleanly
- **Incognito/private mode**: No localStorage, handle gracefully

#### Wallet Behaviors

- **Wallet disconnects during approval**: Handle orphaned transaction
- **Wallet auto-locks**: Reconnect and check state
- **Hardware wallet timeout**: Extended signing time
- **Mobile wallet deeplinking**: Return to correct state

### 9. Time-Based Edge Cases

- **Approval expires**: Some protocols have time-limited approvals
- **Long-pending approval**: User returns hours later
- **Contract upgrade between visits**: Approval might be invalid

### 10. Data Validation Edge Cases

#### Amount Validation

```typescript
// User inputs that break naive parsing:
"0.0"      → Valid but might be rejected
"00.1"     → Leading zeros
".1"       → No leading digit
"1."       → Trailing decimal
"1.0e2"    → Scientific notation
"∞"        → Infinity symbol
```

#### Balance Edge Cases

- **Balance changes during input**: Real-time validation
- **Dust amounts**: Below minimum deposit thresholds
- **Maximum deposits**: Protocol limits

## Robust Implementation Strategy

### 1. State Machine Completeness

```typescript
type DepositFlowState =
  | "idle"
  | "checking_allowance" // New: Loading state
  | "needs_approval"
  | "approving"
  | "approval_pending" // New: Waiting for confirmation
  | "approval_confirming"
  | "approval_failed" // New: Specific failure state
  | "ready_to_deposit"
  | "insufficient_balance" // New: Has approval but no balance
  | "depositing"
  | "deposit_pending"
  | "deposit_confirming"
  | "completed"
  | "error";
```

### 2. Comprehensive Error Handling

```typescript
interface DepositError {
  type: "approval" | "deposit" | "validation" | "network" | "unknown";
  code?: string;
  message: string;
  retry: boolean;
  action?: "approve" | "deposit" | "switch_network" | "connect_wallet";
}
```

### 3. Allowance Monitoring Strategy

```typescript
// Multiple data sources for reliability
const getAllowanceData = () => {
  return {
    onChain: allowanceFromContract, // Primary source
    cached: allowanceFromCache, // Fallback
    pending: pendingApprovalAmount, // In-flight
    lastChecked: timestamp,
    confidence: "high" | "medium" | "low",
  };
};
```

### 4. Transaction Recovery

```typescript
// On page load, check for orphaned transactions
const recoverPendingTransactions = async () => {
  const pending = localStorage.getItem("pendingApproval");
  if (pending) {
    const tx = await provider.getTransaction(pending.hash);
    if (tx && tx.blockNumber) {
      // Transaction completed while away
      handleApprovalComplete(tx);
    }
  }
};
```

### 5. User Communication

- **Clear allowance display**: "Current approval: 100 USDC"
- **Transaction history**: "Last approved 2 hours ago"
- **Helpful errors**: "Approval failed: Token contract is paused"
- **Progress indicators**: Step 1 of 2: Approving tokens...

## Testing Checklist

### Basic Flow

- [ ] Fresh user can approve and deposit
- [ ] Returning user skips approval
- [ ] Amount changes trigger correct states

### Edge Cases

- [ ] Partial allowance handled correctly
- [ ] Failed approval can be retried
- [ ] Network switch resets state properly
- [ ] Concurrent tabs stay in sync
- [ ] Invalid amounts show clear errors
- [ ] MAX button works with fee-on-transfer tokens
- [ ] Refresh during approval recovers state
- [ ] External approval detected
- [ ] Account switch updates allowance
- [ ] Zero amount handling
- [ ] Scientific notation parsing
- [ ] Infinite approval detection

### Error Scenarios

- [ ] RPC failure shows fallback UI
- [ ] Wallet rejection handled gracefully
- [ ] Network congestion communicated
- [ ] Insufficient balance after approval
- [ ] Contract pause/unpause handled
- [ ] Token transfer failures explained

### Performance

- [ ] Allowance checks are debounced
- [ ] No unnecessary re-renders
- [ ] Cache invalidation is precise
- [ ] Loading states are smooth

## Conclusion

A robust approval system must handle:

1. **Persistent blockchain state** - Approvals survive sessions
2. **Multi-source truth** - Blockchain, cache, pending txs
3. **Async everything** - Network delays, user actions
4. **Failed transactions** - At any step
5. **External changes** - Other tabs, wallets, contracts
6. **Edge case amounts** - Decimals, precision, formats
7. **Token quirks** - Each token is different
8. **User mistakes** - Wrong amounts, networks, accounts
9. **Technical failures** - RPC, wallet, browser issues
10. **Time delays** - Between approval and deposit

The implementation must be defensive, with fallbacks for every scenario.
