# Robust Deposit/Approval Flow Solution

## Executive Summary

This document outlines a production-ready solution for handling token approvals and deposits in the Arca vault system. The solution addresses all identified edge cases while maintaining excellent user experience.

## Core Principles

1. **Blockchain as Truth**: On-chain allowance is the single source of truth
2. **Defensive Programming**: Assume everything can fail, have fallbacks
3. **User Clarity**: Always show what's happening and why
4. **State Persistence**: Handle page refreshes and network issues gracefully
5. **Progressive Enhancement**: Basic flow works, advanced features enhance UX

## Architecture Overview

### 1. State Machine Design

```typescript
type DepositFlowState = 
  // Initial states
  | "initializing"          // Component mounting, checking allowance
  | "idle"                  // Ready for user input
  
  // Approval flow
  | "checking_allowance"    // Fetching current allowance
  | "needs_approval"        // Approval required
  | "approval_confirming"   // User confirming in wallet
  | "approval_pending"      // Transaction submitted
  | "approval_mining"       // Transaction in mempool
  | "approval_confirmed"    // Transaction mined
  | "approval_failed"       // Transaction failed
  
  // Deposit flow
  | "ready_to_deposit"      // Has sufficient allowance
  | "insufficient_balance"  // Approved but no token balance
  | "deposit_confirming"    // User confirming in wallet
  | "deposit_pending"       // Transaction submitted
  | "deposit_mining"        // Transaction in mempool
  | "deposit_confirmed"     // Transaction mined
  | "deposit_failed"        // Transaction failed
  
  // Edge cases
  | "amount_locked"         // Amount locked during transaction
  | "network_error"         // RPC or network issues
  | "wrong_network"         // User on incorrect chain
  | "wallet_disconnected"   // Wallet connection lost
  | "contract_paused";      // Vault contract is paused
```

### 2. Data Layer Architecture

```typescript
interface DepositFlowData {
  // Allowance tracking
  allowance: {
    current: bigint;              // Current on-chain allowance
    required: bigint;             // Required for deposit amount
    lastChecked: number;          // Timestamp of last check
    confidence: 'high' | 'low';   // Based on data freshness
    source: 'onchain' | 'cache' | 'pending';
  };
  
  // Transaction tracking
  pendingTx: {
    hash: string;
    type: 'approval' | 'deposit';
    amount: string;
    startTime: number;
    confirmations: number;
    gasPrice?: bigint;
  } | null;
  
  // Amount management
  amount: {
    input: string;               // User input
    parsed: bigint;             // Parsed amount
    locked: boolean;            // Locked during transaction
    lockedValue?: string;       // Value when locked
  };
  
  // Error tracking
  error: {
    type: ErrorType;
    message: string;
    recoverable: boolean;
    retry?: () => void;
  } | null;
}
```

### 3. Component Hierarchy

```
VaultCard
├── VaultDepositController (orchestrates flow)
│   ├── AllowanceMonitor (tracks allowance)
│   ├── TransactionTracker (monitors pending txs)
│   └── AmountValidator (validates inputs)
└── VaultDepositUI (presentation)
    ├── AmountInput (with locking)
    ├── ActionButton (dynamic based on state)
    ├── AllowanceDisplay (shows current/required)
    └── ErrorDisplay (actionable errors)
```

## Implementation Guide

### Phase 1: Core State Management

#### 1.1 Enhanced State Machine Hook

```typescript
// use-deposit-state-machine.ts
export function useDepositStateMachine(config: DepositConfig) {
  const [state, setState] = useState<DepositFlowState>('initializing');
  const [data, setData] = useState<DepositFlowData>(initialData);
  
  // State transition rules
  const transition = (to: DepositFlowState) => {
    const valid = isValidTransition(state, to);
    if (!valid) {
      console.error(`Invalid transition: ${state} -> ${to}`);
      return;
    }
    setState(to);
  };
  
  return { state, data, transition };
}
```

