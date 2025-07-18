# arca-contracts
## Setup
Open the folder in VS Code, and select "Reopen in Container".  
For a first time setup, you will need to run `git submodule update --init --recursive` to clone the required joe-v2 library.

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
