import fs from "fs";
import path from "path";

/**
 * Clean up deployment progress file
 * - Remove duplicates from failedVaults
 * - Remove successfully deployed vaults from failedVaults
 * - Option to reset progress entirely
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || "hardhat";
  const progressFile = path.join("deployments", network, "multi-vault-progress.json");
  
  // Parse command line arguments
  // Check environment variable since Hardhat doesn't pass args well
  const resetFlag = process.env.RESET_PROGRESS === "true";
  
  if (!fs.existsSync(progressFile)) {
    console.log(`No progress file found for network: ${network}`);
    return;
  }
  
  if (resetFlag) {
    console.log(`🗑️  Resetting deployment progress for ${network}...`);
    fs.unlinkSync(progressFile);
    console.log("✓ Progress file deleted. Next deployment will start fresh.");
    return;
  }
  
  // Load and clean progress
  const progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
  
  console.log(`🧹 Cleaning deployment progress for ${network}...`);
  console.log(`\nBefore cleaning:`);
  console.log(`- Deployed vaults: ${progress.deployedVaults.length}`);
  console.log(`- Failed vaults: ${progress.failedVaults.length}`);
  
  // Remove duplicates from failedVaults
  const uniqueFailedVaults = [...new Set(progress.failedVaults)];
  
  // Remove successfully deployed vaults from failed list
  const actuallyFailedVaults = uniqueFailedVaults.filter(
    vaultId => !progress.deployedVaults.includes(vaultId)
  );
  
  progress.failedVaults = actuallyFailedVaults;
  
  console.log(`\nAfter cleaning:`);
  console.log(`- Deployed vaults: ${progress.deployedVaults.length} (${progress.deployedVaults.join(", ")})`);
  console.log(`- Failed vaults: ${progress.failedVaults.length} (${progress.failedVaults.join(", ")})`);
  
  // Save cleaned progress
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  console.log(`\n✓ Progress file cleaned and saved`);
  
  // Show next steps
  if (progress.failedVaults.length > 0) {
    console.log(`\nTo retry failed vaults, run:`);
    console.log(`DEPLOY_RESUME=true npm run deploy:${network === "sonic-testnet" ? "testnet" : network}`);
  }
}

main().catch(console.error);