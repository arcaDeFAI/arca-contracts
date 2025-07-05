import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Registry management utility
 * - List all registered vaults
 * - Remove vaults from registry (soft delete)
 * - Mark vaults as deprecated (when registry v2 is implemented)
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || "hardhat";
  const action = process.env.REGISTRY_ACTION || "list"; // list, remove, deprecate
  const vaultAddress = process.env.VAULT_ADDRESS;
  
  console.log(`\n🔧 Registry Management Tool`);
  console.log(`Network: ${network}`);
  console.log(`Action: ${action}`);
  
  // Get registry address from latest deployment
  const deploymentFile = path.join("deployments", network, "latest-multi-vault.json");
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found for network: ${network}`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const registryAddress = deployment.sharedInfrastructure.registry;
  
  const [signer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("ArcaVaultRegistry", registryAddress, signer);
  
  switch (action) {
    case "list":
      await listVaults(registry);
      break;
      
    case "remove":
      if (!vaultAddress) {
        throw new Error("VAULT_ADDRESS environment variable required for remove action");
      }
      await removeVault(registry, vaultAddress);
      break;
      
    case "deprecate":
      console.log("⚠️  Deprecation requires registry v2 with version/deprecated fields");
      console.log("   Current registry doesn't support this feature yet");
      break;
      
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function listVaults(registry: any) {
  console.log("\n📋 Registered Vaults:");
  console.log("=".repeat(80));
  
  const vaultCount = await registry.getVaultCount();
  console.log(`Total vaults: ${vaultCount}`);
  
  // Group vaults by token pair
  const vaultsByPair = new Map<string, any[]>();
  
  for (let i = 0; i < vaultCount; i++) {
    const vaultAddress = await registry.vaultList(i);
    const vaultInfo = await registry.getVaultInfo(vaultAddress);
    
    // Get details from registry
    const name = vaultInfo.name;
    const symbol = vaultInfo.symbol;
    const tokenX = vaultInfo.tokenX;
    const tokenY = vaultInfo.tokenY;
    
    // Get token symbols using IERC20 interface
    let tokenXSymbol = "UNKNOWN";
    let tokenYSymbol = "UNKNOWN";
    
    try {
      const tokenXContract = await ethers.getContractAt("IERC20Metadata", tokenX);
      tokenXSymbol = await tokenXContract.symbol();
    } catch (e) {
      // Fallback to short address if token doesn't support symbol()
      tokenXSymbol = tokenX.slice(0, 6) + "...";
    }
    
    try {
      const tokenYContract = await ethers.getContractAt("IERC20Metadata", tokenY);
      tokenYSymbol = await tokenYContract.symbol();
    } catch (e) {
      tokenYSymbol = tokenY.slice(0, 6) + "...";
    }
    
    const pairKey = `${tokenXSymbol}-${tokenYSymbol}`;
    
    const vaultData = {
      index: i,
      address: vaultAddress,
      name,
      symbol,
      tokenX,
      tokenY,
      tokenXSymbol,
      tokenYSymbol,
      deploymentId: i + 1,
      isActive: vaultInfo.isActive,
      deployer: vaultInfo.deployer
    };
    
    if (!vaultsByPair.has(pairKey)) {
      vaultsByPair.set(pairKey, []);
    }
    vaultsByPair.get(pairKey)!.push(vaultData);
  }
  
  // Display grouped vaults
  for (const [pair, vaults] of vaultsByPair) {
    console.log(`\n🪙 ${pair} (${vaults.length} vault${vaults.length > 1 ? 's' : ''}):`);
    
    vaults.forEach((vault, idx) => {
      const isDuplicate = vaults.length > 1;
      console.log(`${isDuplicate ? '  ⚠️ ' : '  '}[${vault.index}] ${vault.address}`);
      console.log(`      Name: ${vault.name}`);
      console.log(`      Symbol: ${vault.symbol}`);
      console.log(`      Owner: ${vault.owner}`);
      console.log(`      Deployment ID: ${vault.deploymentId}`);
    });
  }
  
  // Check for duplicates
  const duplicates = Array.from(vaultsByPair.entries()).filter(([_, vaults]) => vaults.length > 1);
  if (duplicates.length > 0) {
    console.log("\n⚠️  Duplicate token pairs detected!");
    console.log("   Consider removing older vaults from registry");
    console.log("   Run with REGISTRY_ACTION=remove VAULT_ADDRESS=0x... to remove");
  }
}

async function removeVault(registry: any, vaultAddress: string) {
  console.log(`\n🗑️  Removing vault from registry: ${vaultAddress}`);
  
  // Find vault index
  const vaultCount = await registry.getVaultCount();
  let vaultIndex = -1;
  
  for (let i = 0; i < vaultCount; i++) {
    const vaultAddr = await registry.vaultList(i);
    if (vaultAddr.toLowerCase() === vaultAddress.toLowerCase()) {
      vaultIndex = i;
      break;
    }
  }
  
  if (vaultIndex === -1) {
    throw new Error(`Vault not found in registry: ${vaultAddress}`);
  }
  
  // Check if caller is registry owner
  const registryOwner = await registry.owner();
  const [signer] = await ethers.getSigners();
  
  if (registryOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Only registry owner can remove vaults. Owner: ${registryOwner}`);
  }
  
  console.log(`Found vault at index: ${vaultIndex}`);
  console.log("⚠️  WARNING: This will remove the vault from registry (soft delete)");
  console.log("   The vault contract will still exist on-chain");
  console.log("   Users with existing deposits can still withdraw");
  
  // Note: Current registry doesn't have a remove function
  // This would need to be added to the contract
  console.log("\n❌ Current registry contract doesn't support removal");
  console.log("   Options:");
  console.log("   1. Deploy new registry without duplicate");
  console.log("   2. Upgrade registry contract to add removal function");
  console.log("   3. Mark as deprecated in future registry version");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});