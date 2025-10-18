# Vault Factory CLI

A comprehensive command-line interface for controlling the deployed VaultFactory contract on the Sonic network.

## Overview

The Vault Factory CLI provides an interactive menu-driven interface for:
- **Deploying new vaults** (both Shadow and Metropolis types)
- **Managing factory settings** (operators, fees, whitelist)
- **Viewing factory information** and vault listings
- **Emergency operations** (emergency mode, token recovery)
- **Gas tracking** for all operations

## Features

### 🚀 Vault Deployment
- **Shadow Oracle Reward Vaults**: Deploy vaults for Ramses V3 concentrated liquidity pools
- **Metropolis Oracle Vaults**: Deploy vaults for DLMM (Dynamic Liquidity Market Maker) pairs
- **Automatic validation**: Checks pool/pair whitelist status, TWAP requirements, and fee limits
- **Smart caching**: Saves deployment results to cache files for easy access

### 🏭 Factory Management
- **View comprehensive factory information**: addresses, statistics, implementation contracts
- **List all vaults and strategies** by type with pagination
- **Operator management**: view and set default operators, manage strategy operators
- **Fee management**: creation fees, AUM fees, fee recipients
- **Whitelist management**: add/remove pairs from deployment whitelist

### 🚨 Emergency Operations
- **Emergency mode**: Set vaults to emergency-only withdrawal mode (irreversible)
- **Cancel shutdown**: Cancel pending vault shutdowns
- **Token recovery**: Recover stuck ERC20 tokens from vaults

### 📊 Gas Tracking & Reporting
- **Real-time gas tracking** for all transactions
- **Comprehensive reports** with total gas usage and costs
- **Export functionality** to save gas reports as JSON files
- **Transaction categorization** (deployment, configuration, admin)

## Usage

### Prerequisites

1. **Factory deployment**: Ensure VaultFactory is deployed and address is in deployment file
2. **Network configuration**: Configure your target network in `hardhat.config.ts`
3. **Permissions**: You need factory owner permissions for most admin operations

### Running the CLI

```bash
# Basic usage (uses deployment file to find factory address)
npx hardhat run scripts/vault-factory-cli.ts --network <network-name>

# Examples for different networks
npx hardhat run scripts/vault-factory-cli.ts --network sonic-mainnet
npx hardhat run scripts/vault-factory-cli.ts --network localhost
```

### Configuration

The CLI automatically loads the VaultFactory address from:
```
deployments/metropolis-<network-name>.json
```

If the deployment file doesn't exist or doesn't contain the factory address, the script will exit with an error.

## Menu Structure

```
=== Vault Factory Control Panel ===

🏭 Factory Operations
  1. View Factory Information
  2. List Vaults
  3. List Strategies

🚀 Vault Deployment
  4. Deploy Shadow Vault
  5. Deploy Metropolis Vault

🔧 Admin Functions
  6. Manage Operators
  7. Manage Fees
  8. Manage Whitelist
  9. Emergency Operations

📊 Utilities
  10. Export Gas Report
  0. Exit
```

## Deployment Workflows

### Shadow Vault Deployment

1. **Pool Selection**: Enter Ramses V3 pool address
2. **Validation**: Automatic checks for:
   - Valid pool address and token information
   - Whitelist status
   - TWAP observation cardinality (if TWAP interval > 0)
3. **Configuration**: Set AUM fee and TWAP interval
4. **Deployment**: Execute with creation fee payment
5. **Result Caching**: Save vault and strategy addresses to `cache/latest-shadow-vault.json`

### Metropolis Vault Deployment

1. **Pair Selection**: Enter LBPair address
2. **Validation**: Automatic checks for:
   - Valid LBPair address and token information
   - Whitelist status
   - TWAP oracle configuration
3. **Configuration**: Set AUM fee
4. **Deployment**: Execute with creation fee payment
5. **Result Caching**: Save vault and strategy addresses to `cache/latest-metropolis-vault.json`

## Admin Operations

### Operator Management
- **View Default Operator**: Display current default operator address
- **Set Default Operator**: Update factory default operator
- **Set Strategy Operator**: Change operator for specific strategies

### Fee Management
- **Creation Fee**: View and modify vault creation fees
- **Fee Recipient**: View and update fee recipient address
- **AUM Fees**: Set pending AUM fees or reset them for specific vaults

