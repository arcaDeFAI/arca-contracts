# 🧪 TDD Plan: UI Multi-Vault & Multi-Network Support

## 📋 Executive Summary

This document outlines the Test-Driven Development (TDD) approach to fix critical UI issues that prevent multi-vault and testnet support. Following the project's proven TDD methodology, we will write tests first that define the new business requirements, then implement code to satisfy those tests.

## 🎯 Business Requirements

1. **Multi-Network Support**: UI must work on localhost, testnet, and mainnet (not hardcoded to localhost)
2. **Multi-Vault Discovery**: Support unlimited vaults per network via registry
3. **Dynamic Token Pairs**: Any token pair can have a vault (not hardcoded wS/USDC.e)
4. **Efficient User Portfolio**: Dashboard shows only vaults where user has positions
5. **Vault Explorer**: Browse page shows all available vaults on network

## 🚨 Current Critical Issues

### Registry Hook (`use-vault-registry.ts`)
- ❌ Hardcoded to localhost chain (lines 38-43)
- ❌ Only processes first vault (lines 67-96)
- ❌ No network switching support

### Deployment Loader (`deployment-loader.ts`)
- ❌ Missing testnet implementation
- ❌ Assumes single vault per network
- ❌ No registry integration

### UI Components
- ❌ Built for single vault only
- ❌ No vault selection/filtering
- ❌ Dashboard shows all vaults instead of user's vaults

## 📝 TDD Implementation Plan

### Phase 1: Registry Hook Multi-Network & Multi-Vault Support

#### 1.1 Write Tests First (2 hours)
**Create**: `/UI/src/hooks/__tests__/use-vault-registry.test.ts`

**Test Requirements**:
```typescript
describe('useVaultRegistry', () => {
  // Requirement: Multi-network support
  it('should work with localhost (31337)', async () => {
    // Mock chainId 31337, expect localhost RPC
  });
  
  it('should work with testnet (57054)', async () => {
    // Mock chainId 57054, expect testnet RPC
  });
  
  it('should work with mainnet (146)', async () => {
    // Mock chainId 146, expect mainnet RPC
  });
  
  // Requirement: Multi-vault support
  it('should return ALL active vaults from registry', async () => {
    // Mock registry.getActiveVaults() returns 3 addresses
    // Expect hook to fetch info for all 3 vaults
    // Verify all 3 vaults in returned array
  });
  
  it('should handle empty vault list gracefully', async () => {
    // Mock registry returns empty array
    // Expect empty vaults array, no errors
  });
  
  // Requirement: Network switching
  it('should update when network changes', async () => {
    // Start on localhost, switch to testnet
    // Expect new registry address
    // Expect vault re-discovery
  });
  
  // Requirement: Error handling
  it('should provide clear error for unsupported network', async () => {
    // Mock chainId 999
    // Expect error: "Unsupported chain ID: 999"
  });
  
  it('should handle registry contract errors', async () => {
    // Mock contract call failure
    // Expect user-friendly error message
  });
});
```

#### 1.2 Fix Implementation (2-3 hours)
**Update**: `/UI/src/hooks/use-vault-registry.ts`

**Key Changes**:
- Replace hardcoded localhost with dynamic chain detection
- Use `SUPPORTED_CHAINS[chainId]` for network config
- Implement proper multi-vault fetching with Promise.all
- Add comprehensive error handling

### Phase 2: Deployment Loader Testnet & Registry Pattern

#### 2.1 Write Tests First (1-2 hours)
**Create**: `/UI/src/lib/__tests__/deployment-loader.test.ts`

**Test Requirements**:
```typescript
describe('deployment-loader', () => {
  // Requirement: Testnet support
  it('should return testnet deployment (57054)', () => {
    const deployment = getDeploymentAddresses(57054);
    expect(deployment).toBeDefined();
    expect(deployment.registry).toBe('0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f');
    expect(deployment.metropolis.lbRouter).toBeDefined();
  });
  
  // Requirement: Registry-based architecture
  it('should return infrastructure only, no vault addresses', () => {
    const deployment = getDeploymentAddresses(31337);
    expect(deployment.registry).toBeDefined();
    expect(deployment.metropolis).toBeDefined();
    expect(deployment.vault).toBeUndefined(); // No vault-specific addresses
  });
  
  // Requirement: Network infrastructure
  describe('getNetworkInfrastructure', () => {
    it('should return core contracts for any network', () => {
      const infra = getNetworkInfrastructure(57054);
      expect(infra).toMatchObject({
        registry: expect.any(String),
        lbRouter: expect.any(String),
        lbFactory: expect.any(String),
      });
    });
  });
});
```

#### 2.2 Implement Changes (2-3 hours)
**Update**: `/UI/src/lib/deployment-loader.ts`

**Key Changes**:
- Implement `getTestnetAddresses()` using exports data
- Refactor to infrastructure-only pattern
- Add `getNetworkInfrastructure()` function
- Remove vault-specific addresses

### Phase 3: Multi-Vault Support in use-real-vaults

#### 3.1 Write Tests First (1-2 hours)
**Create**: `/UI/src/hooks/__tests__/use-real-vaults.test.ts`

