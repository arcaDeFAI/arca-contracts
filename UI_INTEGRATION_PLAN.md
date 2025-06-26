# UI Integration Plan for Arca Vault System

## High-Level Overview

This document outlines the comprehensive plan to integrate our deployed Solidity contracts with the React frontend, transforming it from a mockup into a fully functional production dApp.

### ⚠️ IMPORTANT: TDD Pivot (Updated Plan)

After completing Phases 1 and 2.1-2.2 without tests, we've recognized the critical need for test coverage, especially for money-handling flows. The plan has been updated to:

1. **PAUSE** new feature development
2. **IMPLEMENT** Phase 2.5 - Critical test coverage for existing code
3. **RESUME** with strict TDD for all remaining phases

This ensures deposit/withdraw flows, calculations, and user funds are properly tested before production deployment.

### Current State Assessment

**✅ Strong Foundation:**
- Complete contract deployment infrastructure (mainnet fork tested)
- Comprehensive `useVault` hook with all contract interactions
- Wallet integration with RainbowKit + Wagmi
- Well-architected component structure with TypeScript
- Real contract addresses and ABIs configured

**⚠️ Integration Gaps:**
- UI components still use mock data instead of real contract calls
- No transaction history or event tracking
- Missing error handling for Web3 interactions
- No UI testing infrastructure
- Static APR/TVL calculations need real-time data

### Integration Strategy

**Phase 1: Core Functionality (Essential)**
- Replace mock vault data with real contract queries
- Connect deposit/withdraw forms to actual contract functions
- Implement proper loading states and error handling
- Add basic transaction confirmation flows

**Phase 2: Enhanced User Experience (Important)**
- Add comprehensive transaction history
- Implement real-time APR/TVL calculations
- Add advanced error boundaries and retry mechanisms
- Create proper fee calculation displays

**Phase 3: Production Readiness (Critical)**
- Comprehensive UI testing suite (unit + integration + e2e)
- Performance optimizations and caching strategies
- Accessibility and mobile responsiveness
- Security audit of frontend Web3 interactions

**Phase 4: Advanced Features (Nice-to-Have)**
- Advanced analytics dashboard
- Real-time notifications for rebalance events
- Enhanced filtering and sorting capabilities
- Mobile app considerations

### Success Criteria

1. **Zero Mock Data**: All UI components use real contract data
2. **Full Transaction Flow**: Users can deposit, withdraw, and track positions
3. **Real-time Updates**: UI reflects actual blockchain state
4. **Error Resilience**: Graceful handling of all failure modes
5. **Test Coverage**: Comprehensive testing of all user flows
6. **Performance**: Fast loading and responsive user experience

---

## Detailed Implementation Plan

### Current Analysis Summary

**✅ Strong Foundation (Completed):**
- `useVault` hook with complete contract integration (deposits, withdrawals, balances, shares)
- Wallet connectivity with RainbowKit + Wagmi for Sonic mainnet + fork
- Contract addresses and ABIs configured for both networks
- Well-structured component architecture with TypeScript

**⚠️ Critical Integration Gaps (To Address):**
- VaultCard component uses mock `Vault` interface instead of real contract data
- Vaults page filters `mockVaults` instead of `realVaults` with live data
- Dashboard page shows hardcoded balances/earnings instead of user positions
- No testing infrastructure (no test files, dependencies, or configuration)
- Missing transaction history and error handling components

**🔧 Technical Debt Identified:**
- Mock vault data structure doesn't match real contract data structure
- Static APR/TVL calculations need real-time computation
- No query invalidation strategy for blockchain state changes
- Missing transaction confirmation flows and loading states

---

## Phase 1: Core Functionality Integration (Essential)

### 1.1 Update Data Layer

**Task**: Replace mock data with real contract queries
**Files**: `/UI/client/src/data/mock-vaults.ts`, `/UI/client/src/types/vault.ts`

