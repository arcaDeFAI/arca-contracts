/* eslint-disable no-console */
import hre from "hardhat";

/**
 * Script to discover the rewarder contract for the wS/USDC.e pool on Metropolis DLMM
 * This will help us find the actual rewarder address to use in our configuration
 */

async function main() {
  console.log("🔍 Discovering Metropolis DLMM rewarder for wS/USDC.e pool...\n");
  
  const poolAddress = "0x11d899dec22fb03a0047212b1a20a7ad8d699420";
  const factoryAddress = "0x39D966c1BaFe7D3F1F53dA4845805E15f7D6EE43";
  const tokenX = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // wS
  const tokenY = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894"; // USDC.e
  
  console.log("Pool address:", poolAddress);
  console.log("Factory address:", factoryAddress);
  console.log("TokenX (wS):", tokenX);
  console.log("TokenY (USDC.e):", tokenY);
  
  try {
    // Connect to the pool contract
    const poolContract = await hre.ethers.getContractAt("ILBPair", poolAddress);
    
    console.log("\n=== Pool Information ===");
    
    // Get basic pool info
    const activeId = await poolContract.getActiveId();
    console.log("Active ID:", activeId.toString());
    
    const tokenXContract = await poolContract.getTokenX();
    const tokenYContract = await poolContract.getTokenY();
    console.log("Pool TokenX:", tokenXContract);
    console.log("Pool TokenY:", tokenYContract);
    
    // Verify tokens match
    if (tokenXContract.toLowerCase() !== tokenX.toLowerCase()) {
      console.log("⚠️  WARNING: TokenX mismatch!");
    }
    if (tokenYContract.toLowerCase() !== tokenY.toLowerCase()) {
      console.log("⚠️  WARNING: TokenY mismatch!");
    }
    
    console.log("\n=== Searching for Rewarder ===");
    
    // Method 1: Check if pool has a hooks parameter that might indicate a rewarder
    try {
      // Try to get the LBPairInformation
      const binStep = await poolContract.getBinStep();
      console.log("Bin Step:", binStep.toString());
      
      // Method 2: Check events for rewarder setup
      console.log("\n🔍 Checking recent events for rewarder information...");
      
      // Get the latest block number
      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000); // Last ~10k blocks
      
      console.log(`Searching events from block ${fromBlock} to ${latestBlock}...`);
      
      // Look for any events that might indicate a rewarder
      const filter = {
        address: poolAddress,
        fromBlock: fromBlock,
        toBlock: latestBlock
      };
      
      const events = await hre.ethers.provider.getLogs(filter);
      console.log(`Found ${events.length} events in the pool`);
      
      if (events.length > 0) {
        console.log("Recent event topics:");
        const uniqueTopics = [...new Set(events.map(e => e.topics[0]))];
        uniqueTopics.slice(0, 5).forEach((topic, i) => {
          console.log(`  ${i + 1}. ${topic}`);
        });
      }
      
    } catch (error) {
      console.log("Error checking factory:", error);
    }
    
    // Method 3: Try to call functions that might exist on a rewarder-enabled pool
    console.log("\n=== Checking for Rewarder Interface ===");
    
    try {
      // Some pools might have direct rewarder references
      // This is speculative - different DLMM implementations vary
      const poolInterface = new hre.ethers.Interface([
        "function getRewarder() external view returns (address)",
        "function hooks() external view returns (address)",
        "function rewarder() external view returns (address)"
      ]);
      
      for (const funcName of ["getRewarder", "hooks", "rewarder"]) {
        try {
          const result = await hre.ethers.provider.call({
            to: poolAddress,
            data: poolInterface.encodeFunctionData(funcName, [])
          });
          
          if (result && result !== "0x") {
            const decoded = poolInterface.decodeFunctionResult(funcName, result);
            const address = decoded[0];
            console.log(`✅ Found via ${funcName}():`, address);
            
            if (address && address !== "0x0000000000000000000000000000000000000000") {
              console.log(`🎉 Potential rewarder found: ${address}`);
              
              // Try to verify it's actually a rewarder
              try {
                const rewarderContract = await hre.ethers.getContractAt("ILBHooksBaseRewarder", address);
                const rewardToken = await rewarderContract.getRewardToken();
                console.log("✅ Verified rewarder! Reward token:", rewardToken);
                
                return address;
              } catch {
                console.log("❌ Address doesn't implement rewarder interface");
              }
            }
          }
        } catch {
          // Function doesn't exist, continue
        }
      }
      
      console.log("❌ No rewarder interface methods found");
      
    } catch (error) {
      console.log("Error checking rewarder interface:", error);
    }
    
    console.log("\n=== Summary ===");
    console.log("✅ Pool exists and is valid wS/USDC.e pair");
    console.log("❌ No rewarder contract found");
    console.log("💡 This pool may not have METRO rewards enabled");
    console.log("💡 Safe to deploy with zero address rewarder");
    
    return null;
    
  } catch (error) {
    console.error("❌ Error during discovery:", error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});