**Test Requirements**:
```typescript
describe('useRealVaults', () => {
  // Requirement: Multiple vault support
  it('should return all vaults from registry', async () => {
    // Mock useVaultRegistry returns 3 vaults
    const { result } = renderHook(() => useRealVaults());
    expect(result.current.vaults).toHaveLength(3);
  });
  
  // Requirement: Token-agnostic vaults
  it('should support any token pair combination', async () => {
    // Mock vaults with different pairs
    const { result } = renderHook(() => useRealVaults());
    expect(result.current.vaults[0].tokens).toEqual(['wS', 'USDC.e']);
    expect(result.current.vaults[1].tokens).toEqual(['METRO', 'USDC.e']);
    expect(result.current.vaults[2].tokens).toEqual(['wS', 'METRO']);
  });
  
  // Requirement: Progressive enhancement
  it('should show vault data immediately, metrics async', async () => {
    const { result } = renderHook(() => useRealVaults());
    // Immediate data
    expect(result.current.vaults[0].vaultBalanceX).toBeDefined();
    expect(result.current.vaults[0].userSharesX).toBeDefined();
    // Async metrics may be undefined initially
    expect(result.current.vaults[0].apr).toBeUndefined();
    
    // Wait for metrics
    await waitFor(() => {
      expect(result.current.vaults[0].apr).toBeDefined();
    });
  });
});
```

#### 3.2 Update Implementation (2 hours)
**Update**: `/UI/src/hooks/use-real-vaults.ts`

**Key Changes**:
- Map over all registry vaults (not just first)
- Create RealVault for each registry entry
- Handle parallel metric loading
- Support any token pair

### Phase 4: Integration Testing

#### 4.1 Write Integration Tests (2 hours)
**Create**: `/UI/src/__tests__/multi-vault-integration.test.tsx`

**Test Requirements**:
```typescript
describe('Multi-Vault E2E Integration', () => {
  it('complete flow: connect → discover → interact with multiple vaults', async () => {
    // 1. Connect wallet to testnet
    // 2. Verify registry discovery
    // 3. See multiple vaults
    // 4. Deposit to vault 2
    // 5. Verify UI updates
  });
  
  it('should handle network switching with multiple vaults', async () => {
    // 1. Start on localhost (2 vaults)
    // 2. Switch to testnet (3 vaults)
    // 3. Verify vault list updates
    // 4. Verify no stale data
  });
});
```

### Phase 5: Dashboard vs Explorer Views

#### 5.1 Write Tests for User Vault Filtering (1-2 hours)
**Create**: `/UI/src/hooks/__tests__/use-user-vaults.test.ts`

**Test Requirements**:
```typescript
describe('useUserVaults - Dashboard filtering', () => {
  // Requirement: Efficient user vault discovery
  it('should return only vaults where user has shares', async () => {
    // Mock: 10 total vaults, user has shares in 2
    const { result } = renderHook(() => useUserVaults());
    expect(result.current.vaults).toHaveLength(2);
    expect(result.current.totalVaults).toBe(10);
  });
  
  // Requirement: Smart contract efficiency
  it('should use efficient contract queries', async () => {
    // Verify it doesn't fetch all vault data then filter
    // Should use registry's getVaultsByUser or similar
  });
  
  // Requirement: Real-time updates
  it('should update when user deposits to new vault', async () => {
    const { result } = renderHook(() => useUserVaults());
    expect(result.current.vaults).toHaveLength(2);
    
    // User deposits to vault 3
    act(() => depositToVault(vaultAddresses[2]));
    
    await waitFor(() => {
      expect(result.current.vaults).toHaveLength(3);
    });
  });
});
```

#### 5.2 Consider Registry Contract Enhancement
**Evaluate**: Adding efficient user vault discovery to registry

```solidity
// Potential registry addition
function getVaultsByUser(address user) external view returns (address[] memory) {
    // Loop through vaults, check if user has shares
    // More efficient than client-side filtering
}
```

## 🏗️ Implementation Strategy

### TDD Workflow for Each Phase
1. **Write failing tests** that define requirements
2. **Run tests** - verify they fail for the right reasons
3. **Implement minimum code** to make tests pass
4. **Run all tests** - ensure no regression
5. **Refactor** if needed while keeping tests green
6. **Document** any new patterns or decisions

### Critical TDD Principles
- **Tests Define Business Logic**: Not implementation details
- **Fix Code, Not Tests**: When tests fail, fix the code
- **Test User Requirements**: Focus on what users need
- **Progressive Enhancement**: Core features first, optimize later

## 📊 Success Metrics

### Phase 1 Complete When:
- ✅ Registry hook works on all networks
- ✅ All vaults discovered and returned
- ✅ Network switching handled gracefully

### Phase 2 Complete When:
- ✅ Testnet deployment supported
- ✅ Registry-based architecture implemented
- ✅ No hardcoded vault addresses

### Phase 3 Complete When:
- ✅ Multiple vaults displayed in UI
- ✅ Any token pair supported
- ✅ Metrics load progressively

### Phase 4 Complete When:
- ✅ Full integration tests passing
- ✅ Testnet deployment verified
- ✅ Multi-vault workflows smooth

### Phase 5 Complete When:
- ✅ Dashboard shows only user's vaults
- ✅ Explorer shows all vaults
- ✅ Efficient contract queries

## 🚀 Execution Timeline

- **Phase 1**: 4-5 hours (Critical - blocks everything)
- **Phase 2**: 3-4 hours (High - enables testnet)
- **Phase 3**: 3-4 hours (High - enables multi-vault)
- **Phase 4**: 2 hours (Medium - validation)
- **Phase 5**: 3-4 hours (Medium - UX enhancement)

**Total**: 15-21 hours

## 🔄 Rollback Plan

If issues arise:
1. Tests will catch breaking changes immediately
2. Git history allows quick reversion
3. Feature flags can disable multi-vault if needed
4. Single vault fallback mode available

## 📈 Future Enhancements

After core implementation:
1. Vault search and filtering
2. APR sorting and comparison
3. Portfolio analytics dashboard
4. Vault recommendation engine
5. Mobile-responsive vault cards

---

**Remember**: In TDD, tests are the specification. Write tests that define what the business needs, then implement code to satisfy those tests. This approach has already prevented critical bugs in this project and will ensure our multi-vault implementation is robust and correct.