**Implementation:**
```typescript
// New interface to match real contract data
interface RealVault {
  id: string; // Contract address
  name: string; // "wS-USDC.e" 
  tokens: ["wS", "USDC.e"];
  platform: "Arca DLMM";
  chain: "Sonic";
  
  // Real-time contract data
  vaultBalanceX: string; // From useVault.vaultBalanceX
  vaultBalanceY: string; // From useVault.vaultBalanceY
  userSharesX: string; // From useVault.userSharesX
  userSharesY: string; // From useVault.userSharesY
  pricePerShareX: string; // From useVault.pricePerShareX
  pricePerShareY: string; // From useVault.pricePerShareY
  
  // Calculated values
  totalTvl: number; // vaultBalanceX + vaultBalanceY in USD
  userBalance: number; // User's total position in USD
  apr: number; // Calculated from historical data or external API
  aprDaily: number; // apr / 365
  
  contractAddress: string; // From getContracts()
  isActive: boolean;
}
```

**Success Criteria:**
- [x] Replace `Vault` interface with `RealVault` interface
- [x] Create `useRealVaults` hook that fetches live contract data
- [ ] Remove dependency on `mockVaults` in Vaults page

### 1.2 Update VaultCard Component

**Task**: Connect VaultCard to real contract data and functions
**Files**: `/UI/client/src/components/vault-card.tsx`

**Key Changes:**
1. **Replace static earnings display** with `useVault.userBalanceWS + useVault.userBalanceUSDC`
2. **Replace static balance display** with real token balances
3. **Connect deposit/withdraw forms** to `useVault.depositWS/depositUSDC/withdrawShares`
4. **Add approval flow** using `useVault.approveWS/approveUSDC` and `useVault.hasAllowance`
5. **Add transaction loading states** using `useVault.isWritePending/isConfirming`

**Implementation:**
```typescript
// In VaultCard component
const {
  vaultBalanceX,
  vaultBalanceY,
  userSharesX,
  userSharesY,
  userBalanceWS,
  userBalanceUSDC,
  depositWS,
  depositUSDC,
  approveWS,
  approveUSDC,
  hasAllowance,
  isWritePending,
  isConfirming,
} = useVault();

// Replace hardcoded "Balance: 0.00000" with:
// Balance: {tokenType === 'wS' ? userBalanceWS : userBalanceUSDC}
```

**Success Criteria:**
- [x] Display real user token balances 
- [x] Show actual vault TVL (vaultBalanceX + vaultBalanceY)
- [x] Connect deposit forms to real contract functions
- [x] Add proper loading states during transactions
- [x] Implement approval flow before deposits

### 1.3 Update Vaults Page

**Task**: Replace mock vault filtering with real vault data
**Files**: `/UI/client/src/pages/vaults.tsx`

**Key Changes:**
1. Replace `mockVaults` import with `useRealVaults()` hook
2. Update filtering logic to work with real vault data structure
3. Add loading states for contract data fetching
4. Implement real-time APR/TVL sorting

**Success Criteria:**
- [x] Page shows only real Arca vaults (wS-USDC.e)
- [x] Filtering and sorting work with contract data
- [x] Loading states during data fetching
- [x] Real-time updates when vault data changes

### 1.4 Basic Error Handling

**Task**: Add essential error handling for Web3 interactions
**Files**: New error boundary components, update existing components

**Implementation:**
```typescript
// Web3ErrorBoundary component
class Web3ErrorBoundary extends Component {
  // Handle MetaMask rejections, network switches, contract errors
}

// useVaultWithErrorHandling hook
function useVaultWithErrorHandling() {
  const vault = useVault();
  const [error, setError] = useState<string | null>(null);
  
  // Wrap contract calls with try-catch
  const safeDeposit = async (amount: string, tokenType: 'wS' | 'usdce') => {
    try {
      setError(null);
      if (tokenType === 'wS') {
        await vault.depositWS(amount);
      } else {
        await vault.depositUSDC(amount);
      }
    } catch (err) {
      setError(handleWeb3Error(err));
    }
  };
}
```

**Success Criteria:**
- [x] Graceful handling of MetaMask rejections
- [x] Clear error messages for network/contract issues
- [x] Retry mechanisms for failed transactions
- [x] Error boundaries prevent app crashes

---

## Phase 2: Enhanced User Experience (Important)

### 2.1 Transaction Confirmation & History

