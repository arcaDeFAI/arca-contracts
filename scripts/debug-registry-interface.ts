 
import hre from "hardhat";

async function debugRegistryInterface() {
  const registryAddress = "0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7";
  
  console.log("🔍 Registry Interface Debug");
  console.log("Registry address:", registryAddress);
  console.log("");
  
  try {
    // Try with minimal ABI first
    const minimalABI = [
      "function getActiveVaults() external view returns (address[] memory)"
    ];
    
    const registry = await hre.ethers.getContractAt(minimalABI, registryAddress);
    
    console.log("✅ Registry contract loaded with minimal ABI");
    
    // Test the exact call that wagmi is making
    console.log("\n📋 Testing getActiveVaults() with minimal ABI...");
    const result = await registry.getActiveVaults();
    console.log("Raw result:", result);
    console.log("Result type:", typeof result);
    console.log("Is array:", Array.isArray(result));
    console.log("Length:", result.length);
    
    if (result.length > 0) {
      console.log("First vault:", result[0]);
    }
    
    // Try calling with ethers directly (raw call)
    console.log("\n🔧 Testing with raw contract call...");
    const provider = hre.ethers.provider;
    const iface = new hre.ethers.Interface(minimalABI);
    const data = iface.encodeFunctionData("getActiveVaults", []);
    
    console.log("Call data:", data);
    
    const rawResult = await provider.call({
      to: registryAddress,
      data: data
    });
    
    console.log("Raw call result:", rawResult);
    
    const decoded = iface.decodeFunctionResult("getActiveVaults", rawResult);
    console.log("Decoded result:", decoded);
    
  } catch (error) {
    console.error("❌ Error testing registry interface:", error);
    console.error("Error message:", error.message);
    
    if (error.message.includes("revert")) {
      console.log("💡 Contract call reverted - possible deployment issue");
    }
  }
}

async function main() {
  console.log("🚀 Registry Interface Debug Script");
  console.log("Network:", hre.network.name);
  console.log("");
  
  await debugRegistryInterface();
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});