#### 1.2 Allowance Monitoring System

```typescript
// use-allowance-monitor.ts
export function useAllowanceMonitor({
  token,
  owner,
  spender,
  amount,
  enabled
}: AllowanceMonitorConfig) {
  // Multiple data sources
  const onChainAllowance = useOnChainAllowance(token, owner, spender);
  const cachedAllowance = useCachedAllowance(token, owner, spender);
  const pendingApproval = usePendingApproval(token, owner, spender);
  
  // Smart allowance resolution
  const allowance = useMemo(() => {
    // If we have a pending approval, optimistically use it
    if (pendingApproval && Date.now() - pendingApproval.timestamp < 60000) {
      return {
        value: pendingApproval.amount,
        confidence: 'low',
        source: 'pending'
      };
    }
    
    // If on-chain data is fresh, use it
    if (onChainAllowance.lastFetch > Date.now() - 5000) {
      return {
        value: onChainAllowance.value,
        confidence: 'high',
        source: 'onchain'
      };
    }
    
    // Fall back to cache if available
    if (cachedAllowance) {
      return {
        value: cachedAllowance.value,
        confidence: 'low',
        source: 'cache'
      };
    }
    
    return null;
  }, [onChainAllowance, cachedAllowance, pendingApproval]);
  
  return allowance;
}
```

### Phase 2: Transaction Management

#### 2.1 Transaction Lifecycle Tracking

```typescript
// use-transaction-lifecycle.ts
export function useTransactionLifecycle() {
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
  
  // Persist to localStorage for recovery
  useEffect(() => {
    if (pendingTx) {
      localStorage.setItem(`pending_tx_${pendingTx.hash}`, JSON.stringify(pendingTx));
    }
  }, [pendingTx]);
  
  // Recover on mount
  useEffect(() => {
    const recovered = recoverPendingTransactions();
    if (recovered) {
      setPendingTx(recovered);
      monitorTransaction(recovered.hash);
    }
  }, []);
  
  // Monitor transaction
  const monitorTransaction = async (hash: string) => {
    let confirmations = 0;
    let finished = false;
    
    while (!finished) {
      const receipt = await provider.getTransactionReceipt(hash);
      
      if (!receipt) {
        // Still pending
        await wait(2000);
        continue;
      }
      
      if (receipt.status === 0) {
        // Failed
        handleTransactionFailure(hash, 'reverted');
        finished = true;
      } else {
        // Success - wait for confirmations
        confirmations = await provider.getBlockNumber() - receipt.blockNumber;
        if (confirmations >= requiredConfirmations) {
          handleTransactionSuccess(hash);
          finished = true;
        }
      }
      
      updateConfirmations(hash, confirmations);
      await wait(1000);
    }
  };
  
  return { pendingTx, startTransaction, monitorTransaction };
}
```

#### 2.2 Amount Locking During Transactions

```typescript
// use-amount-lock.ts
export function useAmountLock() {
  const [lockedAmount, setLockedAmount] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  
  const lockAmount = (amount: string) => {
    setLockedAmount(amount);
    setIsLocked(true);
  };
  
  const unlockAmount = () => {
    setIsLocked(false);
    // Keep lockedAmount for reference
  };
  
  const getDisplayAmount = (currentInput: string) => {
    if (isLocked && lockedAmount) {
      return lockedAmount;
    }
    return currentInput;
  };
  
  return { lockAmount, unlockAmount, isLocked, getDisplayAmount };
}
```

### Phase 3: Error Handling & Recovery

#### 3.1 Comprehensive Error Classification