**Task**: Add comprehensive transaction flow components
**Files**: New transaction components, update VaultCard

**Features to Implement:**
1. **Transaction Confirmation Modal**: Show details before signing
2. **Transaction Progress Tracking**: Pending → Confirming → Success
3. **Transaction History**: Store and display past deposits/withdrawals
4. **Receipt Display**: Show transaction hash, gas used, final amounts

**Implementation:**
```typescript
// TransactionModal component
interface TransactionModalProps {
  type: 'deposit' | 'withdraw';
  amount: string;
  tokenType: 'wS' | 'usdce';
  fees: {
    depositFee: string; // 0.5%
    networkFee: string; // Gas estimate
  };
  onConfirm: () => void;
  onCancel: () => void;
}

// TransactionHistory hook
function useTransactionHistory() {
  // Track user's transaction history
  // Store in localStorage + sync with blockchain events
}
```

**Success Criteria:**
- [x] Users see transaction details before confirming
- [x] Real-time transaction status updates
- [x] Complete transaction history with receipts
- [x] Fee calculations displayed accurately

### 2.2 Real-time APR/TVL Calculations

**Task**: Implement dynamic APR and TVL calculations
**Files**: New calculation hooks, update vault data layer

**Data Sources:**
1. **TVL**: Sum of vault token balances * current token prices
2. **APR**: Historical reward data + current yield rates
3. **User APR**: Personal yield based on deposit timing

**Implementation:**
```typescript
// useVaultMetrics hook
function useVaultMetrics() {
  const { vaultBalanceX, vaultBalanceY } = useVault();
  const { data: tokenPrices } = useTokenPrices(['wS', 'USDC.e']);
  
  const totalTvl = useMemo(() => {
    if (!tokenPrices) return 0;
    return (
      parseFloat(vaultBalanceX) * tokenPrices.wS +
      parseFloat(vaultBalanceY) * tokenPrices.usdce
    );
  }, [vaultBalanceX, vaultBalanceY, tokenPrices]);
  
  // Calculate APR from Metro rewards + LP fees
  const currentApr = useVaultApr();
  
  return { totalTvl, currentApr };
}
```

**Success Criteria:**
- [x] Live TVL updates based on vault balances and token prices
- [x] APR calculations include Metro rewards + trading fees
- [x] User-specific metrics (earnings, ROI, total deposited)
- [x] Real-time updates when vault state changes

### 2.3 Enhanced Transaction Flow UI (POSTPONED - TDD Required)

**Status**: Will be implemented using TDD in Phase 3

---

## NEW Phase 2.5: Critical Test Coverage Implementation

### 2.5.1 Testing Infrastructure Setup

**Task**: Set up Vitest and testing libraries for React + Web3
**Files**: Create test configuration and utilities

**Installation:**
```bash
cd UI/client
npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event \
  msw @wagmi/test happy-dom
```

**Configuration Files:**
- `vitest.config.ts` - Test runner configuration
- `src/test-utils/setup.ts` - Global test setup
- `src/test-utils/test-providers.tsx` - React + Wagmi test wrappers
- `src/test-utils/mock-contracts.ts` - Contract interaction mocks

### 2.5.2 Critical Path Tests

**Test Priority Order:**
1. **useVault Hook Tests** (`src/hooks/__tests__/use-vault.test.ts`)
   - Contract read operations (balances, shares, prices)
   - Write operations (deposit, withdraw, approve)
   - Error handling and edge cases
   - State management during transactions

2. **VaultCard Component Tests** (`src/components/__tests__/vault-card.test.tsx`)
   - User deposit flow (input → approval → deposit → success)
   - User withdraw flow (input → withdraw → success)
   - Error states and validation
   - Loading and confirmation states

3. **useVaultMetrics Tests** (`src/hooks/__tests__/use-vault-metrics.test.ts`)
   - TVL calculation accuracy
   - APR calculation logic
   - User earnings and ROI calculations
   - Edge cases (zero balances, no price data)

4. **Transaction Flow Tests** (`src/components/__tests__/transaction-flow.test.tsx`)
   - Modal confirmation flow
   - Transaction progress tracking
   - Error recovery mechanisms
   - Transaction history updates

**Success Criteria:**
- [ ] 90%+ test coverage for critical paths
- [ ] All money-handling flows have comprehensive tests
- [ ] Edge cases and error paths are covered
- [ ] Tests run in <30 seconds

---

## Phase 3: Production Readiness (Critical)

### 3.1 Enhanced Transaction Flow UI (TDD Implementation)

**Approach**: Write tests first, then implement features

**Test-First Implementation Plan:**

1. **Input Validation Tests** (`src/hooks/__tests__/use-transaction-validation.test.ts`)
   ```typescript
   // Define behavior through tests:
   - Minimum deposit amounts (0.01 tokens)
   - Maximum decimal places (6 for wS, 6 for USDC.e)
   - Balance validation
   - Allowance checking
   - Network fee estimation
   ```

2. **Fee Calculation Tests** (`src/hooks/__tests__/use-fee-calculator.test.ts`)
   ```typescript
   // Test requirements:
   - 0.5% deposit fee calculation
   - 0.5% withdrawal fee calculation
   - Gas estimation integration
   - Slippage tolerance (0.5% default, user configurable)
   ```

3. **Transaction Preview Tests** (`src/components/__tests__/transaction-preview.test.tsx`)
   ```typescript
   // User flow tests:
   - Shows exact input amount
   - Displays all fees clearly
   - Calculates final received amount
   - Updates on input changes
   ```

**Implementation Order (TDD):**
1. Write failing tests for validation logic
2. Implement validation hook to pass tests
3. Write component integration tests
4. Implement UI components
5. Write E2E tests for full flow
6. Refactor for optimization

**Success Criteria:**
- [ ] All tests written before implementation
- [ ] 100% test coverage for new code
- [ ] Tests document all business rules
- [ ] Implementation matches test specifications exactly

### 3.2 Dashboard Real Data Integration (TDD Implementation)

**Approach**: Test-driven dashboard development

**Test-First Plan:**

1. **Dashboard Data Hook Tests** (`src/hooks/__tests__/use-dashboard-data.test.ts`)
   ```typescript
   // Test specifications:
   - Calculate total value from vault positions
   - Sum historical deposits from transaction history
   - Calculate earnings (current value - deposits)
   - Calculate ROI percentage
   - Handle edge cases (no positions, no history)
   ```

2. **Dashboard Component Tests** (`src/pages/__tests__/dashboard.test.tsx`)
   ```typescript
   // UI behavior tests:
   - Display total portfolio value
   - Show individual vault positions
   - Render transaction history
   - Update on data changes
   - Handle loading and error states
   ```

3. **Chart Integration Tests** (`src/components/__tests__/portfolio-chart.test.tsx`)
   ```typescript
   // Chart requirements:
   - Plot historical value over time
   - Show deposits as events
   - Calculate daily returns
   - Handle sparse data gracefully
   ```

**TDD Implementation Steps:**
1. Write tests defining dashboard data structure
2. Implement useDashboardData hook
3. Write component rendering tests  
4. Build dashboard UI components
5. Write integration tests
6. Add performance optimizations

**Success Criteria:**
- [ ] Tests define all dashboard requirements
- [ ] Dashboard shows accurate real-time data
- [ ] Historical tracking works correctly
- [ ] All edge cases handled gracefully

### 3.3 Performance Optimizations

**Task**: Optimize app performance and user experience
**Files**: Query optimization, caching, bundle improvements

**Optimizations:**
1. **Query Batching**: Batch multiple contract calls
2. **Smart Caching**: Cache stable data, refresh volatile data
3. **Code Splitting**: Lazy load pages and components
4. **Bundle Optimization**: Tree shaking, compression

