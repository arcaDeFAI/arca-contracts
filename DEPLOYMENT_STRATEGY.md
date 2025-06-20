# Arca Vault System - Deployment Strategy

## Overview

This document outlines the comprehensive deployment strategy for the Arca Vault system, aligned with Hardhat and OpenZeppelin best practices. The strategy supports UUPS upgrades, follows industry standards, and provides multiple deployment paths for different use cases.

## Key Principles

1. **Hardhat Ignition First**: Use Hardhat Ignition modules for declarative deployment
2. **TypeScript Only**: All deployment scripts and modules use TypeScript
3. **UUPS Upgrade Support**: Maintain upgradeability through OpenZeppelin patterns
4. **Contract Size Awareness**: Avoid factory patterns that exceed 24.5KB limit
5. **Atomic Deployment**: Ensure complete system deployment or rollback

## Deployment Architecture

### Three-Tier Deployment Strategy

#### Tier 1: Simple Deployment (Hardhat Ignition)
- **Purpose**: Quick testing, development, simple deployments
- **Method**: Hardhat Ignition modules
- **Use Cases**: Local development, basic contract testing
- **Files**: `ignition/modules/*.ts`

#### Tier 2: UUPS Proxy Deployment (Scripts)
- **Purpose**: Production deployments with upgradeability
- **Method**: TypeScript scripts with OpenZeppelin upgrades plugin
- **Use Cases**: Testnet, mainnet, complex proxy deployments
- **Files**: `scripts/deployArcaSystem.ts`

#### Tier 3: Advanced Ignition (Planned)
- **Purpose**: Production-grade declarative deployment with UUPS support
- **Method**: Advanced Hardhat Ignition modules with proxy support
- **Use Cases**: Future production deployments when Ignition proxy support matures
- **Files**: `ignition/modules/ArcaProxySystem.ts` (to be created)

## Current Implementation

### Tier 1: Basic Ignition Module
```typescript
// ignition/modules/ArcaVault.ts
const arcaVaultModule = buildModule("ArcaVaultModule", (m) => {
  const arcaVaultContract = m.contract("ArcaTestnetV1");
  return { arcaVaultContract };
});
```

**Usage**: `npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts`

**Limitations**:
- No proxy support
- No complex initialization
- Not suitable for production

### Tier 2: UUPS Script Deployment
```typescript
// scripts/deployArcaSystem.ts
export async function deployArcaSystem(config: DeploymentConfig): Promise<DeploymentAddresses>
```

**Features**:
- UUPS proxy deployment
- Beacon proxy deployment
- Proper ownership transfers
- Registry integration
- Type safety with interfaces

**Usage**: `npx hardhat run scripts/deployArcaSystem.ts --network <network>`

## Deployment Flow

### Standard UUPS Deployment Process

**Important**: Beacon deployment uses existing contract files as implementation contracts:
- `hre.upgrades.deployBeacon("ArcaQueueHandlerV1")` creates a beacon pointing to `ArcaQueueHandlerV1.sol`
- `hre.upgrades.deployBeacon("ArcaFeeManagerV1")` creates a beacon pointing to `ArcaFeeManagerV1.sol`
- No separate beacon contract files are needed - OpenZeppelin handles beacon creation automatically

1. **Deploy Beacons** (Supporting Contracts)
   - QueueHandler beacon (creates beacon for `ArcaQueueHandlerV1.sol`)
   - FeeManager beacon (creates beacon for `ArcaFeeManagerV1.sol`)

2. **Deploy Beacon Proxies** (Supporting Contracts)
   - QueueHandler proxy (proxies to `ArcaQueueHandlerV1.sol`, initialized)
   - FeeManager proxy (proxies to `ArcaFeeManagerV1.sol`, initialized with fee recipient)

3. **Deploy UUPS Proxies** (Core Contracts)
   - RewardClaimer UUPS proxy (proxies to `ArcaRewardClaimerV1.sol`, initialized with all parameters)
   - Main Vault UUPS proxy (proxies to `ArcaTestnetV1.sol`, initialized with all components)

4. **Configure Ownership**
   - Transfer QueueHandler ownership to Vault
   - Transfer FeeManager ownership to Vault
   - Transfer RewardClaimer ownership to Vault

5. **Register System**
   - Deploy VaultRegistry (if needed)
   - Register vault in registry

### Upgrade Process (UUPS)

1. **Prepare New Implementation**
   - Deploy new implementation contract
   - Verify upgrade compatibility

2. **Execute Upgrade**
   ```typescript
   await hre.upgrades.upgradeProxy(proxyAddress, NewImplementation);
   ```

3. **Verify Upgrade**
   - Check implementation address
   - Verify functionality
   - Test critical operations

## Configuration Management

### Environment-Based Parameters
```typescript
interface DeploymentConfig {
  tokenX: string;
  tokenY: string;
  binStep: number;
  amountXMin: bigint;
  amountYMin: bigint;
  name: string;
  symbol: string;
  lbRouter: string;
  lbpAMM: string;
  lbpContract: string;
  rewarder: string;
  rewardToken: string;
  nativeToken: string;
  lbpContractUSD: string;
  idSlippage: bigint;
  feeRecipient: string;
}
```

### Network-Specific Configs
- Local: Mock addresses for testing
- Testnet: Real testnet addresses
- Mainnet: Production addresses

## Security Considerations

1. **Proxy Admin Management**
   - Use multisig for proxy admin on mainnet
   - Implement timelock for upgrades
   - Document upgrade procedures

2. **Deployment Verification**
   - Verify all contract addresses after deployment
   - Check ownership transfers completed
   - Test core functionality post-deployment

3. **Rollback Strategy**
   - Maintain deployment state tracking
   - Document rollback procedures
   - Keep previous implementation addresses

## Future Enhancements

### Hardhat Ignition Integration
Once Hardhat Ignition supports OpenZeppelin proxy patterns:

```typescript
// Future: ignition/modules/ArcaProxySystem.ts
const arcaProxyModule = buildModule("ArcaProxyModule", (m) => {
  const queueBeacon = m.deployBeacon("ArcaQueueHandlerV1");
  const feeBeacon = m.deployBeacon("ArcaFeeManagerV1");
  
  const queueProxy = m.deployBeaconProxy(queueBeacon, "ArcaQueueHandlerV1", []);
  const feeProxy = m.deployBeaconProxy(feeBeacon, "ArcaFeeManagerV1", [feeRecipient]);
  
  const rewardProxy = m.deployProxy("ArcaRewardClaimerV1", [...params], { kind: 'uups' });
  const vaultProxy = m.deployProxy("ArcaTestnetV1", [...params], { kind: 'uups' });
  
  return { vaultProxy, rewardProxy, queueProxy, feeProxy };
});
```

### CI/CD Integration
- Automated deployment verification
- Gas cost tracking
- Contract size monitoring
- Upgrade compatibility checks

## Commands Reference

### Development
```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Check contract sizes
npx hardhat size-contracts
```

### Deployment
```bash
# Simple deployment (development)
npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts --network localhost

# UUPS deployment (production)
npx hardhat run scripts/deployArcaSystem.ts --network <network>
```

### Verification
```bash
# Verify contracts on Etherscan
npx hardhat verify --network <network> <contract-address> <constructor-args>

# Check proxy implementation
npx hardhat run scripts/checkImplementation.ts --network <network>
```

This strategy ensures scalable, secure, and maintainable deployment processes while following Hardhat and OpenZeppelin best practices.