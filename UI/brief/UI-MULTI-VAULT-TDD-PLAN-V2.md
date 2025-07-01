# 🧪 TDD Plan V2: Complete Multi-Vault & Token-Agnostic Architecture

## 📋 Executive Summary

This updated plan addresses the critical architectural flaw discovered during Phase 3 implementation: the deployment-loader incorrectly mixes network infrastructure tokens (METRO, wS) with vault-specific tokens, breaking the multi-vault, token-agnostic design.

## 🚨 Critical Architecture Issue & Solution

### The Problem

1. `deployment-loader.ts` returns `tokens: { wS, usdce, metro }` - mixing infrastructure with vault-specific tokens
2. `vault-configs.ts` uses these hardcoded references, assuming all vaults use wS/USDC.e
3. This breaks multi-vault support for arbitrary token pairs

### The Analysis Result

After analyzing the smart contracts:

- **METRO is the network-wide reward token** - needed by all vaults for reward compounding
- **wS is the wrapped native token** (wrapped Sonic) - network infrastructure, not vault-specific
- These tokens are NOT mistakes, but their organization is wrong

### The Solution

1. **Separate network infrastructure from vault tokens**:
   ```typescript
   {
     registry: "0x...",
     networkTokens: {
       rewardToken: "0x...",    // METRO - for all vaults' rewards
       wrappedNative: "0x..."   // wS - wrapped Sonic token
     },
     metropolis: { ... }        // Network infrastructure
   }
   ```
2. **Registry provides vault-specific tokens** (tokenX, tokenY for each vault)
3. **Clear separation** between infrastructure and vault configuration

## 📝 Updated TDD Implementation Plan

### Phase 1: Registry Hook Multi-Network & Multi-Vault Support ✅

**Status**: COMPLETED

### Phase 2: Deployment Loader Infrastructure-Only Pattern ✅

**Status**: COMPLETED (but needs refactoring per new understanding)

### Phase 3A: Fix Token Architecture - Infrastructure vs Vault Tokens (UPDATED)

#### 3A.1 Write Tests for Infrastructure-Only Deployment Loader (2 hours)

**Create**: `/UI/src/lib/__tests__/deployment-loader-v2.test.ts`

**Test Requirements**:

```typescript
describe("deployment-loader - Infrastructure vs Vault Tokens", () => {
  it("should provide network infrastructure tokens separately", () => {
    const deployment = getDeploymentAddresses(31337);

    // Should have network-wide tokens
    expect(deployment.networkTokens).toBeDefined();
    expect(deployment.networkTokens.rewardToken).toBeDefined(); // METRO
    expect(deployment.networkTokens.wrappedNative).toBeDefined(); // wS

    // Should NOT have vault-specific tokens
    expect(deployment.tokens).toBeUndefined();
    expect(deployment.tokens?.wS).toBeUndefined(); // wS is infrastructure, not vault token
    expect(deployment.tokens?.usdce).toBeUndefined(); // Vault-specific
  });

  it("should not mix infrastructure with vault configuration", () => {
    const deployment = getDeploymentAddresses(57054);

    // Infrastructure only
    expect(deployment).toMatchObject({
      registry: expect.any(String),
      networkTokens: {
        rewardToken: expect.any(String), // METRO address
        wrappedNative: expect.any(String), // wS address
      },
      metropolis: {
        lbRouter: expect.any(String),
        lbFactory: expect.any(String),
        // NO pool address - that's vault-specific
      },
    });

    // No vault-specific data
    expect(deployment.vault).toBeUndefined();
    expect(deployment.metropolis.pool).toBeUndefined();
  });

  it("should support vaults with any token pair", () => {
    // Test that infrastructure doesn't assume specific vault tokens
    const deployment = getDeploymentAddresses(31337);
    const jsonStr = JSON.stringify(deployment);

    // Should not contain vault-specific token references
    expect(jsonStr).not.toContain('"tokenX"');
    expect(jsonStr).not.toContain('"tokenY"');
    expect(jsonStr).not.toContain('"usdce"'); // Specific token, not infrastructure
  });
});
```

#### 3A.2 Refactor Deployment Loader (2 hours)

**Update**: `/UI/src/lib/deployment-loader.ts`

**Key Changes**:

