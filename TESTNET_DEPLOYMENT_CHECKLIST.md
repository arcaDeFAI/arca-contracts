# Sonic Testnet Deployment Checklist

## 🚨 Prerequisites - MUST HAVE before deployment

### 1. Contract Addresses (Metropolis DLMM on Sonic Testnet)

Replace these in `config/networks/sonic-testnet.json`:

- [ ] **tokenX**: `TODO_SET_TOKEN_X_ADDRESS` - First token of the pair
- [ ] **tokenY**: `TODO_SET_TOKEN_Y_ADDRESS` - Second token of the pair
- [ ] **lbRouter**: `TODO_SET_LB_ROUTER_ADDRESS` - Metropolis DLMM Router
- [ ] **lbpAMM**: `TODO_SET_LBP_AMM_ADDRESS` - The AMM pair contract
- [ ] **lbpContract**: `TODO_SET_LBP_CONTRACT_ADDRESS` - The liquidity pool contract
- [ ] **rewarder**: `TODO_SET_REWARDER_ADDRESS` - METRO rewards distribution contract
- [ ] **rewardToken**: `TODO_SET_METRO_TOKEN_ADDRESS` - METRO token address
- [ ] **nativeToken**: `TODO_SET_NATIVE_TOKEN_ADDRESS` - Wrapped Sonic (wS) address
- [ ] **lbpContractUSD**: `TODO_SET_LBP_CONTRACT_USD_ADDRESS` - USD pricing pair

### 2. Environment Variables (.env file)

Create `.env` file with:

```bash
# Deployment wallet private key (NO 0x prefix)
PRIVATE_KEY=your_private_key_here

# Fee recipient address for vault fees
TESTNET_FEE_RECIPIENT=0x_your_fee_recipient_address

# Optional but recommended for contract verification
SONIC_SCAN_API_KEY=your_api_key_if_available
```

### 3. Deployment Wallet Setup

- [ ] Wallet has Sonic testnet tokens for gas
- [ ] Get testnet tokens from: [Sonic Testnet Faucet URL needed]
- [ ] Recommended amount: At least 10 S tokens for deployment

### 4. Configuration Validation

- [ ] Verify `binStep: 25` is correct for your chosen pair
- [ ] Confirm `idSlippage: 5` is appropriate
- [ ] Review `amountXMin` and `amountYMin` values

## 📋 Deployment Steps

Once all prerequisites are met:

1. **Update Configuration**
   ```bash
   # Edit the testnet config with actual addresses
   vim config/networks/sonic-testnet.json
   ```

2. **Verify Environment**
   ```bash
   # Check that .env is set up correctly
   cat .env | grep PRIVATE_KEY
   cat .env | grep TESTNET_FEE_RECIPIENT
   ```

3. **Run Readiness Check** ⭐
   ```bash
   npm run testnet:check
   ```
   This will validate all prerequisites and show exactly what's missing.

4. **Deploy to Testnet**
   ```bash
   npm run deploy:testnet
   ```

5. **Verify Deployment**
   ```bash
   npm run deploy:verify:testnet
   ```

5. **Test Operations**
   - Deposit tokens
   - Process rebalance
   - Withdraw tokens
   - Verify fee collection

## 🔍 Where to Find Missing Information

### Metropolis DLMM Documentation
- Official docs: [Need URL]
- Discord/Telegram: [Need community links]
- GitHub: [Need repository URL]

### Sonic Testnet Resources
- Explorer: https://testnet.sonicscan.org
- Faucet: [Need URL]
- RPC: https://rpc.blaze.soniclabs.com

## ⚠️ Important Notes

1. **DO NOT** deploy with TODO placeholders - deployment will fail validation
2. **DO NOT** commit your `.env` file to git
3. **DO** test thoroughly on testnet before mainnet
4. **DO** save deployment artifacts for reference

## 📊 Post-Deployment Verification

After successful deployment:

1. Check all contracts on block explorer
2. Verify ownership transfers completed
3. Test deposit/withdraw with small amounts
4. Monitor gas usage for optimization
5. Document any issues or observations

---

**Status**: ❌ Not Ready - Missing all contract addresses

**Last Updated**: December 2024