# UI Fake Data Audit

**Purpose**: Document all locations where fake/mocked data is shown to users  
**Date**: December 2024  
**Status**: CRITICAL - Users see fake financial information

---

## 🚨 Files Containing Fake Data

### 1. `src/hooks/use-token-prices.ts` - ALL PRICES ARE FAKE
**Location**: Lines 18-24
```typescript
const MOCK_TOKEN_PRICES: Record<string, number> = {
  ws: 0.85, // Mock price for wrapped Sonic
  "usdc.e": 1.0, // USDC.e should be pegged to ~$1
  usdc: 1.0, // USDC should be pegged to ~$1
  metro: 2.5, // Mock price for METRO token
};
```
**Impact**: All USD calculations in the UI are wrong  
**User sees**: Wrong portfolio values, wrong TVL, wrong earnings

### 2. `src/hooks/use-vault-metrics.ts` - APR IS COMPLETELY FAKE
**Location**: Lines 54-68
```typescript
// For development: use mock APR calculation
const baseAPR = 45; // Base 45% APR
const tvlFactor = Math.max(0.5, Math.min(1.0, 100000 / totalTvlUSD));
const seasonalBonus = 1.2; // 20% bonus for early participation
return baseAPR * tvlFactor * seasonalBonus;
```
**Impact**: Users see fake yield promises  
**User sees**: 45-55% APR that doesn't exist

### 3. `src/hooks/use-transaction-history.ts` - MANUAL TRACKING, NOT BLOCKCHAIN
**Location**: Lines 28-43, 132-140
```typescript
// Load transactions from localStorage on mount
const stored = localStorage.getItem(storageKey);

// Calculate total deposited
// Simple USD calculation - in production would use real token prices
return sum + amount;
```
**Impact**: Users must manually track deposits, USD values are wrong  
**User sees**: Incomplete transaction history, wrong cost basis

### 4. `src/data/mock-vaults.ts` - REFERENCED FOR FILTERING
**Location**: Entire file
```typescript
export const platforms = ["Arca DLMM", "Shadow Exchange", "All Platforms"];
export const chains = ["Sonic", "Sonic Fork", "All Chains"];
export const sortOptions = ["APR ↓", "APR ↑", "TVL ↓", "TVL ↑"];
```
**Impact**: UI filter options reference mock data structure

---

## 💀 Impact on User Experience

### Dashboard Shows
- ❌ **Fake Portfolio Value**: Based on wrong token prices
- ❌ **Fake APR**: 45-55% promises that don't exist  
- ❌ **Fake TVL**: Calculated with wrong prices
- ❌ **Fake Earnings**: Based on manual transactions + wrong prices
- ❌ **Fake ROI**: Calculated from fake data

### Vault Cards Show
- ❌ **Fake APR**: 45% yield promises
- ❌ **Fake USD Values**: Wrong position values
- ❌ **Fake Earnings**: Incorrect profit/loss display

### What's Actually Real
- ✅ **Share Amounts**: Real queries from contracts
- ✅ **Vault Balances**: Real token amounts in contracts
- ✅ **Transactions**: Real contract calls work
- ✅ **User Balances**: Real ERC20 balances

---

## 🔧 Files That Need Real Data Integration

### Priority 1: Critical (Misleading Users)
1. **`use-token-prices.ts`**: Replace with CoinGecko/DEX integration
2. **`use-vault-metrics.ts`**: Replace APR with real reward calculations
3. **`use-transaction-history.ts`**: Replace with blockchain event indexing

### Priority 2: Important (Accuracy)
4. **`use-vault-metrics.ts`**: Real TVL from contracts + real prices
5. **`use-dashboard-data.ts`**: Real portfolio calculations
6. **`use-real-vaults.ts`**: Remove fake metric dependencies

### Priority 3: Polish (UX)
7. **`data/mock-vaults.ts`**: Replace with dynamic discovery
8. **Dashboard components**: Add loading states for real data
9. **Error handling**: Price feed failures, stale data

---

## 🚨 Immediate Actions Required

### 1. Add Warnings to UI (URGENT)
Add banners to:
- Dashboard: "⚠️ DEMO DATA - NOT REAL PRICES OR APR"
- Vault cards: "TEST APR - NOT ACTUAL YIELDS"
- Portfolio values: "DEMO USD VALUES"

### 2. Disable Misleading Features
- Hide portfolio USD values until prices are real
- Mark APR as "TEST" not promises
- Add disclaimers to all financial metrics

### 3. Communication Strategy
- Clear documentation that this is demo/test data
- Do not show to real users without warnings
- Set proper expectations about data accuracy

---

## 📊 Real Data Requirements

### Token Prices
- **wS**: Need real price from Sonic DEX or oracle
- **USDC.e**: Should be ~$1 but verify with real feeds
- **METRO**: Need real market price from DEX

### APR Calculation
- Query real METRO rewards from rewarder contract
- Calculate actual trading fee earnings
- Real compounding frequency analysis
- Historical yield performance

### Transaction History
- Index deposit/withdraw events from vault contracts
- Calculate real USD values using historical prices
- Real gas costs and transaction timing
- Proper cost basis tracking

---

*Audit Date: December 2024*  
*Next Review: After real data integration complete*