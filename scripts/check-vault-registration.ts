import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`\n🔍 Checking vault registration on ${network.name} (chainId: ${network.chainId})`);

  // Get deployment info
  const deployment = require(`../deployments/${network.name}/latest.json`);
  const registryAddress = deployment.contracts.registry;
  const vaultAddress = deployment.contracts.vault;

  console.log(`Registry: ${registryAddress}`);
  console.log(`Vault: ${vaultAddress}`);

  // Load registry contract
  const registry = await ethers.getContractAt("ArcaVaultRegistry", registryAddress);

  // Check if vault is registered
  console.log("\n📋 Checking registration...");
  try {
    const vaultInfo = await registry.getVaultInfo(vaultAddress);
    console.log("✅ Vault is registered!");
    console.log(`  Name: ${vaultInfo.name}`);
    console.log(`  Symbol: ${vaultInfo.symbol}`);
    console.log(`  TokenX: ${vaultInfo.tokenX}`);
    console.log(`  TokenY: ${vaultInfo.tokenY}`);
    console.log(`  Active: ${vaultInfo.isActive}`);
  } catch (error) {
    console.log("❌ Vault not registered in registry");
    console.log("\n🔧 Registering vault...");
    
    // Register the vault
    const tx = await registry.registerVault(vaultAddress);
    console.log(`Transaction: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Vault registered successfully!");
  }

  // Check active vaults
  console.log("\n📊 Active vaults:");
  const activeVaults = await registry.getActiveVaults();
  console.log(`Total active vaults: ${activeVaults.length}`);
  activeVaults.forEach((vault, index) => {
    console.log(`  ${index + 1}. ${vault}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });