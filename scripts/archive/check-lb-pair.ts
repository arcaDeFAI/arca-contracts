import { ethers, network } from "hardhat";

async function main() {
  console.log(`Checking LB Pair on ${network.name}...`);

  // S-USDC pair on mainnet
  const LB_PAIR_ADDRESS = "0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC";
  
  const lbPair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", LB_PAIR_ADDRESS);
  
  console.log("\n=== LB Pair Information ===");
  console.log("Pair address:", LB_PAIR_ADDRESS);
  
  // Get tokens
  const tokenX = await lbPair.getTokenX();
  const tokenY = await lbPair.getTokenY();
  console.log("Token X:", tokenX);
  console.log("Token Y:", tokenY);
  
  // Get token names
  try {
    const tokenXContract = await ethers.getContractAt("IERC20Metadata", tokenX);
    const tokenYContract = await ethers.getContractAt("IERC20Metadata", tokenY);
    
    const tokenXSymbol = await tokenXContract.symbol();
    const tokenYSymbol = await tokenYContract.symbol();
    const tokenXDecimals = await tokenXContract.decimals();
    const tokenYDecimals = await tokenYContract.decimals();
    
    console.log(`Token X: ${tokenXSymbol} (${tokenXDecimals} decimals)`);
    console.log(`Token Y: ${tokenYSymbol} (${tokenYDecimals} decimals)`);
  } catch (error) {
    console.log("Could not fetch token metadata");
  }
  
  // Check oracle parameters
  try {
    const oracleParams = await lbPair.getOracleParameters();
    console.log("\n=== Oracle Parameters ===");
    console.log("Sample Lifetime:", oracleParams[0].toString());
    console.log("Size:", oracleParams[1].toString());
    console.log("Active Size:", oracleParams[2].toString());
    console.log("Last Updated:", oracleParams[3].toString());
    console.log("First Timestamp:", oracleParams[4].toString());
    
    if (oracleParams[1] > 0n) {
      console.log("✅ Oracle is configured!");
    } else {
      console.log("❌ Oracle is NOT configured");
    }
  } catch (error) {
    console.log("❌ Failed to read oracle parameters:", error);
  }
  
  // Get active bin
  try {
    const activeId = await lbPair.getActiveId();
    console.log("\n=== Trading Information ===");
    console.log("Active Bin ID:", activeId.toString());
  } catch (error) {
    console.log("Could not fetch active bin");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });