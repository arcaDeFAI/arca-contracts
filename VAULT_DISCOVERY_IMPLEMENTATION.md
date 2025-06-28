# Vault Discovery Implementation Status

**Document Created**: 2025-06-28  
**Status**: Phase 1 In Progress  
**Next Developer**: Continue from Phase 1 implementation  

## Problem Statement

The UI was stuck showing "Loading vaults..." because:
1. UI was hardcoded to expect a single wS/USDC.e vault
2. No dynamic vault discovery mechanism
3. Current deployment creates registry-per-vault instead of global registry
4. Export script missing contract addresses needed by UI

## Architecture Target

**Global Registry Pattern**: One registry per network that all vaults register with, enabling dynamic vault discovery.

## Implementation Plan & Status

### ✅ Phase 0: Export & Import Fixes (COMPLETED)
**Status**: ✅ **COMPLETED**

**What was done**:
- Fixed export script to include all contract addresses (`feeManager`, `queueHandler`, `rewardClaimer`)
- Removed magic number fallbacks (31337) and zero address fallbacks  
- Fixed UI deployment loader to use proper addresses

**Files Changed**:
- `scripts/export-addresses.ts` - Added missing contract addresses
- `UI/src/lib/deployment-loader.ts` - Removed fallbacks, added validation
- `UI/src/lib/vault-configs.ts` - Removed magic numbers

### 🔄 Phase 1: Registry-Based Discovery (IN PROGRESS)
**Status**: 🔄 **IN PROGRESS** - 70% complete

**Goal**: Use existing registry for vault discovery instead of hardcoded vault

**What's been done**:
- ✅ Created `useVaultRegistry` hook for dynamic vault discovery
- ✅ Added `REGISTRY_ABI` to contracts  
- ✅ Updated `useRealVaults` to use registry instead of hardcoded vault
- ✅ Fixed import/usage of registry discovery

**Remaining work**:
- ⏳ Test the new registry-based discovery
- ⏳ Debug any contract call issues
- ⏳ Ensure vault data displays correctly in UI

**Files changed**:
- ✅ `UI/src/hooks/use-vault-registry.ts` - New registry discovery hook
- ✅ `UI/src/lib/contracts.ts` - Added REGISTRY_ABI
- ✅ `UI/src/hooks/use-real-vaults.ts` - Use registry instead of hardcoded vault

**Key technical details**:
- Registry contract is deployed at deployment time and contains `getActiveVaults()` 
- UI calls registry to get vault addresses, then queries vault details
- Currently supports single vault (first from registry), easily extendable to multiple

### 📋 Phase 2: Global Registry Architecture (PENDING)
**Status**: 📋 **PENDING**

**Goal**: Change deployment to use one global registry per network

**Work needed**:
1. Modify `scripts/deployArcaSystem.ts`:
   - Check if registry exists for network before deploying new one
   - Deploy global registry only on first vault deployment  
   - Reuse existing registry for subsequent vault deployments
   
2. Update export system to export global registry address

3. Test multi-vault scenario

**Estimated effort**: 2-3 hours

### 📋 Phase 3: Generic UI Support (PENDING)  
**Status**: 📋 **PENDING**

**Goal**: Support arbitrary token pairs, not just wS/USDC.e

**Work needed**:
1. Remove hardcoded token symbols from UI interfaces
2. Query token symbols dynamically from contracts
3. Update vault configuration generation to be fully dynamic
4. Support multiple vaults in UI

**Estimated effort**: 4-6 hours

## Current State Analysis

### ✅ What's Working
- Export script includes all necessary contract addresses
- Registry contract is correctly designed for multi-vault discovery
- Deployment script registers vault with registry
- Basic vault discovery hook implemented

### ❌ What's Broken
- UI stuck on "Loading vaults..." due to CoinGecko API failures
- CoinGecko CORS errors and rate limiting (HTTP 429) blocking price fetching
- `useVaultMetrics` waiting indefinitely for price data that never comes
- Each deployment creates its own registry (should be global)
- UI interfaces still expect hardcoded token symbols

### 🔧 Current Debugging Status (2025-06-28)
**Tested and Working**:
- ✅ Contract calls to localhost:8545 (Hardhat node) are successful
- ✅ Wallet connection working properly
- ✅ React hooks error fixed (no more connect/disconnect crashes)
- ✅ Registry contract exists and is deployed

**Current Blocking Issue**:
- ❌ CoinGecko API calls failing with CORS + Rate Limiting errors
- ❌ Console shows: `No chainId provided to getActiveVaultConfigs` 
- ❌ `useVaultMetrics` hook waiting for price data that fails to load

**Root Cause Analysis**:
Network logs show contract calls working but price fetching failing:
```
✅ POST http://127.0.0.1:8545/ [200 OK] - Contract calls working
❌ GET https://api.coingecko.com/api/v3/simple/price [429/CORS] - Price fetching broken
```

**Immediate Debug Strategy**:
To isolate vault discovery from price fetching issues:

1. **Mock Price Override for Localhost**: 
   - Modify `useVaultMetrics` to return mock prices when `chainId === 31337`
   - Use fixed prices: wS = $1.00, USDC.e = $1.00
   - This allows testing vault discovery without price API dependencies

