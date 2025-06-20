# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arca is a decentralized vault system for automated liquidity provision on the Sonic blockchain. It provides intelligent vault management for Metropolis DLMM (Dynamic Liquidity Market Maker) pools with automated reward compounding and yield optimization through Python bot rebalancing.

## Repository Structure

This is a full-stack DeFi project with:
- **Smart Contracts** (`/contracts/`) - Solidity vault system
- **Frontend dApp** (`/UI/`) - React-based user interface  
- **Testing Suite** (`/test/`) - Comprehensive test coverage
- **Deployment System** (`/scripts/`, `/ignition/`) - TypeScript deployment infrastructure
- **External Dependencies** (`/lib/`) - Git submodules (joe-v2)

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

### Frontend Development (UI Directory)
```bash
# Navigate to UI directory
cd UI/

# Install dependencies
npm install

# Start development server
npm run dev

# Build production
npm run build

# Lint frontend code
npm run lint

# TypeScript type checking
npm run type-check
```

### Testing
```bash
# Run tests on local network
npx hardhat test --network localhost

# Run specific test file
npx hardhat test test/ArcaTestnet.test.ts

# Run integration tests
npx hardhat test test/*.integration.test.ts

# Run precision tests
npx hardhat test test/*.precise.test.ts

# Generate test data
npx hardhat test-data:network-config
```

### Deployment

**CRITICAL: Contract Size Limits**
⚠️ Always use script-based deployment, not factory contracts. Factory contracts that import multiple concrete contracts will exceed the 24.5KB contract size limit and fail to deploy on mainnet.

```bash
# Recommended: Script-based UUPS deployment
npx hardhat run scripts/deployArcaSystem.ts --network <network>

# Hardhat Ignition (for simple deployments)
npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts --network <network>
```

**Deployment Strategy**: See `DEPLOYMENT_STRATEGY.md` for comprehensive deployment guidelines.

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

### Frontend Standards (UI Directory)
- React 18 with TypeScript and Vite
- Tailwind CSS for styling with Radix UI components
- Wagmi + RainbowKit for Web3 wallet integration
- TanStack Query for async state management
- ESLint with React and TypeScript rules

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

## Testing Strategy

### Test Organization
The test suite is organized into several categories:

**Unit Tests** (`*.test.ts`):
- Core deposit/withdrawal flows with fee calculations
- Queue management and processing logic
- Individual contract functionality

**Integration Tests** (`*.integration.test.ts`):
- Cross-contract interactions
- Full system workflows (deposit → rebalance → withdraw)
- Ownership transfer scenarios
- Reward compounding end-to-end flows

**Precision Tests** (`*.precise.test.ts`):
- Mathematical accuracy verification
- Share calculation precision
- Fee calculation accuracy
- Edge cases with small/large numbers

### Mock System
Comprehensive mocking infrastructure for isolated testing:
- `MockERC20`: Token behavior simulation
- `MockLBRouter`: DEX router functionality
- `MockLBPair`: Liquidity pair simulation
- `MockLBHooksBaseRewarder`: Reward mechanism testing

### Testing Best Practices
- **Always run full test suite**: `npm run test` before making changes
- **Test-driven development**: Write tests for new features first
- **Integration focus**: Test complex multi-contract interactions
- **Edge case coverage**: Test boundary conditions and error states
- **Gas optimization**: Monitor gas usage in tests

Run the full test suite before making changes to ensure system integrity.

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

### Contract Size Management ⚠️

**CRITICAL WARNING**: Never create factory contracts that import multiple concrete contracts. They will exceed the 24.5KB Spurious Dragon limit.

**Best Practices**:
1. **Use Script-Based Deployment**: Logic in TypeScript scripts, not Solidity contracts
2. **Interface Over Concrete**: Import interfaces instead of full contracts where possible
3. **OpenZeppelin Upgrades Plugin**: Use for UUPS proxy deployment
4. **Contract Size Monitoring**: Run `npm run compile` to check for size warnings

**Example Interface Usage**:
```solidity
// Instead of:
import {ArcaFeeManagerV1} from "./ArcaFeeManagerV1.sol";

// Use:
import {IArcaFeeManagerV1} from "./interfaces/IArcaFeeManagerV1.sol";
```

**Solution**: The project uses TypeScript deployment scripts (`scripts/deployArcaSystem.ts`) with OpenZeppelin's upgrades plugin for complex deployments, completely avoiding contract size limits.