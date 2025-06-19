# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arca is a decentralized vault system for automated liquidity provision on the Sonic blockchain. It provides intelligent vault management for Metropolis DLMM (Dynamic Liquidity Market Maker) pools with automated reward compounding and yield optimization through Python bot rebalancing.

## Core Architecture

### Smart Contract Structure
- **ArcaTestnetV1**: Main vault contract handling deposits, withdrawals, and liquidity management
- **ArcaQueueHandlerV1**: Manages deposit/withdrawal queues for batched processing
- **ArcaRewardClaimerV1**: Handles METRO reward claiming and automatic compounding
- **ArcaFeeManagerV1**: Manages fee configuration and collection (0.5% deposit/withdraw, 10% performance)

### Key Design Patterns
- **Upgradeable Proxy Pattern**: All contracts use OpenZeppelin's upgradeable contracts
- **Queue-Based Processing**: Deposits and withdrawals are queued and processed during rebalance operations
- **Dual Token Shares**: Separate share tracking for TokenX and TokenY with proportional ownership
- **Modular Architecture**: Fee management, queue handling, and reward claiming are separated into dedicated contracts

## Development Commands

### Core Development
```bash
# Compile contracts
npm run compile

# Run tests
npm run test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing
```bash
# Run tests on local network
hardhat test --network localhost

# Run specific test file
hardhat test test/ArcaTestnet.test.ts

# Generate test data
hardhat test-data:network-config
```

### Deployment
```bash
# Deploy using Hardhat Ignition
hardhat ignition deploy ./ignition/modules/ArcaVault.ts
```

## Code Conventions

### Solidity Standards
- Solidity version: 0.8.28
- Use OpenZeppelin contracts for standard functionality
- Follow upgradeable proxy patterns with proper initialization
- Implement comprehensive validation with custom modifiers (`validToken`, etc.)

### Testing Standards
- Use Hardhat's testing framework with TypeScript
- Test files located in `test/` directory with pattern `*.test.ts`
- Mock external dependencies for isolated unit testing

### Code Quality
- Prettier formatting for both Solidity and TypeScript
- ESLint configuration with TypeScript support
- Solhint for Solidity-specific linting rules
- Contract size optimization enabled via hardhat-contract-sizer

## External Dependencies

### Blockchain Integrations
- **Joe V2 (Trader Joe)**: Used for LB Router and Pair interfaces (submodule at `lib/joe-v2/`)
- **Metropolis DLMM**: Primary liquidity provision target
- **SHADOW Exchange**: Future integration planned
- **OpenZeppelin**: Standard library for upgradeable contracts and security

### Development Dependencies
- Hardhat with TypeScript toolbox
- Custom interface generator for ABI exports
- Contract size analyzer for optimization

## Important Notes

### Security Considerations
- All user-facing functions use ReentrancyGuard
- Fee collection happens before share calculations
- Emergency functions for stuck token recovery
- Owner-only functions for critical operations

### Operational Flow
1. Users deposit tokens → added to deposit queue
2. Rebalance operation processes queues in order:
   - Remove existing liquidity if needed
   - Claim and compound METRO rewards
   - Process withdrawal queue (calculate shares, apply fees)
   - Process deposit queue (mint shares based on current balance)
   - Add new liquidity with remaining tokens
3. Python bot triggers rebalance based on external oracle data

### Queue Management
- Deposits are queued until next rebalance to optimize gas costs
- Withdrawals are processed proportionally based on current liquidity
- Queue processing is atomic - either all succeed or revert

## Testing Strategy

The test suite covers:
- Core deposit/withdrawal flows with fee calculations
- Queue management and processing logic
- Reward claiming and compounding mechanisms
- Edge cases and error conditions
- Integration with external DEX protocols

Run the full test suite before making changes to ensure system integrity.