### Whitelist Management
- **Check Status**: Verify if pairs/pools are whitelisted
- **Add to Whitelist**: Whitelist new pairs/pools for vault creation
- **Remove from Whitelist**: Remove pairs/pools from whitelist

### Emergency Operations
- **Set Emergency Mode**: Irreversible emergency shutdown (requires double confirmation)
- **Cancel Shutdown**: Cancel pending vault shutdown procedures
- **Token Recovery**: Recover stuck ERC20 tokens from vaults

## Output and Logging

### Real-time Feedback
- **Transaction hashes** displayed immediately
- **Gas usage** tracked and displayed per transaction
- **Confirmation prompts** for all destructive operations
- **Color-coded output** for easy readability

### Gas Reports
Export detailed gas usage reports:
```json
{
  "timestamp": "2025-09-27T12:00:00.000Z",
  "network": "sonic-mainnet",
  "transactions": [
    {
      "name": "Deploy Shadow Oracle Reward Vault",
      "gasUsed": "2450000",
      "gasPrice": "1000000000",
      "cost": "2450000000000000",
      "txHash": "0x...",
      "category": "deployment"
    }
  ]
}
```

### Cache Files
Deployment results are automatically cached:
- `cache/latest-shadow-vault.json`: Most recent Shadow vault deployment
- `cache/latest-metropolis-vault.json`: Most recent Metropolis vault deployment

## Safety Features

### Input Validation
- **Address validation**: All addresses checked with `ethers.isAddress()`
- **Range validation**: Fees, intervals, and amounts validated against limits
- **Whitelist checks**: Automatic validation before deployment attempts

### Confirmation Prompts
- **Single confirmation**: Standard operations
- **Double confirmation**: Irreversible operations (emergency mode)
- **Operation summaries**: Clear display of what will be executed

### Error Handling
- **Graceful error handling** with descriptive messages
- **Transaction failure recovery** with detailed error information
- **Network connectivity checks** and timeout handling

## Troubleshooting

### Common Issues

1. **"Factory address not found"**
   - Ensure deployment file exists: `deployments/metropolis-<network>.json`
   - Verify `vaultFactory` address is present in deployment file

2. **"You are not the factory owner"**
   - Most admin operations require factory owner permissions
   - Check your signer address matches the factory owner

3. **"Pool/Pair is not whitelisted"**
   - Use whitelist management to add pools/pairs before deployment
   - Verify the correct address is being used

4. **"Insufficient observation cardinality"**
   - For Shadow vaults with TWAP, pool needs ≥10 observation slots
   - Use TWAP interval of 0 for spot price only

5. **"Transaction failed"**
   - Check gas limits and network connectivity
   - Verify account has sufficient native token balance
   - Review transaction parameters for validity

### Network Issues
- **Local development**: Ensure Hardhat node is running
- **Testnet/Mainnet**: Check RPC endpoint configuration
- **Gas estimation**: Some networks may require manual gas limit settings

## Development Notes

### Code Structure
```
VaultFactoryCLI (main class)
├── Initialization & Setup
├── Menu System & Navigation
├── Factory Information Display
├── Vault & Strategy Listings
├── Deployment Functions (Shadow & Metropolis)
├── Admin Functions (Operators, Fees, Whitelist)
├── Emergency Operations
└── Gas Tracking & Reporting
```

### Dependencies
- **Hardhat**: Ethereum development environment
- **ethers.js**: Blockchain interaction library
- **chalk**: Terminal string styling
- **readline**: Interactive CLI prompts
- **TypeScript**: Type safety and development experience

### Extension Points
The CLI is designed for easy extension:
- Add new vault types by extending deployment methods
- Add new admin functions by following existing patterns
- Modify gas tracking categories or export formats
- Customize output formatting and colors

## Security Considerations

- **Private key security**: Never commit private keys or mnemonics
- **Owner permissions**: Most admin functions require factory owner access
- **Irreversible operations**: Emergency mode cannot be undone
- **Token recovery**: Only recover tokens that are actually stuck
- **Fee validation**: AUM fees are capped at 30% (3000 basis points)

## Support

For issues with the CLI:
1. Check this documentation first
2. Verify network and deployment configuration
3. Test on localhost/testnet before mainnet operations
4. Review transaction logs and error messages