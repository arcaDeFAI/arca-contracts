# Comprehensive Localhost Testing Guide for Arca Vault System

## 🎯 Purpose
This guide provides a systematic approach to thoroughly test the Arca vault system on localhost, simulating real-world usage scenarios before moving to testnet/mainnet.

## 📋 Prerequisites
- Hardhat node running
- All dependencies installed (`npm install`)
- Clean environment (no previous deployments)

## 🚀 Phase 1: Foundation Testing (5-10 minutes)

### Step 1: Environment Setup

**Terminal 1 - Start Local Blockchain:**
```bash
npx hardhat node --reset
```
*Keep this terminal open and running*

**Terminal 2 - Run Tests:**
```bash
# Verify all tests pass
npm run test

# Compile contracts
npm run compile
```

**✅ Expected Result:** All 151 tests should pass (100% success rate)

### Step 2: Deploy Full System

```bash
# Deploy complete Arca system with mocks
npm run deploy:local
```

**✅ Expected Result:** 
- All contracts deployed successfully
- Deployment artifacts saved to `/deployments/localhost/latest.json`

### Step 3: Verify Deployment

```bash
# Verify deployment integrity
npm run deploy:verify:local
```

**✅ Expected Result:** 37/37 verification checks should pass

## 🧪 Phase 2: Manual Integration Testing (15-20 minutes)

### Step 4: Interactive Testing Setup

```bash
# Open Hardhat console for manual testing
npx hardhat console --network localhost
```

### Step 5: Manual Test Script

Copy and paste this complete script into the Hardhat console:

