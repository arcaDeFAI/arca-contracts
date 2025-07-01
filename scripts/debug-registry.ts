 
import hre from "hardhat";

async function checkRegistry() {
  const registryAddress = "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7";
  const expectedVaultAddress = "0xD8a5a9b31c3C0232E196d518E89Fd8bF83AcAd43";
  
  console.log("🔍 Debugging Registry Contract");
  console.log("Registry address:", registryAddress);
  console.log("Expected vault address:", expectedVaultAddress);
  console.log("");
  
  const registryABI = [
    "function getActiveVaults() external view returns (address[] memory)",
    "function getVaultInfo(address vault) external view returns (tuple(address vault, address rewardClaimer, address queueHandler, address feeManager, address tokenX, address tokenY, string name, string symbol, uint256 deploymentTimestamp, address deployer, bool isActive, bool isProxy))"
  ];
  
  try {
    const registry = await hre.ethers.getContractAt(registryABI, registryAddress);
    
    console.log("✅ Registry contract loaded successfully");
    
    // Check getActiveVaults()
    console.log("\n📋 Calling getActiveVaults()...");
    const activeVaults = await registry.getActiveVaults();
    console.log("Active vaults returned:", activeVaults);
    console.log("Number of vaults:", activeVaults.length);
    
    if (activeVaults.length === 0) {
      console.log("❌ PROBLEM FOUND: Registry returned empty array!");
      console.log("This means no vaults were properly registered with the registry.");
      return;
    }
    
    // Check first vault
    console.log("\n📝 Checking first vault details...");
    const firstVault = activeVaults[0];
    console.log("First vault address:", firstVault);
    
    if (firstVault.toLowerCase() !== expectedVaultAddress.toLowerCase()) {
      console.log("⚠️  Address mismatch detected!");
      console.log("Expected:", expectedVaultAddress);
      console.log("Registry has:", firstVault);
    } else {
      console.log("✅ Vault address matches expected address");
    }
    
    // Get vault info
    console.log("\n📊 Getting vault info...");
    const vaultInfo = await registry.getVaultInfo(firstVault);
    console.log("Vault info:", {
      vault: vaultInfo[0],
      rewardClaimer: vaultInfo[1],
      queueHandler: vaultInfo[2],
      feeManager: vaultInfo[3],
      tokenX: vaultInfo[4],
      tokenY: vaultInfo[5],
      name: vaultInfo[6],
      symbol: vaultInfo[7],
      isActive: vaultInfo[10],
      isProxy: vaultInfo[11]
    });
    
    console.log("\n✅ Registry is working correctly!");
    
  } catch (error) {
    console.error("❌ Error checking registry:", error);
    if (error.message.includes("call revert")) {
      console.log("💡 Registry contract may not be deployed or ABI mismatch");
    }
  }
}

async function main() {
  console.log("🚀 Registry Debug Script");
  console.log("Network:", hre.network.name);
  console.log("");
  
  await checkRegistry();
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});