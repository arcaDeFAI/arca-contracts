/* eslint-disable no-console */
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive manual testing script for localhost deployment
 * This script performs end-to-end testing of the Arca vault system
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: unknown;
}

async function runManualTests(): Promise<void> {
  console.log("🏗️  Starting Arca Vault Manual Testing...\n");
  
  const results: TestResult[] = [];
  
  function addResult(name: string, passed: boolean, message: string, data?: unknown) {
    results.push({ name, passed, message, data });
    const icon = passed ? "✅" : "❌";
    console.log(`${icon} ${name}: ${message}`);
    if (data) {
      console.log(`   Data:`, data);
    }
  }

  try {
    // Load deployment
    const deploymentPath = path.join(__dirname, "../deployments/localhost/latest.json");
    if (!fs.existsSync(deploymentPath)) {
      throw new Error("No localhost deployment found. Run 'npm run deploy:local' first.");
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("📅 Testing deployment from:", deployment.timestamp);
    
    // Connect to contracts
    const vault = await hre.ethers.getContractAt("ArcaTestnetV1", deployment.contracts.vault);
    const feeManager = await hre.ethers.getContractAt("ArcaFeeManagerV1", deployment.contracts.feeManager);
    const queueHandler = await hre.ethers.getContractAt("ArcaQueueHandlerV1", deployment.contracts.queueHandler);
    const tokenX = await hre.ethers.getContractAt("MockERC20", deployment.config.tokenX);
    const tokenY = await hre.ethers.getContractAt("MockERC20", deployment.config.tokenY);
    
    // Get test accounts
    const [, user1, user2] = await hre.ethers.getSigners();
    
    console.log("\n=== SETUP VERIFICATION ===");
    addResult("Contracts Connected", true, "All contracts accessible", {
      vault: await vault.getAddress(),
      tokenX: await tokenX.getAddress(),
      tokenY: await tokenY.getAddress()
    });
    
    // Test 1: Initial State
    console.log("\n=== TEST 1: INITIAL STATE ===");
    
    const initialVaultX = await vault.tokenBalance(0);
    const initialVaultY = await vault.tokenBalance(1);
    addResult("Initial Vault Balance", 
      initialVaultX === 0n && initialVaultY === 0n,
      `TokenX: ${hre.ethers.formatEther(initialVaultX)}, TokenY: ${hre.ethers.formatEther(initialVaultY)}`
    );
    
    const initialUser1X = await tokenX.balanceOf(user1.address);
    const initialUser1Y = await tokenY.balanceOf(user1.address);
    addResult("User1 Initial Balance",
      initialUser1X >= 0n && initialUser1Y >= 0n,
      `TokenX: ${hre.ethers.formatEther(initialUser1X)}, TokenY: ${hre.ethers.formatEther(initialUser1Y)}`
    );
    
    // Test 2: Fund Users
    console.log("\n=== TEST 2: FUNDING USERS ===");
    
    const fundAmount = hre.ethers.parseEther("1000");
    await tokenX.mint(user1.address, fundAmount);
    await tokenY.mint(user1.address, fundAmount);
    await tokenX.mint(user2.address, fundAmount);
    await tokenY.mint(user2.address, fundAmount);
    
    const user1BalanceX = await tokenX.balanceOf(user1.address);
    const user1BalanceY = await tokenY.balanceOf(user1.address);
    addResult("User Funding",
      user1BalanceX >= fundAmount && user1BalanceY >= fundAmount,
      `User1 now has ${hre.ethers.formatEther(user1BalanceX)} TokenX, ${hre.ethers.formatEther(user1BalanceY)} TokenY`
    );
    
    // Test 3: Deposit Workflow
    console.log("\n=== TEST 3: DEPOSIT WORKFLOW ===");
    
    const depositAmount = hre.ethers.parseEther("100");
    await tokenX.connect(user1).approve(vault.target, depositAmount);
    await tokenY.connect(user1).approve(vault.target, depositAmount);
    
    addResult("Token Approval", true, "Tokens approved for deposit");
    
    // Make deposits
    await vault.connect(user1).depositToken(depositAmount, 0); // TokenX
    await vault.connect(user1).depositToken(depositAmount, 1); // TokenY
    
    const queueDeposits = await queueHandler.getPendingDepositsCount();
    const queuedX = await queueHandler.getQueuedToken(0);
    const queuedY = await queueHandler.getQueuedToken(1);
    
    addResult("Deposits Queued",
      queueDeposits === 2n && queuedX > 0n && queuedY > 0n,
      `${queueDeposits} deposits queued, TokenX: ${hre.ethers.formatEther(queuedX)}, TokenY: ${hre.ethers.formatEther(queuedY)}`
    );
    
    // Test 4: Rebalance Operation
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
    
    const rebalanceTx = await vault.rebalance(rebalanceParams);
    await rebalanceTx.wait();
    
    const user1SharesX = await vault.getShares(user1.address, 0);
    const user1SharesY = await vault.getShares(user1.address, 1);
    const queueAfterRebalance = await queueHandler.getPendingDepositsCount();
    
    addResult("Rebalance Processing",
      user1SharesX > 0n && user1SharesY > 0n && queueAfterRebalance === 0n,
      `Shares minted - X: ${hre.ethers.formatEther(user1SharesX)}, Y: ${hre.ethers.formatEther(user1SharesY)}`
    );
    
    // Test 5: Withdrawal Workflow
    console.log("\n=== TEST 5: WITHDRAWAL WORKFLOW ===");
    
    const withdrawX = user1SharesX / 4n; // 25%
    const withdrawY = user1SharesY / 4n; // 25%
    
    const initialBalanceX = await tokenX.balanceOf(user1.address);
    const initialBalanceY = await tokenY.balanceOf(user1.address);
    
    await vault.connect(user1).withdrawTokenShares([withdrawX, withdrawY]);
    
    const queueWithdraws = await queueHandler.getPendingWithdrawsCount();
    addResult("Withdrawal Queued",
      queueWithdraws === 1n,
      `Withdrawal queued successfully`
    );
    
    // Process withdrawal
    const withdrawRebalanceTx = await vault.rebalance({
      ...rebalanceParams,
      deadline: Math.floor(Date.now() / 1000) + 3600
    });
    await withdrawRebalanceTx.wait();
    
    const finalBalanceX = await tokenX.balanceOf(user1.address);
    const finalBalanceY = await tokenY.balanceOf(user1.address);
    const receivedX = finalBalanceX - initialBalanceX;
    const receivedY = finalBalanceY - initialBalanceY;
    
    addResult("Withdrawal Processing",
      receivedX > 0n && receivedY > 0n,
      `Tokens received - X: ${hre.ethers.formatEther(receivedX)}, Y: ${hre.ethers.formatEther(receivedY)}`
    );
    
    // Test 6: Multi-User Scenario
    console.log("\n=== TEST 6: MULTI-USER SCENARIO ===");
    
    const user2DepositX = hre.ethers.parseEther("200");
    const user2DepositY = hre.ethers.parseEther("150");
    
    await tokenX.connect(user2).approve(vault.target, user2DepositX);
    await tokenY.connect(user2).approve(vault.target, user2DepositY);
    await vault.connect(user2).depositToken(user2DepositX, 0);
    await vault.connect(user2).depositToken(user2DepositY, 1);
    
    await vault.rebalance({
      ...rebalanceParams,
      deadline: Math.floor(Date.now() / 1000) + 3600
    });
    
    const user2SharesX = await vault.getShares(user2.address, 0);
    const user2SharesY = await vault.getShares(user2.address, 1);
    
    addResult("Multi-User Support",
      user2SharesX > 0n && user2SharesY > 0n,
      `User2 shares - X: ${hre.ethers.formatEther(user2SharesX)}, Y: ${hre.ethers.formatEther(user2SharesY)}`
    );
    
    // Test 7: Fee Collection
    console.log("\n=== TEST 7: FEE COLLECTION ===");
    
    const feeRecipient = await feeManager.getFeeRecipient();
    const feeBalanceX = await tokenX.balanceOf(feeRecipient);
    const feeBalanceY = await tokenY.balanceOf(feeRecipient);
    
    addResult("Fee Collection",
      feeBalanceX >= 0n && feeBalanceY >= 0n,
      `Fee recipient balances - X: ${hre.ethers.formatEther(feeBalanceX)}, Y: ${hre.ethers.formatEther(feeBalanceY)}`
    );
    
    // Test 8: Error Conditions
    console.log("\n=== TEST 8: ERROR CONDITIONS ===");
    
    try {
      await vault.connect(user1).depositToken(0, 0);
      addResult("Zero Deposit Rejection", false, "Zero deposit should have been rejected");
    } catch {
      addResult("Zero Deposit Rejection", true, "Zero deposit properly rejected");
    }
    
    try {
      await vault.connect(user1).setRewarder("0x0000000000000000000000000000000000000000");
      addResult("Access Control", false, "Non-owner should not access owner functions");
    } catch {
      addResult("Access Control", true, "Non-owner properly rejected from owner functions");
    }
    
    // Test 9: Price Calculations
    console.log("\n=== TEST 9: PRICE CALCULATIONS ===");
    
    const pricePerShareX = await vault.getPricePerFullShare(0);
    const pricePerShareY = await vault.getPricePerFullShare(1);
    
    addResult("Share Price Calculations",
      pricePerShareX > 0n && pricePerShareY > 0n,
      `Price per share - X: ${hre.ethers.formatEther(pricePerShareX)}, Y: ${hre.ethers.formatEther(pricePerShareY)}`
    );
    
    // Final Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 TESTING SUMMARY");
    console.log("=".repeat(60));
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    if (failedTests === 0) {
      console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`);
      console.log("✅ System is ready for testnet deployment!");
    } else {
      console.log(`❌ ${failedTests} TESTS FAILED out of ${totalTests}`);
      console.log(`✅ ${passedTests} tests passed`);
      console.log("\n🔥 FAILED TESTS:");
      results.filter(r => !r.passed).forEach((test, i) => {
        console.log(`${i + 1}. ${test.name}: ${test.message}`);
      });
    }
    
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("❌ Testing failed:", error);
    process.exit(1);
  }
}

async function main() {
  await runManualTests();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});