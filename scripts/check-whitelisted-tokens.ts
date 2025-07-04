import { ethers } from "hardhat";

async function checkWhitelistedTokens() {
  console.log("\n🔍 Checking Whitelisted Quote Assets\n");
  
  const factoryAddress = "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7";
  
  // Factory ABI with whitelist functions
  const factoryABI = [
    "function isQuoteAsset(address token) view returns (bool)",
    "function getQuoteAssets() view returns (address[])",
    "function getQuoteAssetWhitelisted(address token) view returns (bool)"
  ];
  
  const [signer] = await ethers.getSigners();
  const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
  
  // Our tokens
  const test1 = "0x46e6B680eBae63e086e6D820529Aed187465aeDA";
  const test2 = "0xC028d1710449C9b23697CC143aDEA9cf171E4E15";
  
  // Known testnet tokens
  const knownTokens = [
    { symbol: "S", address: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38" },
    { symbol: "USDC", address: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0" },
    { symbol: "METRO", address: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321" },
    { symbol: "TEST1", address: test1 },
    { symbol: "TEST2", address: test2 }
  ];
  
  console.log("=== Checking Token Whitelist Status ===");
  
  // Try different function names
  for (const token of knownTokens) {
    console.log(`\n${token.symbol} (${token.address}):`);
    
    try {
      const isQuote = await factory.isQuoteAsset(token.address);
      console.log(`  isQuoteAsset: ${isQuote}`);
    } catch (e) {
      // Try alternative function
      try {
        const isWhitelisted = await factory.getQuoteAssetWhitelisted(token.address);
        console.log(`  getQuoteAssetWhitelisted: ${isWhitelisted}`);
      } catch (e2) {
        console.log(`  Could not check whitelist status`);
      }
    }
  }
  
  // Try to get list of all quote assets
  console.log("\n\n=== Getting All Quote Assets ===");
  try {
    const quoteAssets = await factory.getQuoteAssets();
    console.log("Whitelisted quote assets:");
    for (const asset of quoteAssets) {
      console.log(`  - ${asset}`);
    }
  } catch (e) {
    console.log("Could not get quote assets list");
  }
  
  console.log("\n\n=== Solution Options ===");
  console.log("Since TEST2 is not whitelisted as a quote asset, we can:");
  console.log("\n1. **Use USDC as tokenY instead of TEST2**");
  console.log("   - Create TEST1-USDC pair instead");
  console.log("   - USDC is likely whitelisted");
  
  console.log("\n2. **Deploy a Mock LB Pair**");
  console.log("   - Skip the factory and deploy our own mock");
  console.log("   - Good for testing vault functionality");
  
  console.log("\n3. **Contact Metropolis Team**");
  console.log("   - Ask them to whitelist TEST2 on testnet");
  console.log("   - Or ask for testnet factory permissions");
  
  console.log("\n4. **Use Different Token Order**");
  console.log("   - Try TEST2-TEST1 instead of TEST1-TEST2");
  console.log("   - Sometimes only certain tokens work as tokenX");
}

async function main() {
  try {
    await checkWhitelistedTokens();
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});