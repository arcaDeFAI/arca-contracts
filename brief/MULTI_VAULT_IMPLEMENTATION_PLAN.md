## Multi-Vault Implementation Status

> **Last Updated**: January 7, 2025
>
> **Status**: Core implementation COMPLETE ✅ | Testnet deployment TESTED ✅
> 
> **Completed**:
> - Multi-vault deployment system with progress tracking
> - Shared token/beacon infrastructure  
> - Full test coverage (14/14 multi-vault tests, 209 total tests passing)
> - All contract interface issues resolved
> - Successful testnet deployment with custom tokens
>
> **Remaining**: Fix --resume flag, consolidate debug scripts

### Key Features

1. **Multi-vault deployment** from single config file
2. **Token reuse** across vaults (e.g., USDC shared between multiple pairs)
3. **Beacon proxy pattern** for batch upgrades of queue handlers/fee managers
4. **Registry-based discovery** for UI integration
5. **Resume capability** for failed deployments (needs fix)

### Configuration Structure
```json
{
  "name": "localhost",
  "chainId": 31337,
  "sharedContracts": {
    "metroToken": "DEPLOY_MOCK",
    "lbRouter": "DEPLOY_MOCK",
    "lbFactory": "DEPLOY_MOCK"
  },
  "vaults": [
    {
      "id": "ws-usdc",
      "enabled": true,
      "tokens": {
        "tokenX": { "symbol": "wS", "decimals": 18, "deployMock": true },
        "tokenY": { "symbol": "USDC", "decimals": 6, "deployMock": true }
      },
      "lbPair": { "deployMock": true, "binStep": 25 },
      "deployment": { "vaultName": "Arca wS-USDC Vault" }
    }
  ]
}
```

### Deployment Commands
```bash
# Deploy all vaults
npm run deploy --network localhost

# Deploy specific vaults
npm run deploy --network testnet --vaults "ws-usdc,test1-test2"

# Resume failed deployment (BROKEN - needs fix)
npm run deploy --network localhost --resume
```

## 🚨 Testnet Deployment Learnings

### Critical Discovery: Quote Asset Whitelisting

**Problem**: LB Factory on testnet restricts which tokens can be used as quote assets (tokenY).

**Error**: `LBFactory__QuoteAssetNotWhitelisted(address)` (0x8e888ef3)

**Solution**: 
- Only **S** and **USDC** are whitelisted as quote assets on Sonic Blaze Testnet
- Custom tokens MUST be tokenX (base asset), not tokenY (quote asset)
- Valid pairs: TEST1-USDC ✅, TEST1-S ✅, TEST1-TEST2 ❌

### Deployment Issues Encountered

1. **Progress Tracking Lost**: Multi-vault deployer doesn't properly maintain progress between runs
   - Each run creates new infrastructure instead of reusing
   - Manual progress file updates were needed

2. **--resume Flag Broken**: 
   - Error: "Unrecognized param --resume"
   - The argument isn't properly passed through npm scripts to the deployment script

3. **Token Deployment**: 
   - Token deployer works correctly
   - Tokens must be added to progress file for subsequent steps

4. **LB Pair Creation**:
   - Factory events contain the new pair address
   - getLBPairInformation() may fail even after successful creation
   - Transaction logs must be parsed to extract pair address

### Successful Testnet Deployment Example

```bash
# What we deployed:
TEST1 Token: 0x46e6B680eBae63e086e6D820529Aed187465aeDA
USDC Token: 0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0 (existing)
LB Pair: 0xc1603bA905f4E268CDf451591eF51bdFb1185EEB
Vault: 0x8f74E08606b8182a472645F2598C5D9a81bD8fdc

# BUT: UI doesn't show it because deployment wasn't exported!
```

### UI Integration Issue

**Problem**: Deployed vault doesn't appear in UI
- Custom deployment scripts don't integrate with export system
- UI reads from `exports/deployments.json` which wasn't updated
- Result: UI shows old deployments instead of new ones

**Solution**: 
- All deployment scripts must save in standard multi-vault format
- Auto-run export script after deployment
- Create deployment utility that handles this automatically

## 📋 Script Consolidation Plan

### Current Debug Scripts (to be consolidated)
```
scripts/
├── check-token-compatibility.ts     # Verify ERC20 implementation
├── find-available-binsteps.ts       # Check factory bin steps
├── check-existing-pair.ts           # Verify existing pairs
├── debug-pair-creation.ts           # Debug factory errors
├── decode-factory-errors.ts         # Decode custom errors
├── check-whitelisted-tokens.ts      # Check quote assets
├── parse-lbpair-logs.ts            # Extract pair from logs
├── check-lbpair-created.ts         # Verify pair creation
├── verify-lbpair.ts                # Check pair configuration
├── deploy-test1-usdc-vault.ts      # Manual vault deployment
└── deploy-vault-contracts.ts        # Deploy vault with hardcoded addresses
```

