import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface HybridPriceLensDeployment {
  network: string;
  timestamp: string;
  deployer: string;
  addresses: {
    hybridPriceLens: string;
    wnative: string;
  };
  configuration: {
    referenceTokens: string[];
    tokens: { [key: string]: { address: string; lbPair?: { address: string; isTokenX: boolean } } };
  };
}

async function main() {
  console.log(`Testing HybridPriceLens on ${network.name}...`);
  
  // Load deployment addresses from JSON file
  const deploymentPath = path.join(__dirname, "../deployments", `hybrid-price-lens-${network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ HybridPriceLens deployment not found:", deploymentPath);
    console.error("Please run: npx hardhat run scripts/deploy-hybrid-price-lens.ts --network", network.name);
    process.exit(1);
  }

  const deployment: HybridPriceLensDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const priceLensAddress = deployment.addresses.hybridPriceLens;
  
  console.log("\n📄 Loaded deployment data:");
  console.log("  Deployed:", deployment.timestamp);
  console.log("  PriceLens:", priceLensAddress);
  console.log("  Network:", deployment.network);
  
  const priceLens = await ethers.getContractAt("HybridPriceLens", priceLensAddress);
  
  // Get addresses from deployment configuration
  const wS = deployment.addresses.wnative;
  
  // Network-specific token addresses
  const tokens: { [network: string]: { [token: string]: string } } = {
    "sonic-testnet": {
      USDC: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
      WETH: "0xed06734629e22277D395d8EB8b67Cc75c27Cb6A2"
    },
    "sonic-mainnet": {
      USDC: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      // Add more mainnet tokens as needed
    }
  };
  
  const networkTokens = tokens[network.name] || {};
  const USDC = networkTokens.USDC;
  const WETH = networkTokens.WETH;
  
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
  
  // Test configured tokens from deployment
  const tokensToTest = [
    ...(USDC ? [{ name: "USDC", address: USDC }] : []),
    ...(WETH ? [{ name: "WETH", address: WETH }] : [])
  ];
  
  for (const token of tokensToTest) {
    console.log(`\n--- Testing ${token.name} ---`);
    try {
      const tokenPrice = await priceLens.getTokenPriceNative(token.address);
      console.log(`✓ ${token.name} price in wS:`, ethers.formatEther(tokenPrice), "wS");
      
      // Get feed configuration
      const tokenFeed = await priceLens.getPriceFeed(token.address);
      console.log("  Source:", tokenFeed.useExternal ? "External Oracle" : "LB Pair");
      if (!tokenFeed.useExternal) {
        console.log("  LB Pair:", tokenFeed.lbPair);
        console.log("  Is Token X:", tokenFeed.isTokenX);
        console.log("  Reference Token:", tokenFeed.referenceToken === ethers.ZeroAddress ? "Direct wS pair" : tokenFeed.referenceToken);
      }
      
      // Sanity check for stablecoins
      if (token.name === "USDC") {
        const priceNumber = Number(ethers.formatEther(tokenPrice));
        if (priceNumber < 0.1 || priceNumber > 10) {
          console.error("  ⚠️  Warning: USDC price seems unusual for a stablecoin");
          console.error("    Expected range: 0.1 - 10 wS, Got:", priceNumber.toFixed(6), "wS");
        } else {
          console.log("  ✓ Price is within reasonable bounds for a stablecoin");
        }
      }
      
    } catch (error) {
      console.error(`✗ Failed to get ${token.name} price:`);
      if (error instanceof Error) {
        console.error("  Error:", error.message);
        if ('reason' in error) {
          console.error("  Reason:", error.reason);
        }
      } else {
        console.error("  Error:", String(error));
      }
    }
  }
  
  // Check reference token status
  console.log("\n--- Reference Token Status ---");
  for (const token of tokensToTest) {
    const isReference = await priceLens.isReferenceToken(token.address);
    console.log(`${token.name} is reference token:`, isReference);
  }
  
  // Check staleness settings
  const defaultStaleness = await priceLens.defaultMaxStaleness();
  console.log("\n--- Oracle Settings ---");
  console.log("Default max staleness:", defaultStaleness.toString(), "seconds (", Number(defaultStaleness) / 3600, "hours)");

  // Test price bounds
  console.log("\n--- Price Bounds Check ---");
  const usdcToken = tokensToTest.find(t => t.name === "USDC");
  if (usdcToken) {
    try {
      const usdcPrice = await priceLens.getTokenPriceNative(usdcToken.address);
      const priceNumber = Number(ethers.formatEther(usdcPrice));
      
      if (priceNumber < 0.000001) {
        console.error("⚠️  Warning: USDC price is below minimum threshold (0.000001 wS)");
      } else if (priceNumber > 1000000000000) {
        console.error("⚠️  Warning: USDC price is above maximum threshold (1e12 wS)");
      } else {
        console.log("✓ USDC price is within reasonable bounds");
      }
    } catch (error) {
      console.error("✗ Price bounds check failed");
    }
  } else {
    console.log("ℹ️  No USDC configured for price bounds check");
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