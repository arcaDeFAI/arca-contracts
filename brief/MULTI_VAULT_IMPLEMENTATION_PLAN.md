## 📋 Comprehensive Multi-Vault Testing Implementation Plan

> **Last Updated**: January 4, 2025
>
> **Overall Status**: Phases 1-5 COMPLETED ✅ | Phase 6 IN PROGRESS 🚧
> 
> **Completed Work**:
> - Multi-vault configuration system implemented
> - Token deployment simplified (removed MockERC20Testnet)
> - LBPair management with proper rewarder discovery
> - Unified deployment system with progress tracking
> - Scripts reorganized and consolidated
> - Multi-vault integration test created (9/14 tests passing)
>
> **Current Blockers**:
> 1. BeaconProxy provider access pattern issue in tests
> 2. Contract interface mismatches (shares access, reward claiming)
> 3. MockLBPair duplicate getReserves() function (fixed)
>
> **Remaining**: Complete Phase 6 testing, then Phases 7-8 (Documentation, UI Support)

### 🎯 Objective
Enable thorough manual testing of multiple Arca vaults on localhost and testnet with configurable token pairs and simplified test token management.

### 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                Network Configuration                 │
│  (localhost.json / sonic-testnet.json)              │
│                                                      │
│  vaults: [                                          │
│    { id: "ws-usdc", tokens: {...}, ... },          │
│    { id: "metro-usdc", tokens: {...}, ... },       │
│    { id: "test1-test2", tokens: {...}, ... }       │
│  ]                                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            Universal Deployment Script               │
│                                                      │
│  1. Deploy/retrieve shared contracts (METRO, etc)   │
│  2. For each vault:                                 │
│     - Deploy/retrieve tokens                        │
│     - Create/retrieve LBPair                        │
│     - Deploy vault system                           │
│     - Register in registry                          │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Configuration Schema & Infrastructure

### 1.1 Multi-Vault Configuration Schema
- [x] Create `config/schemas/network-config.schema.json` for validation
- [x] Update `config/networks/localhost.json` with multi-vault structure
- [x] Update `config/networks/sonic-testnet.json` with multi-vault structure
- [ ] Add configuration type definitions in `scripts/types/config.ts`

**New Configuration Structure:**
```json
{
  "name": "localhost",
  "chainId": 31337,
  "sharedContracts": {
    "metroToken": "DEPLOY_MOCK",
    "lbRouter": "DEPLOY_MOCK",
    "lbFactory": "DEPLOY_MOCK"
  },
  "testAccounts": {
    "fundingAmount": "1000000"  // Amount of each token to give test accounts
  },
  "vaults": [
    {
      "id": "ws-usdc",
      "enabled": true,
      "tokens": {
        "tokenX": {
          "address": "DEPLOY_MOCK",
          "symbol": "wS",
          "name": "Wrapped Sonic",
          "decimals": 18,
          "deployMock": true
        },
        "tokenY": {
          "address": "DEPLOY_MOCK",
          "symbol": "USDC",
          "name": "USD Coin",
          "decimals": 6,
          "deployMock": true
        }
      },
      "lbPair": {
        "address": "DEPLOY_MOCK",
        "deployMock": true,
        "binStep": 25,
        "activeId": 8388608  // Price = 1.0
      },
      "deployment": {
        "vaultName": "Arca wS-USDC Vault",
        "vaultSymbol": "ARCA-wS-USDC",
        "amountXMin": "1000000000000000",
        "amountYMin": "1000000",
        "idSlippage": "5",
        "feeRecipient": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      }
    }
  ]
}
```

### 1.2 Type System Updates
- [x] Create `scripts/types/config.ts` with proper TypeScript interfaces
- [x] Add validation functions for configuration
- [ ] Update existing scripts to use new types

---

## Phase 2: Test Token System

### 2.1 Enhanced MockERC20 Contract
- [x] Modify `contracts/mocks/MockERC20.sol`:
  - [x] Add constructor parameter for initial holder address
  - [x] Mint 1 billion tokens on deployment to initial holder
  - [x] Keep existing mint function for flexibility
- [x] ~~Create `contracts/mocks/MockERC20Testnet.sol`~~ - Removed for simplicity
  - [x] ~~Inherit from MockERC20~~ - Not needed
  - [x] ~~Add Ownable~~ - Not needed
  - [x] ~~Restrict mint() to owner only~~ - Using open minting on all networks

### 2.2 Token Deployment Utilities
- [x] Create `scripts/utils/token-deployer.ts`:
  - [x] `deployMockToken()` - Deploy token with high initial balance
  - [x] `distributeTokens()` - Send tokens to test accounts
  - [x] ~~Network-aware deployment~~ - Simplified to use MockERC20 everywhere
- [x] ~~Update `scripts/utils/deploy-mocks.ts`~~ - No longer needed with new multi-vault system
  - [x] Token deployment integrated into multi-vault-deployer.ts
  - [x] Multiple token deployments supported
  - [x] Token distribution via transfers from deployer

**Token Distribution Strategy:**
```typescript
// Each test account receives:
// - 1,000,000 tokens with 18 decimals
// - 1,000,000 tokens with 6 decimals  
// - 1,000,000 METRO tokens
```

