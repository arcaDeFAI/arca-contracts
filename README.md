# arca-contracts
## Setup
Open the folder in VS Code, and select "Reopen in Container".  
For a first time setup, you will need to run `git submodule update --init --recursive` to clone the required joe-v2 library.

### Build Tools
This project primarily uses Hardhat for development. Additionally, Foundry is required alongside the `hardhat-foundry` plugin to enable Foundry-style import remappings for the Metropolis contracts located in `/contracts-metropolis`.

## 📋 Project Overview

**Arca** is a decentralized application (dApp) that operates as an intelligent vault system for automated liquidity provision on the Sonic blockchain. The project focuses on yield optimization through strategic liquidity management in Metropolis DLMM (Dynamic Liquidity Market Maker) pools.

### Core Value Proposition
- **Automated LP Management**: Users deposit tokens, Arca optimally manages liquidity positions
- **Yield Optimization**: Python bot rebalances positions based on external oracle data
- **Reward Compounding**: Automatic claiming and reinvestment of METRO rewards
- **Professional Management**: Sophisticated bin placement strategies for DLMM pools

## 🏗️ System Architecture

### Contract Hierarchy
```
ArcaTestnetV1 (Main Vault)
├── ArcaQueueHandlerV1 (Deposit/Withdraw Queue Management)
├── ArcaRewardClaimerV1 (METRO Reward Claiming & Compounding)
├── ArcaFeeManagerV1 (Fee Configuration & Collection)
└── External Dependencies
    ├── Metropolis DLMM (ILBPair, ILBRouter)
    ├── SHADOW Exchange (Future Integration)
    └── Python Rebalancing Bot
```

### Deployment Strategy
- **One vault per DLMM pool**: Each vault contract is deployed for a specific TokenX/TokenY pair
- **Centralized management**: Python bot manages multiple vault instances
- **Modular design**: Separate contracts for different responsibilities

## 💰 Business Model & Economics

### Fee Structure
| Fee Type | Rate | Collection Point | Purpose |
|----------|------|------------------|---------|
| Deposit Fee | 0.5% | On user deposit | Entry fee |
| Withdrawal Fee | 0.5% | On user withdrawal | Exit fee |
| Performance Fee | 10% | On METRO rewards | Yield sharing |

### Revenue Streams
1. **Management Fees**: Deposit/withdrawal fees provide consistent revenue
2. **Performance Fees**: 10% of METRO rewards claimed from liquidity provision
3. **Compounding Benefits**: Protocol benefits from increased AUM through compounding

### User Economics
- **Share-based ownership**: Users receive vault shares proportional to deposits
- **Compound growth**: METRO rewards are reinvested, increasing share value
- **Professional management**: Bot optimization potentially outperforms manual LP management

## License

arca is licensed under the **GNU General Public License v3.0 or later (GPLv3)**.

This project includes components from:
- Code originally licensed under the [MIT License](https://opensource.org/licenses/MIT). See individual files for SPDX license headers and the NOTICE file for details.
- Code originally licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html). See individual files for SPDX license headers.

All modifications and new contributions made as part of arca are licensed under GPLv3.

See the [LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for more information.