```typescript
// error-handler.ts
export class DepositErrorHandler {
  static classify(error: unknown): ClassifiedError {
    // User rejection
    if (this.isUserRejection(error)) {
      return {
        type: 'user_rejection',
        message: 'Transaction cancelled',
        recoverable: true,
        action: 'retry'
      };
    }
    
    // Insufficient gas
    if (this.isInsufficientGas(error)) {
      return {
        type: 'insufficient_gas',
        message: 'Not enough gas. Try increasing gas limit.',
        recoverable: true,
        action: 'increase_gas'
      };
    }
    
    // Network issues
    if (this.isNetworkError(error)) {
      return {
        type: 'network',
        message: 'Network connection issue. Please try again.',
        recoverable: true,
        action: 'retry'
      };
    }
    
    // Contract revert
    if (this.isContractRevert(error)) {
      const reason = this.extractRevertReason(error);
      return {
        type: 'contract_revert',
        message: reason || 'Transaction failed on-chain',
        recoverable: this.isRecoverableRevert(reason),
        action: 'check_conditions'
      };
    }
    
    // Unknown
    return {
      type: 'unknown',
      message: 'An unexpected error occurred',
      recoverable: false,
      action: 'contact_support'
    };
  }
}
```

#### 3.2 State Recovery System

```typescript
// use-state-recovery.ts
export function useStateRecovery(vaultAddress: string, userAddress: string) {
  const recoverState = async (): Promise<RecoveredState | null> => {
    // Check for pending transactions
    const pendingTxs = await checkPendingTransactions(userAddress);
    
    // Check current allowance
    const allowance = await checkAllowance(vaultAddress, userAddress);
    
    // Check locked amounts
    const lockedAmount = localStorage.getItem(`locked_amount_${vaultAddress}`);
    
    // Determine appropriate state
    if (pendingTxs.length > 0) {
      const latest = pendingTxs[0];
      if (latest.type === 'approval') {
        return { state: 'approval_pending', data: latest };
      } else {
        return { state: 'deposit_pending', data: latest };
      }
    }
    
    if (lockedAmount && allowance.gte(parseUnits(lockedAmount))) {
      return { state: 'ready_to_deposit', amount: lockedAmount };
    }
    
    return null;
  };
  
  return { recoverState };
}
```

### Phase 4: UI Components

#### 4.1 Smart Amount Input

```typescript
// AmountInput.tsx
export function AmountInput({ 
  value, 
  onChange, 
  isLocked, 
  lockedValue,
  tokenSymbol,
  maxAmount,
  minAmount,
  decimals 
}: AmountInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  
  const handleChange = (input: string) => {
    // If locked, ignore changes
    if (isLocked) return;
    
    // Validate input format
    const validation = validateAmountInput(input, decimals);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    // Check bounds
    if (validation.parsed) {
      if (validation.parsed.gt(maxAmount)) {
        setError('Exceeds balance');
      } else if (validation.parsed.lt(minAmount)) {
        setError('Below minimum');
      } else {
        setError(null);
      }
    }
    
    setLocalValue(input);
    onChange(input);
  };
  
  return (
    <div className="amount-input-container">
      <input
        value={isLocked ? lockedValue : localValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isLocked}
        className={`amount-input ${isLocked ? 'locked' : ''} ${error ? 'error' : ''}`}
      />
      {isLocked && (
        <div className="lock-indicator">
          🔒 Amount locked during transaction
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
```

#### 4.2 Dynamic Action Button

```typescript
// ActionButton.tsx
export function ActionButton({ 
  state, 
  onClick, 
  tokenSymbol,
  amount,
  allowance 
}: ActionButtonProps) {
  const getButtonConfig = (): ButtonConfig => {
    switch (state) {
      case 'initializing':
        return { text: 'Loading...', disabled: true, variant: 'default' };
        
      case 'idle':
        return { text: 'Enter Amount', disabled: true, variant: 'default' };
        
      case 'checking_allowance':
        return { text: 'Checking Approval...', disabled: true, variant: 'default' };
        
      case 'needs_approval':
        return { text: `Approve ${tokenSymbol}`, disabled: false, variant: 'warning' };
        
      case 'approval_confirming':
        return { text: 'Confirm in Wallet...', disabled: true, variant: 'warning' };
        
      case 'approval_pending':
        return { text: 'Approving...', disabled: true, variant: 'warning', showSpinner: true };
        
      case 'ready_to_deposit':
        return { text: `Deposit ${tokenSymbol}`, disabled: false, variant: 'primary' };
        
      case 'insufficient_balance':
        return { text: 'Insufficient Balance', disabled: true, variant: 'error' };
        
      case 'deposit_pending':
        return { text: 'Depositing...', disabled: true, variant: 'primary', showSpinner: true };
        
      case 'deposit_confirmed':
        return { text: 'Success!', disabled: true, variant: 'success' };
        
      default:
        return { text: 'Error', disabled: true, variant: 'error' };
    }
  };
  
  const config = getButtonConfig();
  
  return (
    <button
      onClick={onClick}
      disabled={config.disabled}
      className={`action-button variant-${config.variant}`}
    >
      {config.showSpinner && <Spinner />}
      {config.text}
    </button>
  );
}
```

#### 4.3 Allowance Display

```typescript
// AllowanceDisplay.tsx
export function AllowanceDisplay({ 
  current, 
  required, 
  tokenSymbol,
  confidence 
}: AllowanceDisplayProps) {
  if (!current) return null;
  
  const hasFullAllowance = current.gte(required);
  const hasPartialAllowance = current.gt(0) && current.lt(required);
  const percentageApproved = required.gt(0) 
    ? Number((current * 100n) / required) 
    : 0;
  
  return (
    <div className="allowance-display">
      {hasFullAllowance ? (
        <div className="allowance-status approved">
          ✓ Approved to spend {tokenSymbol}
        </div>
      ) : hasPartialAllowance ? (
        <div className="allowance-status partial">
          <div className="allowance-bar">
            <div 
              className="allowance-progress" 
              style={{ width: `${percentageApproved}%` }} 
            />
          </div>
          <div className="allowance-text">
            {formatUnits(current)} / {formatUnits(required)} {tokenSymbol} approved
          </div>
        </div>
      ) : (
        <div className="allowance-status none">
          Approval required to spend {tokenSymbol}
        </div>
      )}
      
      {confidence === 'low' && (
        <div className="confidence-warning">
          ⚠️ Allowance data may be outdated
        </div>
      )}
    </div>
  );
}
```

### Phase 5: Integration & Testing

#### 5.1 Main Integration Component