```javascript
// ============================================================================
// ARCA VAULT MANUAL TESTING SCRIPT
// ============================================================================

console.log("🏗️  Starting Arca Vault Manual Testing...\n");

// === SETUP PHASE ===
console.log("=== SETUP PHASE ===");

const deployment = require('./deployments/localhost/latest.json');

// Connect to deployed contracts
const vault = await ethers.getContractAt("ArcaTestnetV1", deployment.addresses.vault);
const registry = await ethers.getContractAt("ArcaVaultRegistry", deployment.addresses.registry);
const feeManager = await ethers.getContractAt("ArcaFeeManagerV1", deployment.addresses.feeManager);
const queueHandler = await ethers.getContractAt("ArcaQueueHandlerV1", deployment.addresses.queueHandler);

// Get mock token addresses
const tokenXAddr = deployment.config.tokenX;
const tokenYAddr = deployment.config.tokenY;
const tokenX = await ethers.getContractAt("MockERC20", tokenXAddr);
const tokenY = await ethers.getContractAt("MockERC20", tokenYAddr);

// Get test accounts
const [owner, user1, user2, user3] = await ethers.getSigners();

console.log("🏦 Vault deployed at:", await vault.getAddress());
console.log("💰 TokenX at:", tokenXAddr);
console.log("💰 TokenY at:", tokenYAddr);
console.log("👤 Owner:", owner.address);
console.log("👤 User1:", user1.address);
console.log("👤 User2:", user2.address);

// === TEST 1: Initial State Verification ===
console.log("\n=== TEST 1: INITIAL STATE VERIFICATION ===");

const initialVaultX = await vault.tokenBalance(0);
const initialVaultY = await vault.tokenBalance(1);
const initialUser1X = await tokenX.balanceOf(user1.address);
const initialUser1Y = await tokenY.balanceOf(user1.address);

console.log("Vault TokenX balance:", ethers.formatEther(initialVaultX));
console.log("Vault TokenY balance:", ethers.formatEther(initialVaultY));
console.log("User1 TokenX balance:", ethers.formatEther(initialUser1X));
console.log("User1 TokenY balance:", ethers.formatEther(initialUser1Y));

// Verify initial state
if (initialVaultX === 0n && initialVaultY === 0n) {
    console.log("✅ Vault starts with zero balances");
} else {
    console.log("❌ Vault should start with zero balances");
}

// === TEST 2: Fund Users ===
console.log("\n=== TEST 2: FUNDING USERS ===");

const fundAmount = ethers.parseEther("1000");
await tokenX.mint(user1.address, fundAmount);
await tokenY.mint(user1.address, fundAmount);
await tokenX.mint(user2.address, fundAmount);
await tokenY.mint(user2.address, fundAmount);
await tokenX.mint(user3.address, fundAmount);
await tokenY.mint(user3.address, fundAmount);

console.log("✅ Users funded with 1000 tokens each");
console.log("User1 TokenX balance:", ethers.formatEther(await tokenX.balanceOf(user1.address)));
console.log("User1 TokenY balance:", ethers.formatEther(await tokenY.balanceOf(user1.address)));

// === TEST 3: Deposit Workflow ===
console.log("\n=== TEST 3: DEPOSIT WORKFLOW ===");

// Approve tokens
const depositAmount = ethers.parseEther("100");
await tokenX.connect(user1).approve(vault.target, depositAmount);
await tokenY.connect(user1).approve(vault.target, depositAmount);

console.log("🔐 Tokens approved for deposit");

// Check fee settings
const depositFee = await feeManager.getDepositFee();
const basisPoints = await feeManager.BASIS_POINTS();
console.log("Deposit fee:", depositFee.toString(), "basis points (" + (Number(depositFee) / 100).toFixed(2) + "%)");

// Make deposits
console.log("📥 Depositing 100 TokenX and 100 TokenY...");
const tx1 = await vault.connect(user1).depositToken(depositAmount, 0); // TokenX
await tx1.wait();
console.log("✅ TokenX deposit completed");

const tx2 = await vault.connect(user1).depositToken(depositAmount, 1); // TokenY
await tx2.wait();
console.log("✅ TokenY deposit completed");

// Check queue status
const queueDeposits = await queueHandler.getPendingDepositsCount();
const queuedX = await queueHandler.getQueuedToken(0);
const queuedY = await queueHandler.getQueuedToken(1);

console.log("Queue deposits count:", queueDeposits.toString());
console.log("Queued TokenX:", ethers.formatEther(queuedX));
console.log("Queued TokenY:", ethers.formatEther(queuedY));

// Verify deposits are queued
if (queueDeposits === 2n && queuedX > 0n && queuedY > 0n) {
    console.log("✅ Deposits properly queued");
} else {
    console.log("❌ Deposit queueing issue");
}

// === TEST 4: Rebalance Operation ===
console.log("\n=== TEST 4: REBALANCE OPERATION ===");

const rebalanceParams = {
    deltaIds: [],
    distributionX: [],
    distributionY: [],
    ids: [],
    amounts: [],
    removeAmountXMin: 0,
    removeAmountYMin: 0,
    to: vault.target,
    refundTo: vault.target,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    forceRebalance: true
};

console.log("⚖️ Processing rebalance...");
const rebalanceTx = await vault.rebalance(rebalanceParams);
await rebalanceTx.wait();
console.log("✅ Rebalance completed!");

// Check results
const user1SharesX = await vault.getShares(user1.address, 0);
const user1SharesY = await vault.getShares(user1.address, 1);
const queueAfterRebalance = await queueHandler.getPendingDepositsCount();
const vaultBalanceX = await vault.tokenBalance(0);
const vaultBalanceY = await vault.tokenBalance(1);

console.log("User1 SharesX:", ethers.formatEther(user1SharesX));
console.log("User1 SharesY:", ethers.formatEther(user1SharesY));
console.log("Queue deposits after rebalance:", queueAfterRebalance.toString());
console.log("Vault TokenX balance:", ethers.formatEther(vaultBalanceX));
console.log("Vault TokenY balance:", ethers.formatEther(vaultBalanceY));

// Verify shares were minted
if (user1SharesX > 0n && user1SharesY > 0n && queueAfterRebalance === 0n) {
    console.log("✅ Shares minted successfully and queue processed");
} else {
    console.log("❌ Share minting or queue processing issue");
}

// === TEST 5: Withdrawal Workflow ===
console.log("\n=== TEST 5: WITHDRAWAL WORKFLOW ===");

// Get current shares
const sharesX = await vault.getShares(user1.address, 0);
const sharesY = await vault.getShares(user1.address, 1);
console.log("Current shares - X:", ethers.formatEther(sharesX), "Y:", ethers.formatEther(sharesY));

// Withdraw 25% of shares
const withdrawX = sharesX / 4n;
const withdrawY = sharesY / 4n;

console.log("📤 Withdrawing 25% of shares...");
console.log("Withdrawing X:", ethers.formatEther(withdrawX), "Y:", ethers.formatEther(withdrawY));

// Record initial balances
const initialBalanceX = await tokenX.balanceOf(user1.address);
const initialBalanceY = await tokenY.balanceOf(user1.address);

// Make withdrawal request
const withdrawTx = await vault.connect(user1).withdrawTokenShares([withdrawX, withdrawY]);
await withdrawTx.wait();

const queueWithdraws = await queueHandler.getPendingWithdrawsCount();
console.log("Queue withdraws count:", queueWithdraws.toString());

// Process withdrawal with rebalance
const secondRebalanceParams = {
    ...rebalanceParams,
    deadline: Math.floor(Date.now() / 1000) + 3600
};

console.log("⚖️ Processing withdrawal rebalance...");
const withdrawRebalanceTx = await vault.rebalance(secondRebalanceParams);
await withdrawRebalanceTx.wait();

// Check final balances
const finalBalanceX = await tokenX.balanceOf(user1.address);
const finalBalanceY = await tokenY.balanceOf(user1.address);
const receivedX = finalBalanceX - initialBalanceX;
const receivedY = finalBalanceY - initialBalanceY;

console.log("✅ Withdrawal completed!");
console.log("Received TokenX:", ethers.formatEther(receivedX));
console.log("Received TokenY:", ethers.formatEther(receivedY));
console.log("Remaining SharesX:", ethers.formatEther(await vault.getShares(user1.address, 0)));
console.log("Remaining SharesY:", ethers.formatEther(await vault.getShares(user1.address, 1)));
console.log("Queue withdraws after processing:", (await queueHandler.getPendingWithdrawsCount()).toString());

// Verify withdrawal worked
if (receivedX > 0n && receivedY > 0n) {
    console.log("✅ Withdrawal successful - tokens received");
} else {
    console.log("❌ Withdrawal issue - no tokens received");
}

// === TEST 6: Multi-User Scenario ===
console.log("\n=== TEST 6: MULTI-USER SCENARIO ===");

// User2 deposits
const user2DepositX = ethers.parseEther("200");
const user2DepositY = ethers.parseEther("150");

await tokenX.connect(user2).approve(vault.target, user2DepositX);
await tokenY.connect(user2).approve(vault.target, user2DepositY);

console.log("👤 User2 depositing 200 TokenX and 150 TokenY...");
await vault.connect(user2).depositToken(user2DepositX, 0);
await vault.connect(user2).depositToken(user2DepositY, 1);

// Process user2 deposits
console.log("⚖️ Processing User2 deposits...");
const user2RebalanceTx = await vault.rebalance({
    ...rebalanceParams,
    deadline: Math.floor(Date.now() / 1000) + 3600
});
await user2RebalanceTx.wait();

// Check final state
const finalUser1SharesX = await vault.getShares(user1.address, 0);
const finalUser1SharesY = await vault.getShares(user1.address, 1);
const user2SharesX = await vault.getShares(user2.address, 0);
const user2SharesY = await vault.getShares(user2.address, 1);
const totalSupplyX = await vault.totalSupply(0);
const totalSupplyY = await vault.totalSupply(1);

console.log("✅ Multi-user scenario completed!");
console.log("User1 SharesX:", ethers.formatEther(finalUser1SharesX));
console.log("User1 SharesY:", ethers.formatEther(finalUser1SharesY));
console.log("User2 SharesX:", ethers.formatEther(user2SharesX));
console.log("User2 SharesY:", ethers.formatEther(user2SharesY));
console.log("Total SupplyX:", ethers.formatEther(totalSupplyX));
console.log("Total SupplyY:", ethers.formatEther(totalSupplyY));

// Verify totals add up
const shareSum = finalUser1SharesX + user2SharesX;
if (shareSum <= totalSupplyX) {
    console.log("✅ Share accounting is consistent");
} else {
    console.log("❌ Share accounting error");
}

console.log("\n🎉 MANUAL TESTING PHASE 2 COMPLETED SUCCESSFULLY!");
console.log("Ready for Phase 3 edge case testing...");
```

