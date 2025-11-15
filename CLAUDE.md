# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Use Type Safety
**Never use the "any" type in TypeScript files**, that defeats the purpose of using TypeScript. Type safety protects us from mistakes. Use proper types.

### Critical Lesson: Failing Tests Reveal Production Bugs

**Never rush to "fix" a failing test by changing test data** - investigate the root cause first. A systematic production workflow test revealed multiple division by zero vulnerabilities:

1. **Bug 1**: `getPricePerFullShare()` division by zero when `tokenBalance == 0` but `totalSupply > 0`
2. **Bug 2**: Withdrawal processing division by zero when `totalShares[tokenIdx] == 0`

**The Fix**: Added proper edge case handling and sanity checks rather than changing test numbers.

**The Lesson**: Complex integration tests that simulate real user workflows often catch edge cases that unit tests miss. These bugs could have caused catastrophic failures in production.

**Remember**: When tests fail, ask "What should the code do?" not "How can I make the test pass?"

### Critical Lesson: Tests Define Business Requirements, Not Implementation Constraints

**When your implementation reveals better business practices than what tests expect, update the TESTS to reflect the improved requirements.**

**The Principle**: Tests should enforce good business requirements. If implementation demonstrates better practices (UX, security, efficiency, maintainability), those practices should become the new business requirements, and tests should be updated accordingly.

**Common Scenarios Where This Applies**:
- **Security**: Implementation adds input validation → Update tests to expect validation
- **UX**: Implementation adds confirmation flows → Update tests to expect confirmations  
- **Gas Efficiency**: Implementation batches operations → Update tests to expect batching
- **Error Handling**: Implementation adds graceful fallbacks → Update tests to expect fallbacks
- **Performance**: Implementation adds caching → Update tests to expect cached behavior

**Key Questions When Tests Conflict with Implementation**:
1. "Does this implementation demonstrate better business practices?"
2. "Should this improvement become our standard requirement?"
3. If yes → Update tests to enforce the better pattern
4. If no → Fix implementation to meet existing requirements

## Project Overview

Arca is a multi-protocol decentralized vault system for automated liquidity provision on the Sonic blockchain. Originally built for Metropolis DLMM (Dynamic Liquidity Market Maker) pools, the system is expanding to support multiple DEX protocols including Shadow (Ramses V3) concentrated liquidity pools. The project leverages battle-tested code from audited Metropolis Maker Vaults as its foundation, providing intelligent vault management with automated reward compounding and yield optimization through Python bot rebalancing.

## Repository Structure

This is a full-stack DeFi project with:
- **Metropolis Contracts** (`/contracts-metropolis/`) - Core vault system for DLMM pools
- **Shadow Contracts** (`/contracts-shadow/`) - Shadow/Ramses V3 integration (GPL-3.0 licensed)
- **Frontend dApp** (`/UI/`) - React-based user interface  
- **Testing Suite** (`/test/`) - Comprehensive test coverage
- **Deployment System** (`/scripts/`) - TypeScript deployment infrastructure
- **External Dependencies** (`/lib/`) - Git submodules (joe-v2)
- **Archive** (`/archive/`) - Previous implementation for reference

## Core Architecture

### Multi-Protocol Support
The system supports multiple DEX protocols through a modular architecture:

**Metropolis (DLMM)**:
- `BaseVault`, `OracleVault`, `OracleRewardVault` - Vault implementations
- `Strategy` - Manages bin-based liquidity positions
- Uses `ILBPair` interface for liquidity book pairs

**Shadow (Concentrated Liquidity)**:
- `BaseShadowVault`, `OracleShadowVault`, `OracleRewardShadowVault` - Shadow-specific vaults
- `ShadowStrategy` - Manages NFT-based concentrated liquidity positions
- Uses `IRamsesV3Pool` and `INonfungiblePositionManager` interfaces

### Factory System
- `VaultFactory` - Central factory supporting multiple vault and strategy types
- Handles deployment of protocol-specific implementations
- Manages cross-protocol configuration (NPM addresses, voters, etc.)