**Implementation:**
```typescript
// Optimized contract calls
const { data: vaultData } = useContractReads({
  contracts: [
    { ...vaultContract, functionName: 'tokenBalance', args: [0] },
    { ...vaultContract, functionName: 'tokenBalance', args: [1] },
    { ...vaultContract, functionName: 'getShares', args: [userAddress, 0] },
    { ...vaultContract, functionName: 'getShares', args: [userAddress, 1] },
  ],
});

// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds for blockchain data
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

**Success Criteria:**
- [ ] <3 second initial load time
- [ ] Optimized RPC call batching
- [ ] Efficient re-rendering on state changes
- [ ] Minimal bundle size with code splitting

---

## Phase 4: Advanced Features (Nice-to-Have)

### 4.1 Advanced Analytics

**Task**: Add detailed performance tracking and analytics
**Features**: Yield farming analytics, position performance over time, comparative analysis

### 4.2 Real-time Notifications

**Task**: Implement push notifications for rebalance events, rewards, etc.
**Features**: WebSocket connections, background notifications, email alerts

### 4.3 Mobile Optimization

**Task**: Enhanced mobile experience and PWA features
**Features**: Mobile-specific UI patterns, offline support, app-like experience

---

## Progress Tracker

### Foundation (Completed ✅)
- [x] **Contract Integration**: `useVault` hook with all contract functions
- [x] **Wallet Integration**: RainbowKit setup with Sonic networks  
- [x] **Contract Configuration**: Addresses and ABIs for mainnet + fork
- [x] **Component Architecture**: Well-structured React components

### Phase 1: Core Functionality (Completed ✅)
- [x] **Data Layer Update**: Replace `Vault` interface with `RealVault`
- [x] **VaultCard Integration**: Connect to real contract functions
- [x] **Vaults Page Update**: Replace mock data with live queries
- [x] **Basic Error Handling**: Web3 error boundaries and handling

### Phase 2: Enhanced UX (PAUSED - Pivoting to TDD)
- [x] **Transaction Flows**: Confirmation modals and progress tracking  
- [x] **Real-time Calculations**: Live APR/TVL from contract + price data
- [ ] **Advanced Transaction UI**: TO BE IMPLEMENTED WITH TDD

### NEW Phase 2.5: Critical Test Coverage (PRIORITY) 🚨
- [ ] **Testing Infrastructure Setup**: Vitest + React Testing Library + Wagmi mocks
- [ ] **Critical Path Tests**: Tests for money-handling flows
  - [ ] useVault hook - contract interactions
  - [ ] VaultCard - deposit/withdraw user flows  
  - [ ] useVaultMetrics - calculation accuracy
  - [ ] Transaction confirmation flow
- [ ] **Test Coverage Target**: >90% for critical paths

### Phase 3: Production Ready (TDD-Driven) ✅
- [ ] **Advanced Transaction UI (TDD)**: Write tests first, then implement
- [ ] **Dashboard Integration (TDD)**: Test-driven dashboard development
- [ ] **Performance Optimization**: Query batching and caching

### Phase 4: Advanced Features (Future 🔮)
- [ ] **Advanced Analytics**: Detailed performance tracking
- [ ] **Real-time Notifications**: Event-based user alerts  
- [ ] **Mobile Optimization**: PWA and mobile-specific features

---

## TDD Methodology for UI Development

### Why We're Pivoting to TDD

After implementing Phases 1-2.2 without tests, we recognized that:
1. **Critical money flows need test coverage** - Deposits/withdrawals handle real value
2. **Calculation accuracy is essential** - APR/TVL/earnings must be precise
3. **Future changes need safety** - Tests prevent regression bugs

### TDD Process for Remaining Work

**For Phase 2.5 (Critical Tests):**
1. Write tests for EXISTING critical code
2. Ensure tests accurately describe current behavior
3. Refactor code if tests reveal issues

**For Phase 3+ (New Features):**
1. **RED**: Write failing tests that define requirements
2. **GREEN**: Implement minimal code to pass tests
3. **REFACTOR**: Improve code while maintaining green tests

### Example TDD Flow for New Features

```typescript
// 1. RED - Write test first
describe('Enhanced Transaction UI', () => {
  it('should validate minimum deposit amount of 0.01 tokens', () => {
    const { result } = renderHook(() => useTransactionValidation());
    expect(result.current.validateDeposit('0.005')).toBe({
      valid: false,
      error: 'Minimum deposit is 0.01 tokens'
    });
  });
});

// 2. GREEN - Implement to pass
export function useTransactionValidation() {
  const validateDeposit = (amount: string) => {
    const value = parseFloat(amount);
    if (value < 0.01) {
      return { valid: false, error: 'Minimum deposit is 0.01 tokens' };
    }
    return { valid: true };
  };
  return { validateDeposit };
}