2. **Registry Discovery Debug**:
   - Check if `useVaultRegistry` hook is being called correctly
   - Verify registry contract calls in browser Network tab
   - Debug why "No chainId provided" error still occurs

3. **Step-by-step Isolation**:
   ```javascript
   // Temporary localhost override in useVaultMetrics:
   const { chainId } = useAccount();
   if (chainId === 31337) {
     return {
       isLoading: false,
       error: null,
       tokenPrices: { tokenX: 1.0, tokenY: 1.0 },
       totalTvlUSD: 1000, // Mock values
       estimatedApr: 15.5,
       // ... other mock metrics
     };
   }
   ```

4. **Registry Contract Call Verification**:
   - Add console logging to `useVaultRegistry` hook
   - Verify `registry.getActiveVaults()` is being called
   - Check if registry address is correct in deployment exports

## Technical Details

### Registry Contract Interface
```solidity
function getActiveVaults() external view returns (address[] memory)
function getVaultInfo(address vault) external view returns (VaultInfo memory)
```

### Current Deployment Flow
```
1. Deploy vault system (vault, feeManager, queueHandler, rewardClaimer)
2. Deploy registry
3. Register vault with registry
4. Export all addresses
```

### UI Discovery Flow  
```
1. UI queries registry.getActiveVaults() 
2. UI calls registry.getVaultInfo(vaultAddress) for each vault
3. UI displays vault data
```

## Task Status & TODO List

### ✅ Completed Tasks
- [x] **Fix magic number fallbacks** - Removed 31337 hardcoded fallbacks, added explicit error handling
- [x] **Fix dashboard hooks error** - Added missing chainId parameter to getVaultConfig calls
- [x] **Fix React hooks error** - Removed early returns causing connect/disconnect crashes
- [x] **Update documentation** - Current debugging status and strategy documented

### 🔄 In Progress Tasks  
- [ ] **Fix UI vault loading** - Currently blocked on price fetching CORS issues
- [ ] **Phase 1: Vault discovery** - Registry-based discovery implemented but needs testing

### 📋 Pending High Priority Tasks
- [ ] **Fix CORS price fetching** - Implement mock prices for localhost development
- [ ] **Debug registry discovery** - Verify registry contract calls and address correctness

### 📋 Pending Medium Priority Tasks
- [ ] **Phase 2: Global registry** - Align deployment scripts to use global registry pattern  
- [ ] **Phase 3: Generic UI** - Update UI interfaces for arbitrary token pairs and multi-vault support

### 📋 Pending Low Priority Tasks
- [ ] **Long-term vault discovery** - Evaluate if vault discovery mechanism needs changes across networks

## Next Steps for Developer

### Immediate (Phase 1 completion):
1. **Implement Mock Price Override** (Quick Fix):
   ```bash
   # Add localhost price override to useVaultMetrics
   # This isolates vault discovery from price fetching issues
   ```

2. **Test vault discovery**:
   ```bash
   # Ensure hardhat node is running
   npx hardhat node
   
   # Deploy contracts  
   npm run deploy:local
   
   # Export addresses
   npm run deploy:export
   
   # Test UI (in UI directory)
   cd UI && npm run dev
   ```

3. **Debug registry issues**:
   - Check browser console for registry contract call errors
   - Verify registry address is correct in deployment exports
   - Add console logging to `useVaultRegistry` hook
   - Test registry contract calls manually if needed

4. **Fix long-term price fetching**:
   - Implement CORS proxy or server-side price fetching
   - Add fallback price mechanisms for development

5. **If working**: Mark Phase 1 complete, move to Phase 2

### Medium-term (Phase 2):
1. Modify deployment script for global registry pattern
2. Test multi-vault deployment scenario  

### Long-term (Phase 3):
1. Make UI fully generic for arbitrary token pairs
2. Support multiple vaults in UI

## Key Files & Locations

### Contract Files
- `contracts/deployment/ArcaVaultRegistry.sol` - Registry contract
- `scripts/deployArcaSystem.ts` - Deployment script (registers vault)
- `scripts/export-addresses.ts` - Export contract addresses

### UI Files
- `UI/src/hooks/use-vault-registry.ts` - Vault discovery hook
- `UI/src/hooks/use-real-vaults.ts` - Main vault data hook  
- `UI/src/lib/contracts.ts` - Contract ABIs
- `UI/src/lib/deployment-loader.ts` - Load deployed addresses

### Config Files
- `exports/deployments.ts` - Exported contract addresses (auto-generated)
- `deployments/localhost/latest.json` - Full deployment data

## Success Criteria

### Phase 1 Success:
- [ ] UI shows vault card instead of "Loading vaults..."
- [ ] Vault data (balances, APR, etc.) displays correctly
- [ ] No console errors related to contract calls

### Phase 2 Success:  
- [ ] Multiple vault deployments reuse same registry
- [ ] UI discovers all vaults from single registry

### Phase 3 Success:
- [ ] UI works with arbitrary token pairs (not just wS/USDC.e)
- [ ] Support for multiple vaults in UI