### Key Design Patterns
- **Upgradeable Proxy Pattern**: All contracts use OpenZeppelin's UUPS upgradeable contracts
- **Protocol-Agnostic Interfaces**: Common interfaces (`IStrategyCommon`) with protocol-specific extensions
- **Immutable Clone Pattern**: Strategies use immutable data for gas-efficient deployments
- **Queue-Based Processing**: Deposits and withdrawals are queued and processed during rebalance
- **Dual Token Shares**: Separate share tracking for TokenX and TokenY with proportional ownership
- **Position Management**: 
  - Metropolis: Direct bin management with add/remove liquidity
  - Shadow: NFT-based positions with mint/burn lifecycle

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

# Fix linting frontend code issues
npm run lint:fix
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
# Unified deployment command (auto-detects network)
npm run deploy --network <network>

# Or use specific shortcuts:
npm run deploy:local        # Local development with mocks
npm run deploy:testnet      # Sonic Blaze Testnet deployment
npm run deploy:fork         # Mainnet fork testing  
npm run deploy:mainnet      # Sonic mainnet deployment

# Post-deployment
npm run deploy:verify       # Verify deployment (requires --network flag)
npm run deploy:test         # Integration testing (requires --network flag)
npm run deploy:export       # Export addresses for UI

# Development utilities
npm run dev:reset           # Reset local blockchain
npm run dev:check           # Check mainnet readiness
npm run dev:discover        # Discover rewarder addresses
npm run dev:testnet:faucet  # Get testnet faucet info and check balance
npm run dev:testnet:status  # Check testnet readiness and contract status
```

**Deployment Strategy**: See `DEPLOYMENT.md` for complete deployment guide and our three-tier testing approach (localhost → testnet → mainnet). Fork testing remains available as an alternative to testnet.

## Code Conventions

### Solidity Standards
- Solidity version: 0.8.26 (unified across all contracts)
- Use OpenZeppelin contracts for standard functionality
- Follow UUPS upgradeable proxy patterns with proper initialization
- Implement comprehensive validation with custom modifiers
- License compliance: GPL-3.0 for Shadow integration, MIT for Metropolis base

### Testing Standards
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
- **Metropolis DLMM**: Bin-based liquidity provision with hooks and rewards
- **Shadow (Ramses V3)**: Concentrated liquidity with NFT positions and gauge rewards
- **OpenZeppelin**: Standard library for upgradeable contracts and security
- **Chainlink**: Oracle price feeds for multi-token vault deposits

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
- Protocol-specific position management ensures proper cleanup (NFT burns for Shadow)
- Slippage protection through activeId/tick validation during rebalance

### Operational Flow
1. Users deposit tokens → added to deposit queue
2. Rebalance operation processes queues in order:
   - Remove existing liquidity (protocol-specific: bins for Metropolis, NFT for Shadow)
   - Claim and compound rewards (METRO for Metropolis, gauge rewards for Shadow)
   - Process withdrawal queue (calculate shares, apply fees)
   - Process deposit queue (mint shares based on current balance)
   - Add new liquidity with remaining tokens
3. Python bot triggers rebalance based on external oracle data

### Protocol-Specific Differences
**Metropolis DLMM**:
- Positions defined by bin ranges (discrete price levels)
- Direct liquidity add/remove operations
- METRO rewards through hooks system

**Shadow Concentrated Liquidity**:
- Positions are NFTs with immutable tick ranges
- Must burn and mint new NFT to change range
- Rewards through gauge/voter system

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

**Solution**: The project uses TypeScript deployment scripts with OpenZeppelin's upgrades plugin for complex deployments, completely avoiding contract size limits. Each protocol has its own deployment script (e.g., `deploy-metropolis.ts`) that handles protocol-specific configurations.

## Development Workflow Notes

### Best Practices
- As a habit, you should run "npm run lint:fix", "npm run compile" and "npm run test" after making major code changes
- When debugging failures, ask "What should this code do?" based on business logic and test expectations
- Always verify protocol-specific implementations match their respective interfaces
- Ensure cross-protocol compatibility when modifying shared components (factory, interfaces)
- Test both Metropolis and Shadow flows when updating core functionality

### Architecture Considerations
- **Interface Hierarchy**: Common functionality in `IStrategyCommon`, protocol-specific in `IStrategyMetropolis`/`IShadowStrategy`
- **Immutable Data Layout**: Each strategy type has specific data requirements (LBPair for Metropolis, pool address for Shadow)
- **Factory Pattern**: VaultFactory handles multi-protocol deployments through type enums
- **Reward Systems**: Different reward mechanisms require protocol-specific handling