---

## Phase 3: LBPair Creation & Management

### 3.1 LBPair Factory Integration
- [x] Create `scripts/utils/lb-pair-manager.ts`:
  - [x] `checkExistingPair()` - Query factory for existing pairs
  - [x] `createLBPair()` - Create new pair via factory
  - [x] `addInitialLiquidity()` - Add liquidity to new pairs
  - [x] Network-specific logic (mock vs real factory)

### 3.2 Testnet-Specific LBPair Handling
- [ ] Implement pair creation flow for testnet:
  - [ ] Use Metropolis LBFactory at `0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7`
  - [ ] Calculate appropriate activeId based on token decimals
  - [ ] Add substantial initial liquidity (using test tokens)
  - [ ] Handle pair already exists scenarios

**Initial Liquidity Parameters:**
```typescript
// For new pairs on testnet:
// - 100,000 tokenX (adjusted for decimals)
// - 100,000 tokenY (adjusted for decimals)
// - Centered around 1:1 price ratio initially
```

---

## Phase 4: Unified Deployment System

### 4.1 Core Deployment Refactor
- [x] Create `scripts/utils/multi-vault-deployer.ts`:
  - [x] `deploySharedContracts()` - Registry, beacons, shared tokens
  - [x] `deployVaultSystem()` - Single vault deployment logic
  - [x] `deployAllVaults()` - Orchestration for multiple vaults
  - [x] Progress tracking and resume capability

### 4.2 Network Adapters
- [x] ~~Create `scripts/utils/network-adapter.ts`~~ - Not needed after simplification
  - [x] Network differences handled directly in multi-vault-deployer.ts
  - [x] Simplified logic - same token contracts on all networks
  - [x] Consistent deployment flow everywhere

### 4.3 Main Deployment Script
- [x] Create `scripts/deploy-multi-vault.ts`:
  - [x] Accept `--vaults` parameter for selective deployment
  - [x] Add `--resume` flag for continuing failed deployments
  - [ ] Implement parallel deployment where possible
  - [x] Generate deployment report

**Command Structure:**
```bash
# Deploy all vaults
npm run deploy --network localhost

# Deploy specific vaults
npm run deploy --network testnet --vaults "ws-usdc,test1-test2"

# Resume failed deployment
npm run deploy --network localhost --resume
```

### 4.4 Progress Tracking
- [x] Implement deployment state management:
  - [x] Save progress to `deployments/<network>/multi-vault-progress.json`
  - [x] Track: registry, beacons, each vault status
  - [x] Enable graceful resume on failure

---

## Phase 5: Script Organization & Consolidation

### 5.1 Script Cleanup
- [x] Consolidate mock deployment logic into multi-vault deployer
- [ ] Remove redundant deployment scripts
- [x] Create shared utility functions in `scripts/utils/multi-vault-config.ts`
- [x] Ensure all scripts follow consistent patterns

### 5.2 New Script Structure
```
scripts/
├── deploy-multi-vault.ts        # Main entry point for multi-vault
├── deployArcaSystem.ts          # Legacy single-vault deployment
├── utils/
│   ├── multi-vault-deployer.ts  # Core deployment logic
│   ├── multi-vault-config.ts    # Configuration management
│   ├── token-deployer.ts        # Token deployment
│   ├── lb-pair-manager.ts       # LBPair management
│   └── network-config.ts        # Legacy config (single-vault)
└── [other existing scripts]
```

---

## Phase 6: Testing Infrastructure Updates

### 6.1 Multi-Vault Test Suite
- [x] Create `test/multi-vault.integration.test.ts`:
  - [x] Test deploying multiple vaults
  - [x] Test registry interactions
  - [x] Test cross-vault scenarios
  - [x] Test vault discovery

**Current Status**: Test file created with 14 comprehensive tests covering:
- Multi-vault deployment with shared infrastructure
- Token reuse between vaults
- Beacon proxy verification
- Independent vault operations
- Cross-vault reward handling
- Edge cases and concurrent operations

**Test Results**: 9/14 tests passing
- ✅ Deployment and basic operations working
- ❌ 5 tests failing due to:
  1. BeaconProxy provider access issue
  2. Incorrect shares access pattern (using private mapping instead of getShares function)
  3. Wrong reward claiming function name (claimAllRewards vs claimAndCompoundRewards)
  4. Incorrect rebalance parameters (using struct instead of individual params)

### 6.2 Test Utilities
- [x] ~~Update `test/utils/test-helpers.ts`~~ - Not needed
  - Each test file contains its own deployment fixtures
  - Multi-vault patterns established in test file
  - No centralized test utilities in this codebase

### 6.3 Existing Test Updates
- [x] Existing tests remain compatible
- [x] MockERC20 constructor updated to support multi-vault pattern
- [x] Fixed MockLBPair compilation error (duplicate getReserves)

**Immediate Action Items**:
1. Fix ethers.provider access for BeaconProxy verification
2. Update all shares access to use `getShares(user, tokenType)`
3. Change `claimAllRewards()` to `claimAndCompoundRewards()`
4. Verify rebalance struct parameters match contract