```typescript
interface DeploymentAddresses {
  registry: string;
  networkTokens: {
    rewardToken: string; // METRO - for reward claiming
    wrappedNative: string; // wS - wrapped Sonic
  };
  metropolis: {
    lbRouter: string;
    lbFactory: string;
    // NO pool - that's vault-specific
  };
  // REMOVED: vault, feeManager, queueHandler, rewardClaimer (vault-specific)
  // REMOVED: tokens with hardcoded names
}
```

#### 3A.3 Write Tests for Registry-Based Vault Config (2 hours)

**Update**: `/UI/src/lib/__tests__/vault-configs.test.ts`

**Test Requirements**:

```typescript
describe("vault-configs - True Token-Agnostic Support", () => {
  it("should create config from registry data without assumptions", () => {
    // Mock registry vault info
    const vaultInfo = {
      vault: "0xVault1",
      tokenX: "0xMETRO", // METRO as tokenX
      tokenY: "0xUSDCe", // USDC.e as tokenY
      name: "Arca METRO-USDC.e Vault",
    };

    const config = createVaultConfigFromRegistry(vaultInfo, 31337);

    // Should use exact tokens from registry
    expect(config.tokenX.address).toBe("0xMETRO");
    expect(config.tokenY.address).toBe("0xUSDCe");

    // Should NOT assume wS/USDC.e
    expect(config.tokenX.symbol).not.toBe("wS");
  });

  it("should support wS as tokenY (not always tokenX)", () => {
    const vaultInfo = {
      tokenX: "0xMETRO",
      tokenY: "0xwS", // wS can be tokenY too!
      name: "Arca METRO-wS Vault",
    };

    const config = createVaultConfigFromRegistry(vaultInfo, 31337);
    expect(config.tokenY.address).toBe("0xwS");
  });
});
```

#### 3A.4 Refactor Vault Configs (2 hours)

**Update**: `/UI/src/lib/vault-configs.ts`

**Key Changes**:

- Remove `getVaultConfigsForChain` that hardcodes wS/USDC.e
- Create `createVaultConfigFromRegistry` that uses registry data
- Support any token combination

### Phase 3B: Complete Multi-Vault Support in use-real-vaults ⏳

**Status**: Tests written, needs completion with new architecture

### Phase 4: Ensure Backend-Frontend Coherence (NEW - 2 hours)

#### 4.1 Write Integration Tests for Contract-UI Alignment

```typescript
describe("Backend-Frontend Coherence", () => {
  it("should use same token addresses between contracts and UI", async () => {
    // Deploy contracts
    const { registry, networkTokens } = await deployTestSystem();

    // Create vault with METRO/USDC.e
    await registry.registerVault({
      tokenX: networkTokens.rewardToken, // METRO
      tokenY: "0xUSDCe",
    });

    // UI should discover and display correctly
    const { result } = renderHook(() => useRealVaults());
    expect(result.current.vaults[0].tokens).toEqual(["METRO", "USDC.e"]);
  });
});
```

### Phase 5: Fix All Linting Errors (1-2 hours)

### Phase 6: Dashboard vs Explorer Views (3-4 hours)

## 🏗️ Implementation Strategy

### Critical Path

1. **Phase 3A**: Fix infrastructure vs vault token architecture
2. **Phase 3B**: Complete multi-vault implementation
3. **Phase 4**: Ensure backend-frontend coherence
4. **Phase 5**: Code quality

## 📊 Success Metrics

### Architecture Coherence When:

- ✅ Smart contracts and UI use same token organization
- ✅ Network tokens (METRO, wS) clearly separated from vault tokens
- ✅ Any token pair works without hardcoding
- ✅ Registry is single source of truth for vault configuration

## 🚀 Next Immediate Steps

1. **Start Phase 3A.1**: Write tests for infrastructure-only deployment loader
2. **Then Phase 3A.2**: Refactor deployment loader with clear token separation
3. **Then Phase 3A.3**: Write tests for registry-based vault configs
4. **Then Phase 3A.4**: Refactor vault configs
5. **Complete Phase 3B**: Finish multi-vault implementation
6. **Phase 4**: Verify backend-frontend coherence

---

**Key Insight**: METRO and wS are network infrastructure tokens needed by ALL vaults. The fix is organizing them correctly, not removing them.
