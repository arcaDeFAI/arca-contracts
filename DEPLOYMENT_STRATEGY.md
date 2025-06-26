# Arca Vault System - Deployment Strategy

## Overview

This document outlines the comprehensive deployment strategy for the Arca Vault system, aligned with Hardhat and OpenZeppelin best practices. The strategy supports UUPS upgrades, follows industry standards, and uses TypeScript-based deployment scripts exclusively.

## Key Principles

1. **Script-Based Deployment**: Use TypeScript scripts with OpenZeppelin upgrades plugin for all deployments
2. **TypeScript Only**: All deployment scripts use TypeScript for type safety
3. **UUPS Upgrade Support**: Maintain upgradeability through OpenZeppelin patterns
4. **Contract Size Awareness**: Avoid factory patterns that exceed 24.5KB limit
5. **Atomic Deployment**: Ensure complete system deployment or rollback

## Deployment Architecture

### Production-Grade Script Deployment

- **Purpose**: All deployments (local, testnet, mainnet) with full UUPS + Beacon proxy support
- **Method**: TypeScript scripts with OpenZeppelin upgrades plugin
- **Use Cases**: Local development, testnet deployment, mainnet deployment
- **Files**: `scripts/deployArcaSystem.ts`, `scripts/deploy-local.ts`, `scripts/deploy-testnet.ts`
- **Benefits**: Full OpenZeppelin integration, complex deployment logic, ownership transfers, upgrade support

## Current Implementation

### Production Script Deployment
```typescript
// scripts/deployArcaSystem.ts
export async function deployArcaSystem(config: DeploymentConfig): Promise<DeploymentAddresses>
```

**Features**:
- UUPS proxy deployment for core contracts
- Beacon proxy deployment for supporting contracts
- Proper ownership transfers
- Registry integration
- Type safety with interfaces
- Mock contract deployment for local testing
- Network-specific configuration loading
- Deployment artifact saving

**Usage**: 
```bash
# Local deployment with mocks
npm run deploy:local

# Testnet deployment
npm run deploy:testnet

# Direct script execution
npx hardhat run scripts/deployArcaSystem.ts --network <network>
```

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

## Future Considerations

### CI/CD Integration
- Automated deployment verification
- Gas cost tracking
- Contract size monitoring
- Upgrade compatibility checks

### Advanced Features
- Multi-signature deployment support
- Timelock integration for upgrades
- Automated contract verification on block explorers
- Gas optimization analysis

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
# Local deployment with mocks
npm run deploy:local

# Testnet deployment
npm run deploy:testnet

# Direct deployment script
npx hardhat run scripts/deployArcaSystem.ts --network <network>

# Verify deployment
npm run deploy:verify:local
npm run deploy:verify:testnet
npm run deploy:verify:mainnet
```

### Verification
```bash
# Verify contracts on Etherscan
npx hardhat verify --network <network> <contract-address> <constructor-args>

# Check proxy implementation
npx hardhat run scripts/checkImplementation.ts --network <network>
```

This strategy ensures scalable, secure, and maintainable deployment processes while following Hardhat and OpenZeppelin best practices.