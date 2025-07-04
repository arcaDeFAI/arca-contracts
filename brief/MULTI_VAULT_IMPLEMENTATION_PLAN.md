## Multi-Vault Implementation Status

> **Last Updated**: January 7, 2025
>
> **Status**: Core implementation COMPLETE ✅ | Documentation/UI pending
> 
> **Completed**:
> - Multi-vault deployment system with progress tracking
> - Shared token/beacon infrastructure  
> - Full test coverage (14/14 multi-vault tests, 209 total tests passing)
> - All contract interface issues resolved
>
> **Remaining**: Update docs and UI integration

### Key Features

1. **Multi-vault deployment** from single config file
2. **Token reuse** across vaults (e.g., USDC shared between multiple pairs)
3. **Beacon proxy pattern** for batch upgrades of queue handlers/fee managers
4. **Registry-based discovery** for UI integration
5. **Resume capability** for failed deployments

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

# Resume failed deployment
npm run deploy --network localhost --resume
```

### Next Steps

1. **Documentation**: Update DEPLOYMENT.md with multi-vault instructions
2. **UI Integration**: Update export scripts to include all vault addresses
3. **Additional Tests**: See TODOs in `test/multi-vault.integration.test.ts`

### Key Files

- `scripts/deploy-multi-vault.ts` - Main deployment entry point
- `scripts/utils/multi-vault-deployer.ts` - Core deployment logic
- `test/multi-vault.integration.test.ts` - Integration tests
- `config/networks/*.json` - Network configurations

### 🚨 Critical Reminders

1. **Network Awareness**: Every component must handle localhost/testnet/mainnet
2. **METRO Token**: Shared across all vaults (matches mainnet behavior)
3. **Error Handling**: Graceful failures with resume capability
4. **Gas Optimization**: Batch operations where possible
5. **MockERC20 Constructor**: Now requires 4 params (name, symbol, decimals, initialHolder)

### ✅ Success Criteria Status

**Localhost** ✅
- [x] Deploy 3+ vaults with different token pairs in single command
- [x] All test accounts funded with test tokens automatically
- [x] Deployment completes in under 2 minutes
- [x] Can resume failed deployments

**Testnet** 🚧
- [ ] Deploy custom test tokens with correct permissions
- [ ] Create new LBPairs via Metropolis factory
- [ ] Successfully deploy vaults using custom pairs
- [ ] Test tokens distributed to QA wallets

**General** ✅
- [x] All existing tests pass (209/209)
- [ ] Documentation fully updated
- [x] Minimal script proliferation (4 new scripts)
- [x] Clean, maintainable code structure