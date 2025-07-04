import { ethers } from "hardhat";

async function debugPairCreation() {
  console.log("\n🔍 Debugging LB Pair Creation\n");
  
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const test2 = "0xC028d1710449C9b23697CC143aDEA9cf171E4E15";
  
  // Full factory ABI for createLBPair
  const factoryABI = [
    "function createLBPair(address tokenX, address tokenY, uint24 activeId, uint16 binStep) returns (address pair)",
    "function getLBPairInformation(address tokenA, address tokenB, uint16 binStep) view returns (address lbPair)",
    "function setPresetOpenState(uint16 binStep, bool isOpen) external",
    "function setLBPairImplementation(address lbPairImplementation) external",
    "function owner() view returns (address)",
    "event LBPairCreated(address indexed tokenX, address indexed tokenY, uint16 indexed binStep, address lbPair, uint256 pid)"
  ];
  
  const [signer] = await ethers.getSigners();
  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
  
  console.log(`Deployer: ${signer.address}`);
  console.log(`Factory owner: ${await factory.owner()}`);
  console.log(`Is deployer the owner? ${signer.address === await factory.owner()}`);
  
  // Try different activeIds
  const activeIds = [
    8388608,  // Default from config
    8388607,  // One less
    8388609,  // One more
    0,        // Zero
    1 << 23   // Middle of range
  ];
  
  const binSteps = [25, 20, 10, 5, 1];
  
  console.log("\n=== Attempting Pair Creation with Different Parameters ===");
  
  for (const binStep of binSteps) {
    for (const activeId of activeIds) {
      console.log(`\nTrying binStep=${binStep}, activeId=${activeId}:`);
      
      try {
        // First check if pair already exists
        const existingPair = await factory.getLBPairInformation(test1, test2, binStep);
        if (existingPair !== ethers.ZeroAddress) {
          console.log(`  ✅ Pair already exists at: ${existingPair}`);
          continue;
        }
      } catch (e) {
        // Ignore check error
      }
      
      try {
        // Estimate gas first to see if it would succeed
        const gasEstimate = await factory.createLBPair.estimateGas(
          test1,
          test2,
          activeId,
          binStep
        );
        console.log(`  ✅ Gas estimate succeeded: ${gasEstimate.toString()}`);
        
        // If gas estimation succeeded, try the actual transaction
        console.log("  Attempting actual creation...");
        const tx = await factory.createLBPair(
          test1,
          test2,
          activeId,
          binStep,
          { gasLimit: gasEstimate * 120n / 100n } // 20% buffer
        );
        
        console.log(`  ✅ Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        // Find the LBPairCreated event
        const event = receipt.logs.find(log => {
          try {
            return factory.interface.parseLog({
              topics: log.topics,
              data: log.data
            })?.name === "LBPairCreated";
          } catch {
            return false;
          }
        });
        
        if (event) {
          const parsed = factory.interface.parseLog({
            topics: event.topics,
            data: event.data
          });
          console.log(`  ✅ SUCCESS! Pair created at: ${parsed.args.lbPair}`);
          return parsed.args.lbPair;
        }
        
      } catch (error: any) {
        // Parse the error to get more details
        let errorMsg = error.message || String(error);
        
        // Extract revert reason if available
        if (error.data) {
          try {
            const reason = ethers.AbiCoder.defaultAbiCoder().decode(
              ["string"],
              ethers.dataSlice(error.data, 4)
            )[0];
            errorMsg = reason;
          } catch {
            // Try to decode as custom error
            if (error.data.startsWith("0x")) {
              errorMsg = `Custom error: ${error.data.slice(0, 10)}`;
            }
          }
        }
        
        // Check for specific error patterns
        if (errorMsg.includes("BinStep")) {
          console.log(`  ❌ Bin step error: ${errorMsg}`);
        } else if (errorMsg.includes("ActiveId")) {
          console.log(`  ❌ Active ID error: ${errorMsg}`);
        } else if (errorMsg.includes("preset")) {
          console.log(`  ❌ Preset not open: ${errorMsg}`);
        } else if (errorMsg.includes("Ownable")) {
          console.log(`  ❌ Permission denied: ${errorMsg}`);
        } else {
          console.log(`  ❌ Error: ${errorMsg.substring(0, 200)}`);
        }
      }
    }
  }
  
  console.log("\n\n=== Summary ===");
  console.log("If all attempts failed with permission/preset errors, the factory likely:");
  console.log("1. Requires owner permission to create pairs");
  console.log("2. Has all presets closed for public use");
  console.log("3. Needs whitelisting or special access");
  console.log("\nPossible solutions:");
  console.log("1. Contact Metropolis team to open bin step 25 on testnet");
  console.log("2. Deploy a mock LB pair for testing");
  console.log("3. Use the Metropolis UI to create the pair manually");
}

async function main() {
  try {
    await debugPairCreation();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});