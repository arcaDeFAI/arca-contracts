# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arca is a decentralized vault system for automated liquidity provision on the Sonic blockchain. It provides intelligent vault management for Metropolis DLMM (Dynamic Liquidity Market Maker) pools with automated reward compounding and yield optimization through Python bot rebalancing.

**Project Status**: Active development - expect frequent changes, TODOs, and evolving architecture.

## Repository Structure

This is a full-stack DeFi project with:
- **Smart Contracts** (`/contracts/`) - Solidity vault system
- **Frontend dApp** (`/UI/`) - React-based user interface  
- **Testing Suite** (`/test/`) - Comprehensive test coverage
- **Deployment System** (`/contracts/deployment/`, `/ignition/`) - Atomic deployment infrastructure
- **External Dependencies** (`/lib/`) - Git submodules (joe-v2)

## Core Architecture

### Smart Contract Structure
- **ArcaTestnetV1**: Main vault contract handling deposits, withdrawals, and liquidity management
- **ArcaQueueHandlerV1**: Manages deposit/withdrawal queues for batched processing
- **ArcaRewardClaimerV1**: Handles METRO reward claiming and automatic compounding
- **ArcaFeeManagerV1**: Manages fee configuration and collection (0.5% deposit/withdraw, 10% performance)
- **VaultDeployer**: Atomic deployment system for coordinated contract initialization

### Key Design Patterns
- **Upgradeable Proxy Pattern**: All contracts use OpenZeppelin's upgradeable contracts
- **Queue-Based Processing**: Deposits and withdrawals are queued and processed during rebalance operations
- **Dual Token Shares**: Separate share tracking for TokenX and TokenY with proportional ownership
- **Modular Architecture**: Fee management, queue handling, and reward claiming are separated into dedicated contracts
- **Atomic Deployment**: VaultDeployer ensures all contracts are deployed and configured together

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
```bash
# Deploy using Hardhat Ignition
npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts

# Deploy using VaultDeployer (atomic deployment)
npx hardhat run scripts/deployVaultSystem.js --network <network>
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

### Frontend Standards (UI Directory)
- React 18 with TypeScript and Vite
- Tailwind CSS for styling with Radix UI components
- Wagmi + RainbowKit for Web3 wallet integration
- TanStack Query for async state management
- ESLint with React and TypeScript rules

## Development Environment

### DevContainer Setup (Optional)
The repository includes a complete DevContainer configuration for consistent development:
- **Base Image**: Node.js 22 with TypeScript toolbox
- **Pre-installed Extensions**: ESLint, Solidity support
- **Automatic Setup**: Dependencies installed via `setup.sh`
- **Bash Aliases**: Convenient shortcuts (`c` for clear, `ll` for detailed listing)

**Note**: DevContainer is optional - the project works fine in regular environments.

### CI/CD Pipeline
GitHub Actions workflow (`.github/workflows/pipeline.yml`) runs on:
- **Triggers**: PRs and pushes to `main`, `dev`, `production`, `releases/**`
- **Smart Contract Pipeline**:
  1. Git submodule checkout (joe-v2)
  2. Solidity linting via Solhint
  3. Contract compilation
  4. Full test suite execution
- **Frontend Pipeline**:
  1. UI dependency installation
  2. Frontend linting
  3. Production build verification

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

## Deployment Strategy

### VaultDeployer System
The project uses `VaultDeployer.sol` for atomic deployment of the entire vault ecosystem:

**Deployment Process**:
1. Deploy all components with deployer as initial owner
2. Initialize vault with all component addresses
3. Transfer ownership of all components to vault in correct order
4. Verify ownership transfers completed successfully

**Benefits**:
- Atomic deployment prevents partial system states
- Proper ownership hierarchy established automatically
- Emergency ownership transfer functions for recovery

### Deployment Commands
```bash
# Traditional individual deployment
npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts

# Atomic system deployment (recommended)
npx hardhat run scripts/deployVaultSystem.js --network <network>
```

## Active Development Notes

### Project Status
**Current Phase**: Active development with frequent architecture changes

### Known TODOs and Development Areas
- **Security Features**: Emergency pause mechanisms, exposure limits
- **Test Coverage**: Some test files contain placeholder TODOs
- **Two-Step Ownership**: VaultDeployer has commented two-step ownership logic
- **Performance Optimization**: Gas optimization opportunities in queue processing

### Development Workflow
1. **Before Making Changes**: Always run `npm run test` to ensure system integrity
2. **Code Quality**: Run `npm run lint` and fix issues before commits
3. **Integration Testing**: Focus on `*.integration.test.ts` for complex flows
4. **Precision Testing**: Use `*.precise.test.ts` for mathematical accuracy verification

### Working with TODOs
When encountering TODOs in code:
- **Contract TODOs**: Often indicate security or optimization improvements needed
- **Test TODOs**: Usually mark incomplete test coverage areas
- **Comment TODOs**: May indicate uncertain implementation decisions

Always discuss TODO resolution with the development team before implementation.

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

### Contract Size Considerations ⚠️
**CRITICAL**: Several contracts may exceed the 24576 byte limit (Spurious Dragon limit) when compiled.

**Known Issues**:
- `ArcaVaultFactory.sol` currently exceeds limit (~54KB)
- Complex contracts with many functions are at risk

**Solutions (DO NOT modify optimizer settings)**:
1. **Use Interfaces** - Replace direct contract imports with interface imports where possible
2. **Library Pattern** - Extract common functionality into libraries
3. **Factory Splitting** - Break large factory contracts into smaller specialized contracts
4. **Function Reduction** - Remove or simplify non-essential functions
5. **External Function Calls** - Move complex logic to external contracts

**Example Interface Usage**:
```solidity
// Instead of:
import {ArcaFeeManagerV1} from "./ArcaFeeManagerV1.sol";

// Use:
import {IArcaFeeManagerV1} from "./interfaces/IArcaFeeManagerV1.sol";
```

**Warning Signs**:
- Compilation warnings about contract size
- Functions failing to deploy on mainnet
- Gas estimation failures

**Testing**: Always test deployment on testnets before mainnet to catch size issues early.

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

**Critical**: Run the full test suite before making changes to ensure system integrity.