# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Test-Driven Development (TDD) Methodology

**ALWAYS follow TDD principles when working on this codebase.** This is the primary development methodology and has proven essential for this project's success.

### TDD Workflow (MANDATORY)
1. **Requirements First**: Understand what the code should do based on business logic
2. **Tests Define Behavior**: Write or examine tests to understand expected behavior  
3. **Code Follows Tests**: Implement code to satisfy test requirements
4. **Never Hack Tests**: Fix code to meet test expectations, not the reverse

### Why TDD is Critical for This Project
- **Prevented Production Bugs**: TDD caught a critical fee initialization bug that would have caused complete fee revenue loss
- **Better Design Decisions**: Led to the elegant hybrid queue design (view + processing functions)
- **Accurate Implementation**: Tests define the real-world contract behavior, ensuring correctness
- **Upgradeable Contract Safety**: OpenZeppelin upgrade validation integrated into test suite catches breaking changes

### TDD Success Examples from This Project
- **ArcaFeeManagerV1**: TDD revealed fee initialization wasn't happening in proxy deployment
- **ArcaQueueHandlerV1**: Tests demanded clean separation of view vs state-changing functions
- **ArcaRewardClaimerV1**: Test expectations revealed business logic bug in reward claiming flow
- **ArcaTestnetV1 Division by Zero**: Production workflow test revealed critical division by zero bugs in `getPricePerFullShare` and withdrawal processing when token balances hit edge cases

### Critical TDD Lesson: Failing Tests Reveal Production Bugs

**Never rush to "fix" a failing test by changing test data** - investigate the root cause first. A systematic production workflow test revealed multiple division by zero vulnerabilities:

1. **Bug 1**: `getPricePerFullShare()` division by zero when `tokenBalance == 0` but `totalSupply > 0`
2. **Bug 2**: Withdrawal processing division by zero when `totalShares[tokenIdx] == 0`

**The Fix**: Added proper edge case handling and sanity checks rather than changing test numbers.

**The Lesson**: Complex integration tests that simulate real user workflows often catch edge cases that unit tests miss. These bugs could have caused catastrophic failures in production.

**Remember**: When tests fail, ask "What should the code do?" not "How can I make the test pass?"

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

# Hardhat Ignition (for testing only - no proxies)
npx hardhat ignition deploy ./ignition/modules/ArcaVault.ts --network localhost
```

**Deployment Strategy**: See `DEPLOYMENT_STRATEGY.md` for comprehensive deployment guidelines.

## Code Conventions

### Solidity Standards
- Solidity version: 0.8.28
- Use OpenZeppelin contracts for standard functionality
- Follow upgradeable proxy patterns with proper initialization
- Implement comprehensive validation with custom modifiers

### Testing Standards
- **FOLLOW TDD**: Tests define requirements, code implements them
- **PRECISION IS MANDATORY**: Always test exact values, never use vague assertions like `gt(0)` or `to.be.a("bigint")`. Calculate and verify specific expected amounts based on business logic
- Use Hardhat's testing framework with TypeScript
- Test files located in `test/` directory with pattern `*.test.ts`
- Production-accurate proxy deployment in all tests (catches upgrade safety issues)
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

## Development Workflow Notes

### Best Practices
- **TDD FIRST**: Always understand requirements through tests before changing code
- As a habit, you should run "npm run lint:fix", "npm run compile" and "npm run test" after making major code changes
- When debugging failures, ask "What should this code do?" based on business logic and test expectations