/* eslint-disable no-console */
import hre from "hardhat";

async function main() {
  console.log("🍴 Deploying to Sonic mainnet fork...\n");
  
  // Ensure we're on fork
  if (hre.network.name !== "sonic-fork") {
    throw new Error(`This script is for sonic-fork only. Current network: ${hre.network.name}`);
  }
  
  // Verify we're on the fork (which uses local chain ID 31337 but forks mainnet)
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    throw new Error(`Expected fork chain ID 31337, got ${network.chainId}`);
  }
  
  console.log("✅ Connected to Sonic mainnet fork");
  console.log("🔗 Chain ID:", network.chainId.toString());
  
  // Get current block to verify fork is working
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("📦 Current block:", blockNumber);
  
  // Import required functions
  const { deployArcaSystem } = await import("./deployArcaSystem");
  const { loadNetworkConfig, networkConfigToDeploymentConfig } = await import("./utils/network-config");
  
  console.log("\n📋 Loading sonic-mainnet configuration...");
  const networkConfig = loadNetworkConfig("sonic-mainnet");
  const deploymentConfig = networkConfigToDeploymentConfig(networkConfig);
  
  console.log("📋 Configuration loaded:");
  console.log("  TokenX (wS):", deploymentConfig.tokenX);
  console.log("  TokenY (USDC.e):", deploymentConfig.tokenY);
  console.log("  LB Router:", deploymentConfig.lbRouter);
  console.log("  Pool:", deploymentConfig.lbpContract);
  console.log("  Rewarder:", deploymentConfig.rewarder);
  console.log("  METRO Token:", deploymentConfig.rewardToken);
  
  // Helper function to safely get token symbol
  async function getTokenInfo(address: string, name: string): Promise<void> {
    try {
      const contract = await hre.ethers.getContractAt("IERC20", address);
      const totalSupply = await contract.totalSupply();
      console.log(`✅ ${name} exists - Total supply: ${hre.ethers.formatEther(totalSupply)}`);
      
      // Try to get symbol if available
      try {
        const symbolInterface = new hre.ethers.Interface(["function symbol() view returns (string)"]);
        const symbolResult = await hre.ethers.provider.call({
          to: address,
          data: symbolInterface.encodeFunctionData("symbol", [])
        });
        const symbol = symbolInterface.decodeFunctionResult("symbol", symbolResult)[0];
        console.log(`   Symbol: ${symbol}`);
      } catch {
        console.log(`   Symbol: N/A (not implemented)`);
      }
    } catch (error) {
      console.error(`❌ Error verifying ${name}:`, error);
      throw error;
    }
  }

  // Verify token contracts exist (simplified to avoid hardfork issues)
  console.log("\n🔍 Verifying token contracts exist...");
  
  try {
    // Simple contract existence check using getCode
    const tokenXCode = await hre.ethers.provider.getCode(deploymentConfig.tokenX);
    const tokenYCode = await hre.ethers.provider.getCode(deploymentConfig.tokenY);
    const metroCode = await hre.ethers.provider.getCode(deploymentConfig.rewardToken);
    
    if (tokenXCode === "0x") throw new Error("TokenX contract not found");
    if (tokenYCode === "0x") throw new Error("TokenY contract not found");
    if (metroCode === "0x") throw new Error("METRO contract not found");
    
    console.log("✅ TokenX (wS) contract exists");
    console.log("✅ TokenY (USDC.e) contract exists");
    console.log("✅ METRO token contract exists");
    
    // TODO: Use getTokenInfo() once hardfork issues are resolved
    // await getTokenInfo(deploymentConfig.tokenX, "TokenX (wS)");
    // await getTokenInfo(deploymentConfig.tokenY, "TokenY (USDC.e)");
    // await getTokenInfo(deploymentConfig.rewardToken, "METRO token");
    
  } catch (error) {
    console.error("❌ Error verifying token contracts:", error);
    throw error;
  }
  
  // Deploy Arca system
  console.log("\n🚀 Deploying Arca system...");
  const addresses = await deployArcaSystem(deploymentConfig);
  
  console.log("\n✅ Fork deployment completed successfully!");
  console.log("\n📋 Deployment addresses:", JSON.stringify(addresses, null, 2));
  
  // Basic functionality test
  console.log("\n🧪 Running basic functionality test...");
  
  try {
    const vault = await hre.ethers.getContractAt("ArcaTestnetV1", addresses.vault);
    
    // Test basic reads
    const tokenBalanceX = await vault.tokenBalance(0);
    const tokenBalanceY = await vault.tokenBalance(1);
    const pricePerShareX = await vault.getPricePerFullShare(0);
    const pricePerShareY = await vault.getPricePerFullShare(1);
    
    console.log("✅ Vault token balance X:", tokenBalanceX.toString());
    console.log("✅ Vault token balance Y:", tokenBalanceY.toString());
    console.log("✅ Price per share X:", pricePerShareX.toString());
    console.log("✅ Price per share Y:", pricePerShareY.toString());
    
    // Test reward claimer
    const rewardClaimer = await hre.ethers.getContractAt("ArcaRewardClaimerV1", addresses.rewardClaimer);
    const compoundedX = await rewardClaimer.getTotalCompounded(0);
    const compoundedY = await rewardClaimer.getTotalCompounded(1);
    
    console.log("✅ Total compounded X:", compoundedX.toString());
    console.log("✅ Total compounded Y:", compoundedY.toString());
    
    console.log("\n🎉 All basic functionality tests passed!");
    
  } catch (error) {
    console.error("❌ Functionality test failed:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});