// 3. REFACTOR - Improve implementation
// Extract constants, add more validations, etc.
```

### Testing Stack

**Core Testing Libraries:**
- **Vitest**: Fast unit test runner (Vite-native)
- **React Testing Library**: Component testing
- **@testing-library/user-event**: User interaction simulation
- **MSW**: Mock API responses
- **wagmi/test**: Mock blockchain interactions

**Test Organization:**
```
UI/client/src/
├── hooks/__tests__/
│   ├── use-vault.test.ts          # Contract interaction tests
│   ├── use-vault-metrics.test.ts  # Calculation tests
│   └── use-token-prices.test.ts   # Price fetching tests
├── components/__tests__/
│   ├── vault-card.test.tsx        # Component integration
│   └── transaction-modal.test.tsx # User flow tests
└── test-utils/
    ├── mock-contracts.ts          # Contract mocks
    └── test-providers.tsx         # Test wrappers
```

---

## Technical Implementation Notes

### Critical Contract Data Mapping

**Current Mock Structure → Real Contract Structure:**
```typescript
// OLD (Mock)
interface Vault {
  earnings: number;     // Static mock number
  poolTvl: number;      // Static mock number  
  farmTvl: number;      // Static mock number
  apr: number;          // Static mock number
}

// NEW (Real Contract)
interface RealVault {
  userBalanceUSD: number;       // Calculated from userSharesX/Y * pricePerShare * tokenPrice
  totalTvlUSD: number;          // vaultBalanceX/Y * tokenPrices
  userTvlUSD: number;           // User's portion of vault TVL
  apr: number;                  // Calculated from Metro rewards + LP fees
}
```

### Query Invalidation Strategy

**When to Refresh Data:**
- **On Transaction Success**: Invalidate user balances, shares, allowances
- **On Block Updates**: Refresh vault balances, share prices (every 30s)
- **On Chain Switch**: Refetch all contract data
- **On Account Change**: Refetch user-specific data

**Implementation:**
```typescript
// In useVault hook
const { data: hash } = useWaitForTransactionReceipt({ hash: txHash });

useEffect(() => {
  if (hash) {
    // Transaction confirmed, invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['userBalances'] });
    queryClient.invalidateQueries({ queryKey: ['userShares'] });
    queryClient.invalidateQueries({ queryKey: ['allowances'] });
  }
}, [hash]);
```

### Error Handling Strategy

**Error Categories:**
1. **Network Errors**: RPC failures, timeouts
2. **Wallet Errors**: User rejections, insufficient funds
3. **Contract Errors**: Revert reasons, gas estimation failures
4. **UI Errors**: Invalid inputs, loading failures

**Error Recovery:**
- Automatic retry for network errors
- Clear user guidance for wallet errors
- Fallback UI states for loading failures
- Graceful degradation when features unavailable

---

## Success Metrics

### Functional Success Criteria
- **Zero Mock Data**: All UI components use real contract data
- **Complete Transaction Flows**: Users can deposit, withdraw, track positions
- **Real-time Updates**: UI reflects actual blockchain state within 30 seconds
- **Error Resilience**: <1% of user interactions result in unhandled errors

### Performance Success Criteria  
- **Load Time**: <3 seconds initial page load
- **Transaction Time**: <5 seconds from initiation to confirmation UI
- **Data Freshness**: Contract data updates within 30 seconds of chain changes
- **Reliability**: >99% uptime for core functionality

### Quality Success Criteria
- **Test Coverage**: >90% for components and hooks
- **Type Safety**: 100% TypeScript coverage, no `any` types
- **Accessibility**: WCAG 2.1 AA compliance for core features
- **Mobile Experience**: Full functionality on mobile devices

### User Experience Success Criteria
- **Intuitive Flow**: Users can complete deposit/withdraw without documentation
- **Clear Feedback**: Every action provides immediate visual feedback
- **Error Recovery**: Users can recover from errors without page refresh
- **Trust Indicators**: Transaction details and confirmations build user confidence