```typescript
// VaultDepositFlow.tsx
export function VaultDepositFlow({ vault, tokenIndex }: VaultDepositFlowProps) {
  // Core hooks
  const { state, data, transition } = useDepositStateMachine(config);
  const allowance = useAllowanceMonitor(allowanceConfig);
  const { pendingTx, startTransaction } = useTransactionLifecycle();
  const { lockAmount, unlockAmount, isLocked } = useAmountLock();
  const { recoverState } = useStateRecovery(vault.address, userAddress);
  
  // Initialize and recover state
  useEffect(() => {
    const init = async () => {
      transition('initializing');
      
      // Try to recover previous state
      const recovered = await recoverState();
      if (recovered) {
        transition(recovered.state);
        if (recovered.amount) {
          setAmount(recovered.amount);
          if (recovered.state.includes('pending')) {
            lockAmount(recovered.amount);
          }
        }
      } else {
        // Fresh start - check allowance
        transition('checking_allowance');
      }
    };
    
    init();
  }, []);
  
  // Handle allowance updates
  useEffect(() => {
    if (state === 'checking_allowance' && allowance) {
      if (allowance.value.gte(requiredAmount)) {
        transition('ready_to_deposit');
      } else {
        transition('needs_approval');
      }
    }
  }, [state, allowance, requiredAmount]);
  
  // Handle approval
  const handleApprove = async () => {
    try {
      transition('approval_confirming');
      lockAmount(amount);
      
      const tx = await approveToken(amount);
      startTransaction('approval', tx.hash, amount);
      transition('approval_pending');
      
      await tx.wait();
      transition('ready_to_deposit');
      unlockAmount();
      
    } catch (error) {
      const classified = DepositErrorHandler.classify(error);
      handleError(classified);
      unlockAmount();
    }
  };
  
  // Handle deposit
  const handleDeposit = async () => {
    try {
      transition('deposit_confirming');
      lockAmount(amount);
      
      const tx = await depositToken(amount);
      startTransaction('deposit', tx.hash, amount);
      transition('deposit_pending');
      
      await tx.wait();
      transition('deposit_confirmed');
      
      // Clear amount after success
      setTimeout(() => {
        setAmount('');
        unlockAmount();
        transition('idle');
      }, 3000);
      
    } catch (error) {
      const classified = DepositErrorHandler.classify(error);
      handleError(classified);
      unlockAmount();
    }
  };
  
  return (
    <div className="vault-deposit-flow">
      <AllowanceDisplay
        current={allowance?.value}
        required={requiredAmount}
        tokenSymbol={tokenSymbol}
        confidence={allowance?.confidence}
      />
      
      <AmountInput
        value={amount}
        onChange={setAmount}
        isLocked={isLocked}
        lockedValue={data.amount.lockedValue}
        tokenSymbol={tokenSymbol}
        maxAmount={userBalance}
        minAmount={minDeposit}
        decimals={tokenDecimals}
      />
      
      <ActionButton
        state={state}
        onClick={state === 'needs_approval' ? handleApprove : handleDeposit}
        tokenSymbol={tokenSymbol}
        amount={amount}
        allowance={allowance?.value}
      />
      
      {data.error && (
        <ErrorDisplay
          error={data.error}
          onRetry={data.error.retry}
        />
      )}
      
      {pendingTx && (
        <TransactionStatus
          tx={pendingTx}
          confirmations={data.confirmations}
          requiredConfirmations={requiredConfirmations}
        />
      )}
    </div>
  );
}
```

## Testing Strategy

### Unit Tests
1. State machine transitions
2. Amount validation and parsing
3. Allowance calculations
4. Error classification
5. Recovery logic

### Integration Tests
1. Full approval → deposit flow
2. Recovery after page refresh
3. Multi-tab synchronization
4. Network switching
5. Transaction failures and retries

### E2E Tests
1. New user complete flow
2. Returning user with allowance
3. Failed approval retry
4. Concurrent operations
5. Edge case amounts

### Manual Testing Checklist
- [ ] Fresh wallet approval and deposit
- [ ] Page refresh during approval
- [ ] Page refresh during deposit
- [ ] Switch tabs after approval
- [ ] Change amount during approval
- [ ] Network switch mid-flow
- [ ] Wallet disconnect/reconnect
- [ ] Max button with fees
- [ ] Scientific notation input
- [ ] Copy/paste amounts
- [ ] Rapid clicking prevention
- [ ] Error message clarity
- [ ] Loading state smoothness

## Security Considerations

1. **No Infinite Approvals by Default** - Always approve exact amounts
2. **Amount Verification** - Double-check amounts before transactions
3. **Reentrancy Prevention** - Disable buttons during transactions
4. **Front-running Protection** - Consider approval deadlines
5. **Input Sanitization** - Prevent XSS in amount inputs

## Performance Optimizations

1. **Debounced Allowance Checks** - Don't spam RPC
2. **Optimistic Updates** - Update UI before confirmation
3. **Lazy Loading** - Load transaction history on demand
4. **Efficient Re-renders** - Memoize expensive calculations
5. **Background Monitoring** - Use Web Workers for tx monitoring

## Conclusion

This solution provides a robust, user-friendly deposit/approval flow that handles all identified edge cases while maintaining excellent performance and security. The modular architecture allows for easy testing and future enhancements.