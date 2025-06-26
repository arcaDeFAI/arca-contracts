# Arca Vault Deployment Guide

This guide covers the complete deployment infrastructure for the Arca Vault system.

## Overview

The deployment system uses a unified script-based approach that works consistently across all environments:
- **Local Testing**: Full production-grade deployment with mock contracts
- **Sonic Testnet**: Real testnet deployment with actual contracts
- **Sonic Mainnet**: Production deployment

## Quick Start

### Local Development

1. **Start a local Hardhat node:**
   ```bash
   npx hardhat node
   ```

2. **Deploy to local network:**
   ```bash
   npm run deploy:local
   ```

3. **Verify deployment:**
   ```bash
   npm run deploy:verify
   ```

### Testnet Deployment

1. **Configure testnet addresses:**
   Edit `config/networks/sonic-testnet.json` and replace all `TODO` placeholders with actual testnet addresses.

2. **Set environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and set PRIVATE_KEY and other variables
   ```

3. **Deploy to testnet:**
   ```bash
   npm run deploy:testnet
   ```

## Configuration Files

### Network Configurations

Configuration files are located in `config/networks/`:

- `localhost.json` - Local development with mock contracts
- `sonic-testnet.json` - Sonic testnet configuration
- `sonic-mainnet.json` - Sonic mainnet configuration

Each configuration includes:
- Network settings (RPC, chain ID, block explorer)
- Deployment parameters (vault name, symbol, fees)
- Contract addresses
- Gas settings
- Security settings (for mainnet)

### Environment Variables

Create a `.env` file with:

```bash
# Private key for deployment
PRIVATE_KEY=your_private_key_here

# RPC URLs (optional - defaults provided)
SONIC_TESTNET_RPC_URL=https://rpc.testnet.soniclabs.com
SONIC_MAINNET_RPC_URL=https://rpc.soniclabs.com

# Block explorer API key
SONIC_SCAN_API_KEY=your_api_key_here

# Fee recipient addresses
TESTNET_FEE_RECIPIENT=0x...
MAINNET_FEE_RECIPIENT=0x...
```

## Available Scripts

### Core Deployment
- `npm run deploy:local` - Deploy to localhost with mocks
- `npm run deploy:testnet` - Deploy to Sonic testnet
- `npm run deploy:verify` - Verify deployment functionality
- `npm run deploy:export` - Export addresses for frontend

### Local Development
- `npm run local:reset` - Reset local blockchain
- `npm run local:setup` - Deploy only mock contracts

### Manual Commands
```bash
# Deploy with custom network
npx hardhat run scripts/deployArcaSystem.ts --network <network>

# Verify contracts on block explorer
npx hardhat verify --network <network> <contract-address>
```

## Deployment Process

The deployment system follows these steps:

### 1. Configuration Loading
- Loads network-specific configuration from `config/networks/`
- Validates configuration and checks for placeholders
- For localhost: prepares to deploy mock contracts

### 2. Mock Deployment (localhost only)
- Deploys mock ERC20 tokens (TokenX, TokenY, Reward Token)
- Deploys mock infrastructure (LB Router, LB Pair, Rewarder)
- Funds test accounts with tokens

### 3. Arca System Deployment
- **Step 1**: Deploy Beacon contracts for supporting contracts
- **Step 2**: Deploy Beacon Proxies (QueueHandler, FeeManager)
- **Step 3**: Deploy UUPS Proxies (RewardClaimer, Main Vault)
- **Step 4**: Transfer ownership to main vault
- **Step 5**: Deploy and configure registry

### 4. Post-Deployment
- Save deployment artifacts to `deployments/{network}/`
- Verify contract functionality
- Export addresses for frontend integration

## Deployment Artifacts

Deployment information is saved to `deployments/{network}/`:

```
deployments/
├── localhost/
│   ├── deployment-2024-12-26T10-30-00.json
│   └── latest.json
├── sonic-testnet/
│   └── latest.json
└── exports/
    ├── deployments.json
    ├── deployments.ts
    └── .env.localhost
```

Each deployment file contains:
- Contract addresses
- Deployment configuration
- Deployer information
- Timestamp
- Contract versions

## Frontend Integration

Export deployment addresses using:

```bash
npm run deploy:export
```

This creates multiple formats:
- `exports/deployments.json` - JSON format
- `exports/deployments.ts` - TypeScript with types
- `exports/.env.{network}` - Environment variables

## Upgrading Contracts

The system uses OpenZeppelin's UUPS and Beacon proxy patterns:

### UUPS Proxies (Main Vault, RewardClaimer)
```bash
# Deploy new implementation
npx hardhat run scripts/upgrade-vault.ts --network <network>
```

### Beacon Proxies (QueueHandler, FeeManager)
```bash
# Upgrade beacon implementation
npx hardhat run scripts/upgrade-beacon.ts --network <network>
```

## Security Considerations

### Testnet
- Use dedicated testnet private keys
- Fee recipients should be test addresses
- Regular security testing

### Mainnet
- Multi-signature wallet for ownership
- Timelock contracts for upgrades
- Professional security audit
- Staged deployment process

## Troubleshooting

### Common Issues

1. **"Network configuration not found"**
   - Ensure the network JSON file exists in `config/networks/`
   - Check network name matches hardhat.config.ts

2. **"Contains placeholder values"**
   - Replace all `TODO` placeholders in network config
   - Set appropriate environment variables

3. **"Insufficient funds"**
   - Ensure deployer account has enough native tokens
   - For testnet, get tokens from faucet

4. **Deployment verification fails**
   - Check all contracts deployed successfully
   - Verify ownership transfers completed
   - Run `npm run deploy:verify` for detailed checks

### Getting Help

1. Check deployment logs in console output
2. Verify configuration files
3. Review `deployments/{network}/latest.json` for deployment state
4. Run verification script to check deployment health

## Network Information

### Sonic Blaze Testnet
- Chain ID: 57054
- RPC: https://rpc.blaze.soniclabs.com
- Explorer: https://testnet.sonicscan.org
- Faucet: https://testnet.soniclabs.com/account

### Sonic Mainnet
- Chain ID: 146
- RPC: https://rpc.soniclabs.com
- Explorer: https://sonicscan.org

---

For more detailed information, see:
- [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) - Technical deployment approach
- [DEPLOYMENT_ROADMAP.md](./DEPLOYMENT_ROADMAP.md) - Implementation phases
- [CLAUDE.md](./CLAUDE.md) - Development guidelines