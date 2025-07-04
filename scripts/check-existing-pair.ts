import { ethers } from "hardhat";

async function checkExistingPair() {
  console.log("\n🔍 Checking Existing S-USDC Pair Configuration\n");
  
  const pairAddress = "0xf931d5d6a019961096aaf4749e05d123e1b38a55";
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  
  // Minimal LBPair ABI
  const pairABI = [
    "function getBinStep() view returns (uint16)",
    "function getActiveId() view returns (uint24)",
    "function getTokenX() view returns (address)",
    "function getTokenY() view returns (address)",
    "function getReserves() view returns (uint128 reserveX, uint128 reserveY)"
  ];
  
  // Factory ABI with different function signatures to try
  const factoryABI = [
    "function getPreset(uint16 binStep) view returns (uint256 baseFactor, uint256 filterPeriod, uint256 decayPeriod, uint256 reductionFactor, uint256 variableFeeControl, uint256 protocolShare, uint256 maxVolatilityAccumulator, bool isOpen)",
    "function getLBPairInformation(address tokenA, address tokenB, uint16 binStep) view returns (address lbPair)",
    "function getPresetOpenState(uint16 binStep) view returns (bool)",
    "function isPresetOpen(uint16 binStep) view returns (bool)",
    "function owner() view returns (address)"
  ];
  
  const [signer] = await ethers.getSigners();
  
  // Check the existing pair
  console.log("=== Existing S-USDC Pair ===");
  try {
    const pair = new ethers.Contract(pairAddress, pairABI, signer);
    
    const binStep = await pair.getBinStep();
    const activeId = await pair.getActiveId();
    const tokenX = await pair.getTokenX();
    const tokenY = await pair.getTokenY();
    const reserves = await pair.getReserves();
    
    console.log(`Pair Address: ${pairAddress}`);
    console.log(`Bin Step: ${binStep}`);
    console.log(`Active ID: ${activeId}`);
    console.log(`Token X: ${tokenX}`);
    console.log(`Token Y: ${tokenY}`);
    console.log(`Reserves X: ${ethers.formatEther(reserves.reserveX)}`);
    console.log(`Reserves Y: ${ethers.formatUnits(reserves.reserveY, 6)}`); // USDC has 6 decimals
    
  } catch (error) {
    console.log(`Error checking pair: ${error}`);
  }
  
  // Try different ways to check if bin step 25 is open
  console.log("\n\n=== Checking Factory Configuration ===");
  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
  
  // Check factory owner
  try {
    const owner = await factory.owner();
    console.log(`Factory owner: ${owner}`);
  } catch (e) {
    console.log("Could not get factory owner");
  }
  
  // Try different function names for checking if preset is open
  console.log("\nTrying different methods to check if bin step 25 is open:");
  
  try {
    const isOpen = await factory.getPresetOpenState(25);
    console.log(`getPresetOpenState(25): ${isOpen}`);
  } catch (e) {
    console.log("getPresetOpenState() not available");
  }
  
  try {
    const isOpen = await factory.isPresetOpen(25);
    console.log(`isPresetOpen(25): ${isOpen}`);
  } catch (e) {
    console.log("isPresetOpen() not available");
  }
  
  // Let's try to get the pair information for our tokens
  console.log("\n\n=== Checking if we can query pair information ===");
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const test2 = "0xC028d1710449C9b23697CC143aDEA9cf171E4E15";
  
  try {
    const pairInfo = await factory.getLBPairInformation(test1, test2, 25);
    console.log(`getLBPairInformation(TEST1, TEST2, 25): ${pairInfo}`);
    if (pairInfo === ethers.ZeroAddress) {
      console.log("No pair exists yet (expected)");
    }
  } catch (error) {
    console.log(`Error getting pair info: ${error}`);
  }
  
  // Try with tokens in reverse order
  try {
    const pairInfo = await factory.getLBPairInformation(test2, test1, 25);
    console.log(`getLBPairInformation(TEST2, TEST1, 25): ${pairInfo}`);
  } catch (error) {
    console.log(`Error getting pair info (reversed): ${error}`);
  }
}

async function main() {
  try {
    await checkExistingPair();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});