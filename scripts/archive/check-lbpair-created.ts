import { ethers } from "hardhat";

async function checkLBPairCreated() {
  console.log("\n🔍 Checking LB Pair Creation\n");
  
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const usdc = "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0";
  
  const factoryABI = [
    "function getLBPairInformation(address tokenA, address tokenB, uint16 binStep) view returns (address lbPair)",
    "event LBPairCreated(address indexed tokenX, address indexed tokenY, uint16 indexed binStep, address lbPair, uint256 pid)"
  ];
  
  const provider = ethers.provider;
  const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
  
  // Check if pair exists now
  try {
    const pairAddress = await factory.getLBPairInformation(test1, usdc, 25);
    console.log(`getLBPairInformation(TEST1, USDC, 25): ${pairAddress}`);
    
    if (pairAddress !== ethers.ZeroAddress) {
      console.log(`\n✅ SUCCESS! LB Pair exists at: ${pairAddress}`);
      console.log(`View on explorer: https://testnet.sonicscan.org/address/${pairAddress}`);
      
      // Verify it's a real contract
      const code = await provider.getCode(pairAddress);
      console.log(`Contract code size: ${code.length} bytes`);
      
      // Get basic pair info
      const pairABI = [
        "function getBinStep() view returns (uint16)",
        "function getTokenX() view returns (address)",
        "function getTokenY() view returns (address)"
      ];
      
      const pair = new ethers.Contract(pairAddress, pairABI, provider);
      
      try {
        const binStep = await pair.getBinStep();
        const tokenX = await pair.getTokenX();
        const tokenY = await pair.getTokenY();
        
        console.log(`\nPair Configuration:`);
        console.log(`- Bin Step: ${binStep}`);
        console.log(`- Token X: ${tokenX}`);
        console.log(`- Token Y: ${tokenY}`);
      } catch (e) {
        console.log("Could not read pair info");
      }
      
      return pairAddress;
    }
  } catch (error) {
    console.log(`Error checking pair: ${error}`);
  }
  
  // Check the transaction receipt
  console.log("\n\nChecking transaction receipt...");
  const txHash = "0xf94ebc1d0a62589d248abfbdf468b646fcec909548f784e2f521e709bf66abf6";
  
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log(`Transaction status: ${receipt.status === 1 ? "Success" : "Failed"}`);
    console.log(`Logs count: ${receipt.logs.length}`);
    
    // Parse logs to find LBPairCreated event
    for (const log of receipt.logs) {
      try {
        const parsed = factory.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsed?.name === "LBPairCreated") {
          console.log(`\n✅ Found LBPairCreated event!`);
          console.log(`- LB Pair: ${parsed.args.lbPair}`);
          console.log(`- Token X: ${parsed.args.tokenX}`);
          console.log(`- Token Y: ${parsed.args.tokenY}`);
          console.log(`- Bin Step: ${parsed.args.binStep}`);
          return parsed.args.lbPair;
        }
      } catch {
        // Not this event
      }
    }
  } catch (error) {
    console.log(`Error getting receipt: ${error}`);
  }
}

async function main() {
  try {
    const pairAddress = await checkLBPairCreated();
    if (pairAddress) {
      console.log(`\n\n🎉 LB Pair successfully created at: ${pairAddress}`);
      console.log("\nNext step: Deploy the vault contracts using this LB pair address");
    }
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});