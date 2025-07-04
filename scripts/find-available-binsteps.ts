import { ethers } from "hardhat";

async function findAvailableBinSteps() {
  console.log("\n🔍 Finding Available Bin Steps on LB Factory\n");
  
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  const factoryABI = [
    "function getPreset(uint16 binStep) view returns (uint256 baseFactor, uint256 filterPeriod, uint256 decayPeriod, uint256 reductionFactor, uint256 variableFeeControl, uint256 protocolShare, uint256 maxVolatilityAccumulator, bool isOpen)",
    "function getAllBinSteps() view returns (uint256[] memory binStepWithPreset)",
    "function getAvailableLBPairBinSteps(address tokenA, address tokenB) view returns (uint256[] memory binStepWithPreset)"
  ];
  
  const [signer] = await ethers.getSigners();
  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
  
  // Try to get all bin steps
  try {
    console.log("Trying getAllBinSteps()...");
    const allBinSteps = await factory.getAllBinSteps();
    console.log("Available bin steps:", allBinSteps);
    
    // Decode the bin steps (they're encoded with additional data)
    if (allBinSteps && allBinSteps.length > 0) {
      console.log("\nDecoded bin steps:");
      for (const encoded of allBinSteps) {
        const binStep = Number(encoded) & 0xFFFF; // Lower 16 bits
        console.log(`  - Bin step: ${binStep}`);
      }
    }
  } catch (error) {
    console.log("getAllBinSteps() not available or failed");
  }
  
  // Try checking common bin steps one by one
  console.log("\nChecking common bin steps individually:");
  const commonBinSteps = [1, 2, 5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 200];
  const availableBinSteps = [];
  
  for (const binStep of commonBinSteps) {
    try {
      const preset = await factory.getPreset(binStep);
      if (preset.isOpen) {
        availableBinSteps.push(binStep);
        console.log(`  ✅ Bin step ${binStep} is OPEN`);
      } else {
        console.log(`  ❌ Bin step ${binStep} is CLOSED`);
      }
    } catch (error) {
      // This bin step doesn't exist
      console.log(`  ⚠️  Bin step ${binStep} not configured`);
    }
  }
  
  if (availableBinSteps.length > 0) {
    console.log(`\n✅ Available bin steps: ${availableBinSteps.join(", ")}`);
    console.log("\nRecommendation: Use one of these bin steps instead of 25");
    
    // Suggest the closest one to 25
    const closest = availableBinSteps.reduce((prev, curr) => 
      Math.abs(curr - 25) < Math.abs(prev - 25) ? curr : prev
    );
    console.log(`Closest to 25: ${closest}`);
  } else {
    console.log("\n❌ No open bin steps found!");
  }
  
  // Also check for existing pairs with our tokens
  console.log("\n\nChecking for existing LB pairs with TEST1/TEST2:");
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const test2 = "0xC028d1710449C9b23697CC143aDEA9cf171E4E15";
  
  try {
    const availableForPair = await factory.getAvailableLBPairBinSteps(test1, test2);
    if (availableForPair && availableForPair.length > 0) {
      console.log("Existing pairs found!");
      for (const encoded of availableForPair) {
        const binStep = Number(encoded) & 0xFFFF;
        console.log(`  - Existing pair with bin step: ${binStep}`);
      }
    } else {
      console.log("No existing pairs found (expected for new tokens)");
    }
  } catch (error) {
    console.log("getAvailableLBPairBinSteps() not available");
  }
}

async function main() {
  try {
    await findAvailableBinSteps();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});