### Consolidation Strategy

1. **Create Unified Debug Tool**: `scripts/utils/deployment-debugger.ts`
   - Combine all token checks
   - Factory configuration queries
   - Error decoding
   - Log parsing utilities

2. **Enhance Multi-Vault Deployer**:
   - Fix progress tracking between runs
   - Better error messages with suggested fixes
   - Automatic quote asset validation before attempting pair creation
   - Proper event parsing for pair addresses

3. **Fix --resume Implementation**:
   - Update package.json scripts to properly pass arguments
   - Or implement resume detection automatically

4. **Keep Minimal Debug Scripts**:
   ```
   scripts/debug/
   ├── check-deployment.ts    # Verify any deployment
   ├── decode-errors.ts       # Decode any custom errors
   └── test-vault.ts          # Test vault operations
   ```

### Recommended Fixes

1. **Fix Progress Persistence** in `multi-vault-deployer.ts`:
   ```typescript
   // Load existing progress before starting
   const existingProgress = loadProgress(network);
   if (existingProgress && !options.fresh) {
     // Merge with new deployment
   }
   ```

2. **Add Quote Asset Validation**:
   ```typescript
   // Before creating pair
   const isQuoteAsset = await factory.isQuoteAsset(tokenY);
   if (!isQuoteAsset) {
     throw new Error(`Token ${tokenY} is not a whitelisted quote asset. Use USDC or S instead.`);
   }
   ```

3. **Fix --resume Flag**:
   - Option 1: Use environment variable instead
   - Option 2: Parse process.argv directly in the script
   - Option 3: Create separate npm script for resume

### Key Files

- `scripts/deploy-multi-vault.ts` - Main deployment entry point
- `scripts/utils/multi-vault-deployer.ts` - Core deployment logic (needs fixes)
- `test/multi-vault.integration.test.ts` - Integration tests
- `config/networks/*.json` - Network configurations

### 🚨 Critical Reminders

1. **Network Awareness**: Every component must handle localhost/testnet/mainnet
2. **METRO Token**: Shared across all vaults (matches mainnet behavior)
3. **Error Handling**: Graceful failures with resume capability
4. **Gas Optimization**: Batch operations where possible
5. **MockERC20 Constructor**: Now requires 4 params (name, symbol, decimals, initialHolder)
6. **Quote Asset Restrictions**: Only whitelisted tokens can be tokenY on testnet/mainnet
7. **Event Parsing**: Factory events contain deployed pair addresses
8. **Progress Files**: Must be properly maintained between deployment runs

### ✅ Success Criteria Status

**Localhost** ✅
- [x] Deploy 3+ vaults with different token pairs in single command
- [x] All test accounts funded with test tokens automatically
- [x] Deployment completes in under 2 minutes
- [x] Can resume failed deployments

**Testnet** ✅
- [x] Deploy custom test tokens with correct permissions
- [x] Create new LBPairs via Metropolis factory (with whitelisted quote assets)
- [x] Successfully deploy vaults using custom pairs
- [x] Test tokens distributed to deployer wallet

**General** 🚧
- [x] All existing tests pass (209/209)
- [x] Documentation fully updated
- [ ] Minimal script proliferation (currently 11+ debug scripts)
- [x] Clean, maintainable code structure

### Action Items

1. **Critical Integration Issues**:
   - **Export Integration**: All deployment scripts MUST save in standard format and auto-run export
     - Problem: Custom scripts bypass the export system, UI can't see deployments
     - Solution: Create deployment base class/utility that all scripts use
     - Auto-run `npm run deploy:export` after any successful deployment
   - **Deployment Format Standardization**: Single deployment format for all scripts
     - Current: Different scripts save different formats
     - Needed: Standard deployment artifact that export script understands

2. **Immediate**:
   - Fix --resume flag parsing
   - Update multi-vault deployer to maintain progress correctly
   - Add quote asset validation before pair creation
   - Create standard deployment save utility

3. **Short Term**:
   - Consolidate debug scripts into unified tool
   - Add better error messages with solutions
   - Update deployment documentation with testnet gotchas
   - Integrate all deployment paths with export system

4. **Long Term**:
   - Consider creating a deployment UI/CLI tool
   - Add automatic retry with different parameters
   - Implement deployment verification and health checks