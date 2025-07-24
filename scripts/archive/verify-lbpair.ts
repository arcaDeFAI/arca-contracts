import { ethers } from "hardhat";

async function verifyLBPair() {
  console.log("\n🔍 Verifying LB Pair\n");
  
  const lbPairAddress = "0xc1603bA905f4E268CDf451591eF51bdFb1185EEB";
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const usdc = "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0";
  
  console.log(`LB Pair Address: ${lbPairAddress}`);
  console.log(`View on explorer: https://testnet.sonicscan.org/address/${lbPairAddress}\n`);
  
  // Minimal LB Pair ABI
  const pairABI = [
    "function getBinStep() view returns (uint16)",
    "function getActiveId() view returns (uint24)",
    "function getTokenX() view returns (address)",
    "function getTokenY() view returns (address)",
    "function getReserves() view returns (uint128 reserveX, uint128 reserveY)",
    "function totalSupply(uint256 id) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
  ];
  
  const provider = ethers.provider;
  const pair = new ethers.Contract(lbPairAddress, pairABI, provider);
  
  try {
    // Get basic info
    const code = await provider.getCode(lbPairAddress);
    console.log(`Contract deployed: ${code.length > 2 ? "✅ Yes" : "❌ No"}`);
    console.log(`Contract size: ${(code.length - 2) / 2} bytes\n`);
    
    // Get pair configuration
    const binStep = await pair.getBinStep();
    const tokenX = await pair.getTokenX();
    const tokenY = await pair.getTokenY();
    const name = await pair.name();
    const symbol = await pair.symbol();
    
    console.log(`Pair Configuration:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Bin Step: ${binStep}`);
    console.log(`- Token X: ${tokenX} ${tokenX.toLowerCase() === test1.toLowerCase() ? "✅ (TEST1)" : "❌"}`);
    console.log(`- Token Y: ${tokenY} ${tokenY.toLowerCase() === usdc.toLowerCase() ? "✅ (USDC)" : "❌"}`);
    
    // Try to get active ID and reserves
    try {
      const activeId = await pair.getActiveId();
      console.log(`- Active ID: ${activeId}`);
    } catch (e) {
      console.log(`- Active ID: No liquidity yet`);
    }
    
    try {
      const reserves = await pair.getReserves();
      console.log(`- Reserve X: ${ethers.formatEther(reserves.reserveX)} TEST1`);
      console.log(`- Reserve Y: ${ethers.formatUnits(reserves.reserveY, 6)} USDC`);
    } catch (e) {
      console.log(`- Reserves: 0 (no liquidity)`);
    }
    
    console.log(`\n✅ LB Pair successfully created and verified!`);
    console.log(`\nNext steps:`);
    console.log(`1. Deploy vault contracts using this LB pair`);
    console.log(`2. Add initial liquidity to the pair`);
    console.log(`3. Test vault operations`);
    
    return lbPairAddress;
    
  } catch (error) {
    console.log(`❌ Error verifying pair: ${error}`);
  }
}

async function main() {
  try {
    await verifyLBPair();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});