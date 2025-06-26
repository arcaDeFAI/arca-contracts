# Finding Metropolis DLMM Contract Addresses

## 🎯 Goal
Find the contract addresses for Metropolis DLMM on Sonic Blaze testnet to complete our deployment configuration.

## 📍 What We Need

Based on our vault system requirements, we need these specific addresses:

### Core DLMM Infrastructure
1. **LB Router** (`lbRouter`) - The main router contract for liquidity operations
2. **LBP AMM** (`lbpAMM`) - The AMM pair contract we'll integrate with
3. **LBP Contract** (`lbpContract`) - The specific liquidity pool contract
4. **LBP Contract USD** (`lbpContractUSD`) - USD pricing pair for value calculations

### Token Addresses  
5. **METRO Token** (`rewardToken`) - The METRO governance/reward token
6. **Native Token** (`nativeToken`) - Wrapped Sonic (wS) address
7. **Token X** (`tokenX`) - First token of our target pair
8. **Token Y** (`tokenY`) - Second token of our target pair

### Rewards System
9. **Rewarder** (`rewarder`) - The contract that distributes METRO rewards

## 🔍 Where to Look

### 1. Official Metropolis Resources
- **Website**: https://metropolis.exchange/
- **DEX App**: https://app.metropolis.exchange/swap
  - Try switching to testnet mode in the interface
  - Check browser dev tools (F12) for contract calls
- **Documentation**: Look for developer docs or API references
- **Social**: Twitter @MetropolisDEX for announcements

### 2. Sonic Testnet Explorer
- **Explorer**: https://testnet.sonicscan.org
- **Search for**: "Metropolis", "METRO", "LBRouter", "LBFactory"
- **Look for**: Recently deployed contracts or popular tokens

### 3. GitHub Repositories
Search for:
- `metropolis-dex`
- `liquidity-book`
- `joe-v2` (since Metropolis uses Liquidity Book tech)
- Look for deployment scripts or contract addresses in README files

### 4. Community Channels
- **Discord**: Join Metropolis community Discord
- **Telegram**: Look for official Metropolis channels  
- **Forum**: Check Sonic community forums

### 5. Smart Contract Investigation
If you find any Metropolis contract:
```bash
# Use cast (foundry) to explore contracts
cast storage <contract_address> --rpc-url https://rpc.blaze.soniclabs.com

# Check for factory patterns
cast call <factory_address> "getAllPairs()(address[])" --rpc-url https://rpc.blaze.soniclabs.com
```

## 🕵️ Investigation Strategy

### Step 1: Start with Known Mainnet Addresses
From our research, we know some mainnet addresses:
- Metropolis Token: `0x71e99522ead5e21cf57f1f542dc4ad2e841f7321`
- METRO/wS Simple: `0x9fc6b2cadaa287d2c4d635231b51c96b8cc92859`
- METRO/wS DLMM: `0xf2088eb2d7bdc2d25c02a5b731f30cda52862010`

Look for similar deployment patterns on testnet.

### Step 2: Check Common Token Pairs
Likely testnet pairs to look for:
- wS/USDC (wrapped Sonic / USD Coin)
- METRO/wS (if METRO exists on testnet)
- ETH/wS (if bridged ETH exists)

### Step 3: Examine Transaction Patterns
If you find any Metropolis transactions:
1. Look at the `to` address (likely a router)
2. Check internal transactions for factory calls
3. Follow the creation trail to find deployment transactions

### Step 4: Contact Metropolis Team
If addresses aren't publicly available:
1. Reach out on Twitter @MetropolisDEX
2. Join their Discord/Telegram and ask in dev channels
3. Submit a GitHub issue asking for testnet documentation

## 📋 Verification Checklist

Once you find potential addresses, verify them:

- [ ] **Router Contract**: Should have `addLiquidity` and `removeLiquidity` functions
- [ ] **Token Contracts**: Should be valid ERC20 tokens with proper metadata
- [ ] **Pair Contracts**: Should have liquidity and trading functions
- [ ] **Rewarder Contract**: Should have reward distribution functions
- [ ] **Address Format**: All addresses should be 42 characters starting with 0x

## 🚀 Quick Validation

Once you have addresses, test them:

```bash
# Run our readiness check
npm run testnet:check

# Test with Hardhat console
npx hardhat console --network sonic-testnet
```

## 📝 Template for Community Questions

When asking in community channels:

> Hi! I'm building a vault system that integrates with Metropolis DLMM on Sonic Blaze testnet. Could you share the testnet contract addresses for:
> - LB Router
> - METRO token (if available on testnet)  
> - Any available trading pairs
> - Reward distribution contracts
> 
> I'm specifically looking to integrate with the Liquidity Book functionality. Thanks!

## ⚠️ Important Notes

1. **Testnet vs Mainnet**: Testnet addresses will be completely different from mainnet
2. **Token Availability**: Not all mainnet tokens may exist on testnet
3. **Deployment Status**: Metropolis DLMM may not be fully deployed on testnet yet
4. **Alternative Plan**: If Metropolis isn't on testnet, we may need to deploy to mainnet directly or use a different testnet

---

**Status**: 🔍 Investigating - Need to find these addresses

**Last Updated**: December 2024