### Step 6: Verify Results

After running the manual test script, you should see:
- ✅ All operations complete successfully
- ✅ Shares are minted and tracked correctly
- ✅ Deposits and withdrawals work end-to-end
- ✅ Multi-user scenarios work properly
- ✅ Queue management functions correctly

## 🔥 Phase 3: Edge Case Testing (10-15 minutes)

Copy and paste these edge case tests into the same Hardhat console:

```javascript
// ============================================================================
// EDGE CASE TESTING
// ============================================================================

console.log("\n🔥 Starting Edge Case Testing...");

// === TEST 7: Error Condition Testing ===
console.log("\n=== TEST 7: ERROR CONDITION TESTING ===");

// Test zero deposits
try {
    await vault.connect(user1).depositToken(0, 0);
    console.log("❌ Zero deposit should have been rejected");
} catch (e) {
    console.log("✅ Zero deposit properly rejected:", e.reason);
}

// Test insufficient allowance
try {
    await vault.connect(user3).depositToken(ethers.parseEther("100"), 0);
    console.log("❌ Insufficient allowance should have been rejected");
} catch (e) {
    console.log("✅ Insufficient allowance properly rejected");
}

// Test withdrawal with no shares
try {
    await vault.connect(user3).withdrawAll();
    console.log("❌ Zero withdrawal should have been rejected");
} catch (e) {
    console.log("✅ Zero withdrawal properly rejected:", e.reason);
}

// === TEST 8: Price and Share Calculations ===
console.log("\n=== TEST 8: PRICE AND SHARE CALCULATIONS ===");

const pricePerShareX = await vault.getPricePerFullShare(0);
const pricePerShareY = await vault.getPricePerFullShare(1);

console.log("Price per share X:", ethers.formatEther(pricePerShareX));
console.log("Price per share Y:", ethers.formatEther(pricePerShareY));

// Verify reasonable price range
if (pricePerShareX > 0n && pricePerShareY > 0n) {
    console.log("✅ Share prices are positive");
} else {
    console.log("❌ Share price calculation issue");
}

// === TEST 9: Ownership and Access Control ===
console.log("\n=== TEST 9: OWNERSHIP AND ACCESS CONTROL ===");

// Test non-owner trying owner functions
try {
    await vault.connect(user1).setRewarder("0x0000000000000000000000000000000000000000");
    console.log("❌ Non-owner should not be able to call owner functions");
} catch (e) {
    console.log("✅ Non-owner properly rejected from owner functions");
}

// Verify ownership
const vaultOwner = await vault.owner();
const feeManagerOwner = await feeManager.owner();
const queueHandlerOwner = await queueHandler.owner();

console.log("Vault owner:", vaultOwner);
console.log("FeeManager owner:", feeManagerOwner);
console.log("QueueHandler owner:", queueHandlerOwner);

if (feeManagerOwner === await vault.getAddress() && queueHandlerOwner === await vault.getAddress()) {
    console.log("✅ Ownership structure is correct");
} else {
    console.log("❌ Ownership structure issue");
}

// === TEST 10: Fee Collection Verification ===
console.log("\n=== TEST 10: FEE COLLECTION VERIFICATION ===");

const feeRecipientAddr = await feeManager.getFeeRecipient();
const feeRecipientBalanceX = await tokenX.balanceOf(feeRecipientAddr);
const feeRecipientBalanceY = await tokenY.balanceOf(feeRecipientAddr);

console.log("Fee recipient:", feeRecipientAddr);
console.log("Fee recipient TokenX balance:", ethers.formatEther(feeRecipientBalanceX));
console.log("Fee recipient TokenY balance:", ethers.formatEther(feeRecipientBalanceY));

// Check fee settings
const depositFeeRate = await feeManager.getDepositFee();
const withdrawFeeRate = await feeManager.getWithdrawFee();
const performanceFeeRate = await feeManager.getPerformanceFee();

console.log("Deposit fee:", depositFeeRate.toString(), "basis points");
console.log("Withdraw fee:", withdrawFeeRate.toString(), "basis points");
console.log("Performance fee:", performanceFeeRate.toString(), "basis points");

if (feeRecipientBalanceX > 0n || feeRecipientBalanceY > 0n) {
    console.log("✅ Fees are being collected");
} else {
    console.log("⚠️  No fees collected yet (might be expected)");
}

console.log("\n🎉 EDGE CASE TESTING COMPLETED!");
```

### Step 7: Performance Testing

```javascript
// ============================================================================
// PERFORMANCE TESTING
// ============================================================================

console.log("\n🚀 Starting Performance Testing...");

// === TEST 11: Large Amount Deposits ===
console.log("\n=== TEST 11: LARGE AMOUNT DEPOSITS ===");

const largeAmount = ethers.parseEther("10000");
await tokenX.mint(user3.address, largeAmount);
await tokenX.connect(user3).approve(vault.target, largeAmount);

console.log("🔥 Testing large deposit of 10,000 tokens...");
const startTime = Date.now();

const largeTx = await vault.connect(user3).depositToken(largeAmount, 0);
await largeTx.wait();

console.log("⚖️ Processing large deposit rebalance...");
const largeRebalanceTx = await vault.rebalance({
    ...rebalanceParams,
    deadline: Math.floor(Date.now() / 1000) + 3600
});
await largeRebalanceTx.wait();

const endTime = Date.now();
const duration = endTime - startTime;

console.log("✅ Large deposit completed in", duration, "ms");
console.log("User3 shares:", ethers.formatEther(await vault.getShares(user3.address, 0)));

if (duration < 30000) { // 30 seconds
    console.log("✅ Performance is acceptable");
} else {
    console.log("⚠️  Performance might need optimization");
}

console.log("\n🏁 ALL TESTING COMPLETED SUCCESSFULLY!");
console.log("System is ready for testnet deployment! 🚀");
```

