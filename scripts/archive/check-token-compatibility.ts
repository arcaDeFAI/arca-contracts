import { ethers } from "hardhat";

async function checkTokenCompatibility() {
  console.log("\n🔍 Checking Token Compatibility for LB Pair Creation\n");
  
  const tokens = [
    { name: "TEST1", address: "0x46e6B680eBae63e086e6D820529Aed187465aeDA" },
    { name: "TEST2", address: "0xC028d1710449C9b23697CC143aDEA9cf171E4E15" }
  ];
  
  // Minimal ERC20 ABI for checking
  const erc20ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ];
  
  const [signer] = await ethers.getSigners();
  console.log(`Using wallet: ${signer.address}\n`);
  
  for (const token of tokens) {
    console.log(`\n=== ${token.name} Token (${token.address}) ===`);
    
    try {
      const contract = new ethers.Contract(token.address, erc20ABI, signer);
      
      // Check all required functions
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      const totalSupply = await contract.totalSupply();
      const balance = await contract.balanceOf(signer.address);
      
      console.log(`✅ name(): "${name}"`);
      console.log(`✅ symbol(): "${symbol}"`);
      console.log(`✅ decimals(): ${decimals}`);
      console.log(`✅ totalSupply(): ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
      console.log(`✅ balanceOf(deployer): ${ethers.formatUnits(balance, decimals)} ${symbol}`);
      
      // Verify the values match expectations
      if (token.name === "TEST1") {
        if (decimals !== 18n) console.log("⚠️  WARNING: Expected 18 decimals");
        if (symbol !== "TEST1") console.log("⚠️  WARNING: Expected symbol TEST1");
      } else if (token.name === "TEST2") {
        if (decimals !== 6n) console.log("⚠️  WARNING: Expected 6 decimals");
        if (symbol !== "TEST2") console.log("⚠️  WARNING: Expected symbol TEST2");
      }
      
    } catch (error) {
      console.log(`❌ Error checking token: ${error}`);
    }
  }
  
  // Also check the LB Factory
  console.log("\n\n=== LB Factory Check ===");
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  const factoryABI = [
    "function getPreset(uint16 binStep) view returns (uint256 baseFactor, uint256 filterPeriod, uint256 decayPeriod, uint256 reductionFactor, uint256 variableFeeControl, uint256 protocolShare, uint256 maxVolatilityAccumulator, bool isOpen)"
  ];
  
  try {
    const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
    const preset = await factory.getPreset(25);
    console.log(`Bin step 25 preset:`, preset);
    console.log(`✅ Bin step 25 is ${preset.isOpen ? "OPEN" : "CLOSED"}`);
    
    if (!preset.isOpen) {
      console.log("\n⚠️  WARNING: Bin step 25 is not open on this factory!");
      console.log("This might be why the LB pair creation is failing.");
      
      // Check some other common bin steps
      console.log("\nChecking other bin steps:");
      for (const binStep of [1, 5, 10, 20, 50, 100]) {
        try {
          const p = await factory.getPreset(binStep);
          if (p.isOpen) {
            console.log(`  ✅ Bin step ${binStep} is OPEN`);
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    
  } catch (error) {
    console.log(`❌ Error checking factory: ${error}`);
  }
}

async function main() {
  try {
    await checkTokenCompatibility();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});