---

## Phase 7: Documentation Updates

### 7.1 DEPLOYMENT.md Updates
- [ ] Add "Multi-Vault Deployment" section:
  - [ ] Configuration format explanation
  - [ ] Example configurations
  - [ ] Command reference
  - [ ] Troubleshooting guide
- [ ] Add "Test Token Management" section:
  - [ ] Token deployment process
  - [ ] Initial balance distribution
  - [ ] Network-specific considerations
- [ ] Update existing sections for multi-vault context

### 7.2 README.md Updates
- [ ] Update setup instructions for multi-vault
- [ ] Add quick start for multi-vault testing
- [ ] Update architecture diagram

### 7.3 New Documentation
- [ ] Create `docs/MULTI_VAULT_GUIDE.md`:
  - [ ] Detailed configuration guide
  - [ ] Testing scenarios
  - [ ] Best practices
- [ ] Create `docs/TEST_TOKENS.md`:
  - [ ] Token deployment guide
  - [ ] Distribution strategies
  - [ ] Network considerations

---

## Phase 8: UI Integration Support

### 8.1 Deployment Exports
- [ ] Update `scripts/utils/export-deployments.ts`:
  - [ ] Export all vault addresses
  - [ ] Include test token addresses
  - [ ] Generate UI-friendly format

### 8.2 UI Configuration
- [ ] Ensure `exports/deployments.json` includes:
  - [ ] All deployed vaults
  - [ ] Test token addresses
  - [ ] LBPair addresses
  - [ ] Network metadata

---

## 🔄 Implementation Order

1. **Week 1 - Foundation**
   - Phase 1: Configuration Schema
   - Phase 2: Test Token System
   - Phase 3: LBPair Management

2. **Week 1-2 - Core Implementation**
   - Phase 4: Unified Deployment System
   - Phase 5: Script Organization

3. **Week 2 - Testing & Documentation**
   - Phase 6: Testing Infrastructure
   - Phase 7: Documentation
   - Phase 8: UI Support

---

## ✅ Success Criteria

### Localhost
- [ ] Deploy 3+ vaults with different token pairs in single command
- [ ] All test accounts funded with test tokens automatically
- [ ] Deployment completes in under 2 minutes
- [ ] Can resume failed deployments

### Testnet
- [ ] Deploy custom test tokens with correct permissions
- [ ] Create new LBPairs via Metropolis factory
- [ ] Successfully deploy vaults using custom pairs
- [ ] Test tokens distributed to QA wallets

### General
- [ ] All existing tests pass
- [ ] Documentation fully updated
- [ ] Minimal script proliferation (< 5 new scripts)
- [ ] Clean, maintainable code structure

---

## 🚨 Critical Reminders

1. **Network Awareness**: Every component must handle localhost/testnet/mainnet
2. **Test Token Security**: Owner-only minting on testnet, public on localhost
3. **METRO Token**: Shared across all vaults (matches mainnet behavior)
4. **Error Handling**: Graceful failures with resume capability
5. **Gas Optimization**: Batch operations where possible
6. **Documentation**: Update as you implement, not after

---

## 📝 Notes for Implementation

- Start with localhost, then adapt for testnet
- Test each phase thoroughly before moving on
- Keep backward compatibility with single-vault deployments
- Consider gas costs for multi-vault deployments on testnet
- Save all deployment artifacts for debugging

---

## 🔧 Current Work: Fixing Multi-Vault Tests

### Problem Analysis
The multi-vault integration test has 5 failing tests due to incorrect assumptions about contract interfaces:

1. **BeaconProxy Provider Issue** (Line 329)
   - Error: "Cannot read properties of undefined (reading 'connect')"
   - Likely cause: Import issue or ethers.provider not available in test context
   - Solution: Debug import chain and provider access pattern

2. **Shares Access Pattern** (Multiple locations)
   - Error: "vault.shares is not a function"
   - Cause: Attempting direct access to private mapping
   - Solution: Use `vault.getShares(user, tokenType)` instead

3. **Reward Claiming Function** (Line 566)
   - Error: "claimAllRewards is not a function"
   - Cause: Wrong function name
   - Solution: Use `claimAndCompoundRewards()` instead

4. **Test Patterns to Fix**:
   ```typescript
   // WRONG:
   await vault.shares(alice.address, TokenType.TokenX)
   // CORRECT:
   await vault.getShares(alice.address, TokenType.TokenX)
   
   // WRONG:
   await rewardClaimer.claimAllRewards()
   // CORRECT:
   await rewardClaimer.claimAndCompoundRewards()
   ```

### Next Developer Actions
1. **Fix the 5 failing tests** in `test/multi-vault.integration.test.ts`
2. **Run full test suite** to ensure no regressions
3. **Move to Phase 7** - Update documentation with multi-vault deployment instructions
4. **Complete Phase 8** - Update export scripts for UI integration

### Success Metrics
- All 14 multi-vault tests passing
- No regression in existing tests
- Clean deployment of 3+ vaults in single command
- Documentation updated for end users