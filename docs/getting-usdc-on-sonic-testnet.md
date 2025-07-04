# Getting USDC on Sonic Blaze Testnet

This guide explains how to obtain USDC tokens on Sonic Blaze Testnet for testing Arca vaults.

## Overview

Since there's no direct USDC faucet on Sonic Blaze testnet, you need to:
1. Get native S tokens from the faucet
2. Wrap them to wS (wrapped S) tokens
3. Swap wS for USDC on Metropolis DEX

## Prerequisites

- Wallet with Sonic Blaze Testnet configured (Chain ID: 57054)
- Node.js and npm installed
- This repository cloned and dependencies installed

## Step-by-Step Guide

### 1. Get Native S Tokens

Visit the Sonic testnet faucet: https://testnet.soniclabs.com/account

Request testnet S tokens (you'll receive ~100 S tokens).

### 2. Check Your Balances

```bash
npx hardhat run scripts/debug/check-wallet-balances.ts --network sonic-testnet
```

This will show your native S, wrapped S (wS), and USDC balances.

### 3. Swap S for USDC

Use the automated script to wrap S tokens and swap for USDC:

```bash
npx hardhat run scripts/debug/check-pool-and-swap.ts --network sonic-testnet
```

The script will:
- Check available wS-USDC liquidity pools
- Wrap your native S tokens to wS (if needed)
- Execute the swap using the best available pool
- Show the transaction hash and USDC received

## Important Addresses

- **Wrapped S (wS)**: `0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38`
- **USDC**: `0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0`
- **LB Router**: `0xe77DA7F5B6927fD5E0e825B2B27aca526341069B`
- **LB Factory**: `0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7`

## Available Liquidity Pools

- **20 bin step pool**: `0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995` (recommended - better liquidity)
- **50 bin step pool**: `0xAeB979e6f291F82028A29C2240448472B96FA7F2`

## Current Exchange Rate

As of testing: ~0.476 USDC per wS token (rates may vary based on pool liquidity)

## Troubleshooting

### "No wrapped S tokens found"
- The script will automatically wrap your native S tokens
- Ensure you have enough native S for gas fees

### "Swap failed"
- Check you have approved the router to spend your wS tokens
- Ensure the pool has sufficient liquidity
- Try using the alternative pool if one fails

### Transaction Explorer
View your transactions on Sonic testnet explorer: https://testnet.sonicscan.org

## Manual Process (Advanced)

If you prefer manual control:

1. **Wrap S tokens**: Call `deposit()` on the wrapped S contract with native S as value
2. **Approve router**: Approve the LB Router to spend your wS tokens
3. **Execute swap**: Use the router's `swapExactTokensForTokens` with version 2 path

## Notes

- Keep some native S tokens for gas fees
- The script automatically handles wrapping if you only have native S
- USDC on testnet has 6 decimals (not 18)
- Pool liquidity can vary - larger swaps may get worse rates