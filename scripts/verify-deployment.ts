import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function verifyDeployment() {
  const network = hre.network.name;
  console.log(`\n🔍 Verifying deployment on ${network}...\n`);
  
  // Load latest deployment
  const deploymentPath = path.join(__dirname, "../deployments", network, "latest.json");
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for ${network}`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log(`Deployment timestamp: ${deployment.timestamp}`);
  console.log(`Deployer: ${deployment.deployer}\n`);
  
  // Connect to contracts
  const vault = await hre.ethers.getContractAt("ArcaTestnetV1", deployment.addresses.vault);
  const registry = await hre.ethers.getContractAt("ArcaVaultRegistry", deployment.addresses.registry);
  const feeManager = await hre.ethers.getContractAt("ArcaFeeManagerV1", deployment.addresses.feeManager);
  const queueHandler = await hre.ethers.getContractAt("ArcaQueueHandlerV1", deployment.addresses.queueHandler);
  const rewardClaimer = await hre.ethers.getContractAt("ArcaRewardClaimerV1", deployment.addresses.rewardClaimer);
  
  console.log("=== Contract Verification ===");
  
  // Verify vault configuration
  console.log("\n📊 Vault Configuration:");
  console.log(`Owner: ${await vault.owner()}`);
  console.log(`Token count: ${await vault.TOKEN_COUNT()}`);
  
  // Verify ownership transfers
  console.log("\n🔐 Ownership Verification:");
  const vaultAddress = await vault.getAddress();
  console.log(`FeeManager owner: ${await feeManager.owner()} (should be ${vaultAddress})`);
  console.log(`QueueHandler owner: ${await queueHandler.owner()} (should be ${vaultAddress})`);
  console.log(`RewardClaimer owner: ${await rewardClaimer.owner()} (should be ${vaultAddress})`);
  
  // Verify registry
  console.log("\n📋 Registry Verification:");
  const isRegistered = await registry.isRegisteredVault(vaultAddress);
  console.log(`Vault registered: ${isRegistered}`);
  
  if (isRegistered) {
    const vaultInfo = await registry.getVaultInfo(vaultAddress);
    console.log(`Registry vault address: ${vaultInfo.vault}`);
    console.log(`Registry active status: ${vaultInfo.isActive}`);
  }
  
  // Verify proxy implementation
  console.log("\n🔄 Proxy Verification:");
  try {
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; // EIP-1967 implementation slot
    const implAddress = await hre.ethers.provider.getStorage(vaultAddress, implSlot);
    console.log(`Vault implementation: ${implAddress}`);
  } catch {
    console.log("Unable to verify proxy implementation");
  }
  
  // Basic functionality checks
  console.log("\n✅ Basic Functionality Checks:");
  
  try {
    const feeRecipient = await feeManager.getFeeRecipient();
    console.log(`Fee recipient: ${feeRecipient}`);
    
    const depositFee = await feeManager.getDepositFee();
    console.log(`Deposit fee: ${depositFee.toString()} basis points`);
    
    const withdrawFee = await feeManager.getWithdrawFee();
    console.log(`Withdraw fee: ${withdrawFee.toString()} basis points`);
    
    const performanceFee = await feeManager.getPerformanceFee();
    console.log(`Performance fee: ${performanceFee.toString()} basis points`);
    
    // Check token balances
    const TokenX = 0;
    const TokenY = 1;
    const balanceX = await vault.tokenBalance(TokenX);
    const balanceY = await vault.tokenBalance(TokenY);
    console.log(`Token X balance: ${balanceX.toString()}`);
    console.log(`Token Y balance: ${balanceY.toString()}`);
  } catch (error) {
    console.error("Error checking functionality:", error);
  }
  
  console.log("\n✅ Deployment verification complete!");
}

async function main() {
  try {
    await verifyDeployment();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}