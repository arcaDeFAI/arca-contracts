import { ethers } from "hardhat";

async function main() {
  // Get the deployed HybridPriceLens address from command line or use a default
  const priceLensAddress = process.env.PRICE_LENS_ADDRESS;
  
  if (!priceLensAddress) {
    console.error("Please provide PRICE_LENS_ADDRESS environment variable");
    console.error("Usage: PRICE_LENS_ADDRESS=0x... npx hardhat run scripts/test-hybrid-price-lens.ts --network sonic-testnet");
    process.exit(1);
  }

  console.log("Testing HybridPriceLens at:", priceLensAddress);
  
  const priceLens = await ethers.getContractAt("HybridPriceLens", priceLensAddress);
  
  // Test addresses (Sonic testnet)
  const wS = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";
  const USDC = "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0"; // Actual USDC from wS-USDC pair
  const WETH = "0xed06734629e22277D395d8EB8b67Cc75c27Cb6A2";
  
  console.log("\n--- Price Feed Tests ---");
  
  // Test native token
  try {
    const wsPrice = await priceLens.getTokenPriceNative(wS);
    console.log("✓ wS price in wS:", ethers.formatEther(wsPrice), "wS");
    if (ethers.formatEther(wsPrice) !== "1.0") {
      console.error("  ⚠️  Warning: wS price should be exactly 1.0");
    }
  } catch (error) {
    console.error("✗ Failed to get wS price:");
    if (error instanceof Error) {
      console.error("  Error:", error.message);
    } else {
      console.error("  Error:", String(error));
    }
  }
  
  // Test USDC
  try {
    const usdcPrice = await priceLens.getTokenPriceNative(USDC);
    console.log("✓ USDC price in wS:", ethers.formatEther(usdcPrice), "wS");
    
    // Get feed configuration
    const usdcFeed = await priceLens.getPriceFeed(USDC);
    console.log("  Source:", usdcFeed.useExternal ? "External Oracle" : "LB Pair");
    if (!usdcFeed.useExternal) {
      console.log("  LB Pair:", usdcFeed.lbPair);
      console.log("  Is Token X:", usdcFeed.isTokenX);
      console.log("  Reference Token:", usdcFeed.referenceToken === ethers.ZeroAddress ? "Direct wS pair" : usdcFeed.referenceToken);
    }
  } catch (error) {
    console.error("✗ Failed to get USDC price:");
    if (error instanceof Error) {
      console.error("  Error:", error.message);
      if ('reason' in error) {
        console.error("  Reason:", error.reason);
      }
    } else {
      console.error("  Error:", String(error));
    }
  }
  
  // Test WETH
  try {
    const wethPrice = await priceLens.getTokenPriceNative(WETH);
    console.log("✓ WETH price in wS:", ethers.formatEther(wethPrice), "wS");
    
    // Get feed configuration
    const wethFeed = await priceLens.getPriceFeed(WETH);
    console.log("  Source:", wethFeed.useExternal ? "External Oracle" : "LB Pair");
    if (!wethFeed.useExternal) {
      console.log("  LB Pair:", wethFeed.lbPair);
      console.log("  Is Token X:", wethFeed.isTokenX);
      console.log("  Reference Token:", wethFeed.referenceToken === ethers.ZeroAddress ? "Direct wS pair" : wethFeed.referenceToken);
    }
  } catch (error) {
    console.error("✗ Failed to get WETH price:");
    if (error instanceof Error) {
      console.error("  Error:", error.message);
      if ('reason' in error) {
        console.error("  Reason:", error.reason);
      }
    } else {
      console.error("  Error:", String(error));
    }
  }
  
  // Check reference token status
  console.log("\n--- Reference Token Status ---");
  const isUSDCReference = await priceLens.isReferenceToken(USDC);
  console.log("USDC is reference token:", isUSDCReference);
  const isWETHReference = await priceLens.isReferenceToken(WETH);
  console.log("WETH is reference token:", isWETHReference);
  
  // Check staleness settings
  const defaultStaleness = await priceLens.defaultMaxStaleness();
  console.log("\n--- Oracle Settings ---");
  console.log("Default max staleness:", defaultStaleness.toString(), "seconds (", Number(defaultStaleness) / 3600, "hours)");

  // Test price bounds
  console.log("\n--- Price Bounds Check ---");
  try {
    const usdcPrice = await priceLens.getTokenPriceNative(USDC);
    const priceNumber = Number(ethers.formatEther(usdcPrice));
    
    if (priceNumber < 0.000001) {
      console.error("⚠️  Warning: USDC price is below minimum threshold (0.000001 wS)");
    } else if (priceNumber > 1000000000000) {
      console.error("⚠️  Warning: USDC price is above maximum threshold (1e12 wS)");
    } else {
      console.log("✓ USDC price is within reasonable bounds");
    }
    
    // Sanity check for stablecoin
    if (priceNumber < 0.1 || priceNumber > 10) {
      console.error("⚠️  Warning: USDC price seems unusual for a stablecoin");
      console.error("  Expected range: 0.1 - 10 wS, Got:", priceNumber.toFixed(6), "wS");
    }
  } catch (error) {
    console.error("✗ Price bounds check failed");
  }

  console.log("\n--- Summary ---");
  console.log("HybridPriceLens is deployed and configured for basic operation.");
  console.log("\nNext steps:");
  console.log("1. Verify the USDC price looks reasonable");
  console.log("2. Set this PriceLens on your VaultFactory");
  console.log("3. Create your market maker oracle vault");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });