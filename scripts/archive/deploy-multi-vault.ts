import { ethers } from "hardhat";
import { loadNetworkConfig, validateNetworkConfig, applyFeeRecipientOverrides } from "./utils/multi-vault-config";
import { deployAllVaults } from "./utils/multi-vault-deployer";

/**
 * Main deployment script for multi-vault system
 * 
 * Usage:
 *   npm run deploy --network localhost
 *   DEPLOY_VAULTS="ws-usdc,metro-usdc" npm run deploy --network sonic-testnet
 *   DEPLOY_RESUME=true npm run deploy --network sonic-testnet
 *   DEPLOY_RESUME=true DEPLOY_VAULTS="ws-usdc" npm run deploy --network sonic-testnet
 * 
 * Environment variable overrides:
 *   LOCALHOST_VAULT_WS_USDC_FEE_RECIPIENT=0x... npm run deploy --network localhost
 */
async function main() {
  // Parse environment variables (Hardhat doesn't support passing args to scripts)
  const vaultIds = process.env.DEPLOY_VAULTS 
    ? process.env.DEPLOY_VAULTS.split(",").map(id => id.trim())
    : undefined;
  
  const resume = process.env.DEPLOY_RESUME === "true";
  
  const network = process.env.HARDHAT_NETWORK || "hardhat";
  
  console.log("\n🚀 Arca Multi-Vault Deployment");
  console.log("=".repeat(50));
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // Check minimum balance
    const minBalance = ethers.parseEther("0.5"); // Rough estimate for deployment costs
    if (balance < minBalance && network !== "localhost" && network !== "hardhat") {
      throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ETH for deployment`);
    }
    
    // Load and validate network configuration
    console.log("📋 Loading network configuration...");
    let networkConfig = loadNetworkConfig(network);
    
    // Apply fee recipient overrides from environment variables
    networkConfig = applyFeeRecipientOverrides(networkConfig);
    
    // Validate configuration
    try {
      validateNetworkConfig(networkConfig);
      console.log("✓ Configuration validated successfully");
    } catch (error) {
      console.error("❌ Invalid configuration:", error);
      process.exit(1);
    }
    
    // Show deployment options
    if (vaultIds) {
      console.log(`\n📦 Deploying specific vaults: ${vaultIds.join(", ")}`);
      
      // Validate vault IDs exist
      const validIds = networkConfig.vaults.map(v => v.id);
      const invalidIds = vaultIds.filter(id => !validIds.includes(id));
      if (invalidIds.length > 0) {
        throw new Error(`Invalid vault IDs: ${invalidIds.join(", ")}. Valid options: ${validIds.join(", ")}`);
      }
    } else {
      const enabledVaults = networkConfig.vaults.filter(v => v.enabled);
      console.log(`\n📦 Deploying all enabled vaults (${enabledVaults.length} total)`);
    }
    
    if (resume) {
      console.log("♻️  Resuming from previous deployment progress");
    }
    
    // Deploy vaults
    console.log("\n" + "=".repeat(50));
    console.log("STARTING DEPLOYMENT");
    console.log("=".repeat(50));
    
    const result = await deployAllVaults(deployer, networkConfig, {
      vaultIds,
      resume
    });
    
    // Summary
    console.log("\n✅ Multi-vault deployment completed successfully!");
    
    console.log("\n📊 Deployed Infrastructure:");
    console.log(`├─ Registry: ${result.sharedInfrastructure.registry}`);
    console.log(`├─ QueueHandler Beacon: ${result.sharedInfrastructure.queueHandlerBeacon}`);
    console.log(`├─ FeeManager Beacon: ${result.sharedInfrastructure.feeManagerBeacon}`);
    console.log(`├─ LB Router: ${result.sharedInfrastructure.lbRouter}`);
    console.log(`└─ LB Factory: ${result.sharedInfrastructure.lbFactory}`);
    
    console.log("\n💎 Deployed Tokens:");
    result.tokens.forEach((token, symbol) => {
      console.log(`├─ ${symbol}: ${token.address}`);
    });
    
    console.log("\n🏦 Deployed Vaults:");
    let vaultIndex = 0;
    const vaultCount = result.vaults.size;
    result.vaults.forEach((vault, id) => {
      vaultIndex++;
      const isLast = vaultIndex === vaultCount;
      const prefix = isLast ? "└─" : "├─";
      const indent = isLast ? "   " : "│  ";
      
      console.log(`${prefix} ${id}:`);
      console.log(`${indent} ├─ Vault: ${vault.addresses.vault}`);
      console.log(`${indent} ├─ RewardClaimer: ${vault.addresses.rewardClaimer}`);
      console.log(`${indent} ├─ QueueHandler: ${vault.addresses.queueHandler}`);
      console.log(`${indent} ├─ FeeManager: ${vault.addresses.feeManager}`);
      console.log(`${indent} ├─ Tokens: ${vault.tokenX} / ${vault.tokenY}`);
      console.log(`${indent} └─ LB Pair: ${vault.lbPair}`);
    });
    
    // Provide next steps
    console.log("\n📝 Next Steps:");
    console.log("=".repeat(50));
    
    if (network === "localhost" || network === "hardhat") {
      console.log("1. Test vault functionality:");
      console.log("   npx hardhat test test/multi-vault.integration.test.ts --network localhost");
      console.log("\n2. Export deployment for UI:");
      console.log("   npm run deploy:export");
      console.log("\n3. Start UI development server:");
      console.log("   cd UI && npm run dev");
    } else if (network === "sonic-testnet") {
      console.log("1. Verify contracts on block explorer:");
      console.log("   npm run deploy:verify --network sonic-testnet");
      console.log("\n2. Get testnet tokens from faucet:");
      console.log("   https://testnet.soniclabs.com/account");
      console.log("\n3. Test vault operations with testnet tokens");
      console.log("\n4. Export deployment for UI:");
      console.log("   npm run deploy:export");
    } else if (network === "sonic-mainnet") {
      console.log("⚠️  PRODUCTION DEPLOYMENT - CRITICAL STEPS:");
      console.log("\n1. Verify all contracts immediately:");
      console.log("   npm run deploy:verify --network sonic-mainnet");
      console.log("\n2. Transfer ownership to multisig wallet");
      console.log("\n3. Configure monitoring and alerts:");
      console.log("   - Set up Tenderly alerts");
      console.log("   - Configure Grafana dashboards");
      console.log("\n4. Update production UI:");
      console.log("   npm run deploy:export");
      console.log("   git commit -m 'Update mainnet deployment addresses'");
      console.log("\n5. Announce deployment to community");
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    if (error instanceof Error && error.message.includes("Nonce too high")) {
      console.error("\n💡 Tip: Reset your nonce or wait for pending transactions to complete");
    }
    
    console.error("\n♻️  To resume deployment, run:");
    console.error(`npm run deploy --network ${network} -- --resume`);
    
    process.exit(1);
  }
}

// Run deployment
main().catch((error) => {
  console.error(error);
  process.exit(1);
});