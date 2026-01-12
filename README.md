# Arca Protocol

Multi-protocol automated liquidity provision system for the SEI blockchain, supporting [DragonSwap](https://dragonswap.app/) concentrated liquidity protocols.

## Overview

Arca is a decentralized vault system that provides intelligent liquidity management across multiple DEX protocols.
The system automates complex DeFi operations including:

- Automated liquidity provision and rebalancing
- Reward compounding and yield optimization
- Multi-token vault deposits with oracle-based pricing
- Queue-based deposit/withdrawal processing for gas efficiency

Built on battle-tested code from audited [Metropolis Maker Vaults](https://app.metropolis.exchange/makervault/list/:146) (on Sonic), Arca extends support while maintaining a unified interface for users.

Arca was originally built for the [Sonic blockchain](https://www.soniclabs.com/), which is why there are references to [Metropolis](https://metropolis.exchange/) and [Shadow](https://www.shadow.so/), which are products found on the Sonic chain.  

However, the team is currently **in the process of migrating arca to [SEI](https://www.sei.io/)**, with the goal of becoming a SEI native.  

## Features

- **Automated Rebalancing**: Python bots optimize positions based on market conditions
- **Reward Compounding**: Automatically harvest and reinvest rewards
- **Gas-Efficient Operations**: Queue-based processing batches user operations
- **Oracle Integration**: Price feeds enable multi-token deposits
- **Upgradeable Architecture**: UUPS proxy pattern for future improvements
- **Professional UI**: React-based dApp with comprehensive vault management

## Quick Start

### Prerequisites
- Git
- Recommended: VS Code with [dev container](https://code.visualstudio.com/docs/devcontainers/containers)
- Recommended: working within a *Linux* development environment (symlinks are used)
  - Windows users can work in [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/arca-contracts.git
cd arca-contracts
code .
```
Then, accept the VS Code prompt to **"Reopen in Container"**.
This will take care of installing the dependencies (forge, etc.).
After the initial installation, you might need to close and re-open the VS Code terminal in order to source the bash profiles.
You can then test that everything was installed correctly by forcing a recompilation of the solidity files:
```bash
npm run compile -- --force
```

### Build Configuration Note

The project uses `@arca/joe-v2` imports for the Joe V2 library dependencies. These are resolved via symlinks in `node_modules/@arca/` that point to the actual library locations in `contracts-metropolis/lib/`. This approach ensures both IDE support and compilation work correctly across all development environments.

### Compile Contracts

```bash
npm run compile
```

Force re-compilation:

```bash
npm run compile -- --force
```

### Run Tests

```bash
# Run all tests (Solidity + UI)
npm run test

# Run only Solidity tests
npm run test:sol

# Run only UI tests
npm run test:ui
```

### Deploy Contracts

```bash
# Deploy to local network (with mocks)
npm run deploy:local

# Deploy to  SEI Testnet
npm run deploy:testnet

# Deploy to mainnet fork (for testing)
npm run deploy:fork

# Deploy to SEI mainnet
npm run deploy:mainnet

# Verify contracts after deployment
npm run deploy:verify:testnet  # or mainnet, local, fork
```

To test the GitHub pipeline locally, you can use the `act` command (see [this repo](https://github.com/nektos/act)).

## Repository Structure

```
arca-contracts/
├── contracts-metropolis/    # Metropolis DLMM vault implementation
│   ├── src/
│   │   ├── BaseVault.sol           # Core vault logic
│   │   ├── OracleRewardVault.sol   # Vault with reward compounding
│   │   ├── MetropolisStrategy.sol  # DLMM liquidity management
│   │   ├── VaultFactory.sol        # Central factory for all protocols
│   │   └── interfaces/             # Contract interfaces
│   └── lib/                        # External libraries (joe-v2)
│
├── contracts-shadow/        # Shadow/Ramses V3 implementation
│   ├── src/
│   │   ├── OracleRewardShadowVault.sol  # Shadow vault with rewards
│   │   ├── ShadowStrategy.sol           # V3 position management
│   │   └── libraries/                   # Shadow-specific helpers
│   └── CL/                              # Concentrated liquidity core
│
├── UI/                      # Frontend application
│   ├── src/
│   │   ├── pages/          # Dashboard, vaults, staking
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Web3 integration (wagmi, rainbowkit)
│   └── package.json
│
├── scripts/                 # Deployment and utility scripts
│   ├── deploy-multi-dex.ts         # Main deployment script
│   ├── verify-multi-dex.ts         # Contract verification
│   ├── test-deployment.ts          # Integration testing
│   └── export-addresses.ts         # Export for UI
│
├── test/                    # Comprehensive test suite
│   ├── *.test.ts           # Unit tests
│   ├── *.integration.test.ts      # Cross-contract tests
│   └── *.precise.test.ts         # Precision tests
│
└── deployments/            # Deployment artifacts
    └── metropolis-{network}.json
```

## Architecture

### Core Components

**VaultFactory**
- Central deployment hub for all vault types and strategies
- Manages protocol-specific configurations (NPM addresses, voters)
- Handles whitelist and access control

**Vault Implementations**
- `OracleRewardVault`: Metropolis DLMM vault with METRO rewards
- `OracleRewardShadowVault`: Shadow V3 vault with gauge rewards
- Both inherit from `BaseVault` for common functionality

**Strategy Implementations**
- `MetropolisStrategy`: Manages bin-based liquidity positions
- `ShadowStrategy`: Manages NFT-based concentrated liquidity
- Immutable clone pattern for gas-efficient deployments

**Key Design Patterns**
- UUPS upgradeable proxies for all contracts
- Queue-based deposit/withdrawal processing
- Dual token share tracking (TokenX and TokenY)
- Protocol-agnostic interfaces with specific extensions

### Operational Flow

1. **User Deposits**: Tokens are added to deposit queue
2. **Rebalance Triggered**: Python bot initiates rebalancing
3. **Processing**:
   - Remove existing liquidity positions
   - Claim and compound rewards
   - Process withdrawal queue with fees
   - Process deposit queue and mint shares
   - Add new liquidity at optimal ranges
4. **Position Management**: Protocol-specific handling (bins vs NFTs)

## Frontend dApp

The UI provides a professional interface for interacting with Arca vaults:

### Technology Stack
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS + Radix UI components
- Wagmi + RainbowKit for Web3
- TanStack Query for data fetching

### Development

```bash
cd UI/

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Fix linting issues
npm run lint:fix
```

## Contract Addresses

### SEI Mainnet
TODO UPDATE ME
Mainnet addresses available in `deployments/metropolis-sonic-mainnet.json`.

View verified contracts on [SeiScan](https://seiscan.io)

### SEI Testnet
Testnet addresses available in `deployments/metropolis-sonic-testnet.json`

## Configuration

### Environment Variables
Create a `.env` file based off the `.env.example` example file.
Fill in the values.

### Protocol Configuration

Configure protocol addresses in `scripts/deploy-multi-dex.ts`:

```typescript
const deploymentConfig = {
  "sei-mainnet": {
    npm: "0x12E66C8F215DdD5d48d150c8f46aD0c6fB0F4406",  // Shadow NPM
    voter: "0x9F59398D0a397b2EEB8a6123a6c7295cB0b0062D", // Shadow Voter
    whitelist: [...],  // Approved pools/pairs
    priceLens: "..."   // Price feed contract
  }
}
```

## Development Workflow

### Code Quality

```bash
# Run linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Check contract sizes
npm run compile  # Warns if contracts exceed size limits
```

## Security

### Audit Status
- Based on audited Metropolis Maker Vaults code
- Additional security measures:
  - ReentrancyGuard on all user-facing functions
  - Comprehensive input validation
  - Emergency token recovery functions
  - Owner-only critical operations
  - Slippage protection during rebalancing

### Best Practices
- Never deploy factory contracts that import multiple concrete contracts (24.5KB limit)
- Use interface imports instead of concrete contracts
- Follow UUPS upgrade safety patterns
- Implement proper access control

## Protocol-Specific Details

### Metropolis DLMM
- Positions defined by bin ranges (discrete price levels)
- Direct liquidity add/remove operations
- METRO rewards through hooks system
- Max range: 51 bins

### Shadow Concentrated Liquidity
- NFT-based position management
- Immutable tick ranges per position
- Gauge rewards through voter system
- Max range: 887,272 ticks

### Development Standards

- **Solidity**: Version 0.8.26, OpenZeppelin standards
- **TypeScript**: Strict mode, proper typing
- **Testing**: Comprehensive coverage required
- **Documentation**: Update relevant docs

## License

- Metropolis contracts: MIT License
- Shadow integration: GPL-3.0 License (due to Ramses V3 licensing)
- UI and scripts: MIT License

## Support

- Documentation: [arca gitbook](https://arcas-organization.gitbook.io/arca-finance)
- Web site: [arcafi.com](https://www.arcafi.com/)
- Twitter: [@arcaFinance](https://x.com/arcaFinance)

## Acknowledgments

Built on the shoulders of giants:
- Metropolis Exchange for DLMM infrastructure
- Shadow/Ramses for concentrated liquidity
- DragonSwap v2 periphery and core contracts
- OpenZeppelin for security standards
- Chainlink for price oracles