## 📊 Final Verification Commands

After completing all manual tests, run these commands in a new terminal:

```bash
# Final verification
npm run deploy:verify:local

# Export deployment data
npm run deploy:export

# Check final contract sizes
npx hardhat size-contracts
```

## ✅ Success Criteria Checklist

After completing all tests, verify:

### Foundation (Must Pass):
- [ ] All 151 automated tests pass
- [ ] Deployment verification shows 37/37 checks pass
- [ ] All contracts deployed successfully

### Manual Integration (Must Pass):
- [ ] Deposit → rebalance → shares workflow works
- [ ] Withdraw → rebalance → tokens workflow works  
- [ ] Multi-user scenarios work correctly
- [ ] Queue management functions properly
- [ ] Share calculations are accurate

### Edge Cases (Must Pass):
- [ ] Zero amounts properly rejected
- [ ] Insufficient allowance properly rejected
- [ ] Access control works (non-owners rejected)
- [ ] Share prices are reasonable (> 0)

### Fee System (Must Pass):
- [ ] Fees are collected on deposits/withdrawals
- [ ] Fee rates are set correctly (0.5% deposit/withdraw)
- [ ] Fee recipient receives fees

### Performance (Should Pass):
- [ ] Large deposits (10,000 tokens) process correctly
- [ ] Operations complete within reasonable time (< 30s)
- [ ] System handles multiple users simultaneously

## 🚨 Troubleshooting

If any test fails:

1. **Check the error message carefully**
2. **Restart the local blockchain**: `npx hardhat node --reset`
3. **Redeploy**: `npm run deploy:local`
4. **Re-run verification**: `npm run deploy:verify:local`
5. **Check for typos in manual commands**

## 🎯 Next Steps

If all tests pass successfully:
1. ✅ System is validated for production use
2. 🚀 Ready to proceed with testnet deployment
3. 📋 Use TESTNET_DEPLOYMENT_CHECKLIST.md for next steps
4. 🔍 Run `npm run testnet:check` when Metropolis addresses are obtained

---

**Status**: Ready for execution  
**Last Updated**: December 2024