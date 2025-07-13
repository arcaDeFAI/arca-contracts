import { ethers, network } from "hardhat";

// Oracle types enum matching contract
enum OracleType {
  None = 0,
  Chainlink = 1,
  Pyth = 2
}

interface TokenConfig {
  address: string;
  oracle?: {
    type: OracleType;
    feed: string;
    maxStaleness?: number;
  };
  lbPair?: {
    address: string;
    referenceToken?: string;
    isTokenX: boolean;
  };
}

interface NetworkConfig {
  wnative: string;
  tokens: { [key: string]: TokenConfig };
  referenceTokens: string[];
}

async function main() {
  console.log(`Deploying HybridPriceLens to ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Network-specific configuration
  const config: { [key: string]: NetworkConfig } = {
    "sonic-testnet": {
      wnative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
      referenceTokens: [
        "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0", // USDC (actual address from pair)
        "0xed06734629e22277D395d8EB8b67Cc75c27Cb6A2"  // WETH
      ],
      tokens: {
        usdc: {
          address: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0", // Actual USDC address from the LB Pair
          // No external oracle on testnet, use LB Pair
          lbPair: {
            address: "0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995", // wS-USDC pair
            isTokenX: false // USDC is tokenY in this pair
          }
        },
        weth: {
          address: "0xed06734629e22277D395d8EB8b67Cc75c27Cb6A2",
          // Direct pair with wS
          lbPair: {
            address: "0x5A2251254224Eb5eA9b459c6922C887e3E4054F7", // WETH-wS pair
            isTokenX: true // Need to verify if WETH is tokenX
          }
        },
        // Add more tokens as they become available
        // Example with external oracle (when available):
        // weth: {
        //   address: "0x...",
        //   oracle: {
        //     type: OracleType.Chainlink,
        //     feed: "0x...", // Chainlink WETH/USD feed
        //     maxStaleness: 3600
        //   }
        // }
      }
    },
    "sonic-mainnet": {
      wnative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
      referenceTokens: [
        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894"  // USDC on mainnet
      ],
      tokens: {
        usdc: {
          address: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC on Sonic mainnet
          // For now use LB Pair pricing, add Chainlink oracle when available
          lbPair: {
            address: "0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC", // S-USDC pair
            isTokenX: false // Need to verify, but USDC is usually tokenY
          }
        }
        // Add more tokens as needed
      }
    },
    "localhost": {
      wnative: "0x0000000000000000000000000000000000000000", // Will be set from mock deployment
      referenceTokens: [],
      tokens: {}
    }
  };

  const networkConfig = config[network.name];
  if (!networkConfig) {
    throw new Error(`Network ${network.name} not configured`);
  }

  // Pre-deployment check: Verify LB Pair configurations
  console.log("\n=== Pre-deployment LB Pair Verification ===");
  for (const [tokenName, tokenConfig] of Object.entries(networkConfig.tokens)) {
    if (tokenConfig.lbPair) {
      console.log(`\nChecking ${tokenName} pair configuration...`);
      try {
        const pair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", tokenConfig.lbPair.address);
        const tokenX = await pair.getTokenX();
        const tokenY = await pair.getTokenY();
        
        console.log(`  Pair address: ${tokenConfig.lbPair.address}`);
        console.log(`  Token X: ${tokenX}`);
        console.log(`  Token Y: ${tokenY}`);
        console.log(`  Expected ${tokenName}: ${tokenConfig.address}`);
        
        // Check if token is in the pair
        const isTokenX = tokenX.toLowerCase() === tokenConfig.address.toLowerCase();
        const isTokenY = tokenY.toLowerCase() === tokenConfig.address.toLowerCase();
        
        if (!isTokenX && !isTokenY) {
          console.error(`  ❌ ERROR: ${tokenName} not found in pair!`);
          throw new Error(`Token ${tokenName} not found in its configured pair`);
        }
        
        console.log(`  ✓ ${tokenName} is Token${isTokenX ? 'X' : 'Y'} (configured as Token${tokenConfig.lbPair.isTokenX ? 'X' : 'Y'})`);
        
        if (isTokenX !== tokenConfig.lbPair.isTokenX) {
          console.error(`  ⚠️  WARNING: Configuration mismatch! ${tokenName} is actually Token${isTokenX ? 'X' : 'Y'}`);
          console.log(`  📝 Update the config to: isTokenX: ${isTokenX}`);
        }
        
        // Check reference token or native pairing
        if (tokenConfig.lbPair.referenceToken) {
          const otherToken = isTokenX ? tokenY : tokenX;
          if (otherToken.toLowerCase() !== tokenConfig.lbPair.referenceToken.toLowerCase()) {
            console.error(`  ❌ ERROR: Reference token mismatch!`);
            console.error(`  Expected: ${tokenConfig.lbPair.referenceToken}`);
            console.error(`  Actual: ${otherToken}`);
          }
        } else {
          // Should be paired with native
          const otherToken = isTokenX ? tokenY : tokenX;
          if (otherToken.toLowerCase() !== networkConfig.wnative.toLowerCase()) {
            console.error(`  ❌ ERROR: Expected native token pairing!`);
            console.error(`  Expected: ${networkConfig.wnative}`);
            console.error(`  Actual: ${otherToken}`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Failed to check pair:`, error);
      }
    }
  }
  
  console.log("\n=== End of Pre-deployment Check ===\n");
  
  // Ask for confirmation
  console.log("Do you want to continue with deployment? (Ctrl+C to abort)");

  // Deploy HybridPriceLens
  console.log("Deploying HybridPriceLens...");
  const HybridPriceLens = await ethers.getContractFactory("HybridPriceLens");
  const priceLens = await HybridPriceLens.deploy(networkConfig.wnative);
  await priceLens.waitForDeployment();
  const priceLensAddress = await priceLens.getAddress();
  console.log("HybridPriceLens deployed at:", priceLensAddress);

  // Set reference tokens
  console.log("\nConfiguring reference tokens...");
  for (const refToken of networkConfig.referenceTokens) {
    const tx = await priceLens.setReferenceToken(refToken, true);
    await tx.wait();
    console.log(`✓ Set ${refToken} as reference token`);
  }

  // Configure token price feeds
  console.log("\nConfiguring token price feeds...");
  for (const [tokenName, tokenConfig] of Object.entries(networkConfig.tokens)) {
    console.log(`\nConfiguring ${tokenName}...`);
    
    if (tokenConfig.oracle) {
      // External oracle configuration
      try {
        const tx = await priceLens.setExternalOracle(
          tokenConfig.address,
          tokenConfig.oracle.feed,
          tokenConfig.oracle.type,
          tokenConfig.oracle.maxStaleness || 0
        );
        await tx.wait();
        console.log(`✓ Configured external ${OracleType[tokenConfig.oracle.type]} oracle`);
      } catch (error) {
        console.error(`✗ Failed to configure external oracle for ${tokenName}:`, error);
        throw error;
      }
    } else if (tokenConfig.lbPair) {
      // LB Pair configuration
      try {
        console.log(`  Token address: ${tokenConfig.address}`);
        console.log(`  LB Pair address: ${tokenConfig.lbPair.address}`);
        console.log(`  Reference token: ${tokenConfig.lbPair.referenceToken || ethers.ZeroAddress}`);
        console.log(`  Is Token X: ${tokenConfig.lbPair.isTokenX}`);
        
        const tx = await priceLens.setLBPairRoute(
          tokenConfig.address,
          tokenConfig.lbPair.address,
          tokenConfig.lbPair.referenceToken || ethers.ZeroAddress,
          tokenConfig.lbPair.isTokenX
        );
        await tx.wait();
        console.log(`✓ Configured LB Pair route${tokenConfig.lbPair.referenceToken ? ' via reference token' : ' (direct)'}`);
      } catch (error) {
        console.error(`✗ Failed to configure LB Pair for ${tokenName}:`, error);
        
        // Try to get more info about the pair
        try {
          const pair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", tokenConfig.lbPair.address);
          const tokenX = await pair.getTokenX();
          const tokenY = await pair.getTokenY();
          console.log(`  Actual pair tokenX: ${tokenX}`);
          console.log(`  Actual pair tokenY: ${tokenY}`);
        } catch (e) {
          console.log("  Could not fetch pair details");
        }
        
        throw error;
      }
    }
  }

  // Test price feeds
  console.log("\n\nTesting price feeds...");
  
  // Test native token
  try {
    const wsPrice = await priceLens.getTokenPriceNative(networkConfig.wnative);
    console.log("wS price in wS:", ethers.formatEther(wsPrice), "(should be 1.0)");
  } catch (error: unknown) {
    console.log("wS price test failed:", error);
  }

  // Test configured tokens
  for (const [tokenName, tokenConfig] of Object.entries(networkConfig.tokens)) {
    try {
      const price = await priceLens.getTokenPriceNative(tokenConfig.address);
      console.log(`${tokenName} price in wS:`, ethers.formatEther(price));
      
      // Show feed type
      const feed = await priceLens.getPriceFeed(tokenConfig.address);
      console.log(`  Source: ${feed.useExternal ? 'External Oracle' : 'LB Pair'}`);
      if (!feed.useExternal && feed.referenceToken !== ethers.ZeroAddress) {
        console.log(`  Via reference token: ${feed.referenceToken}`);
      }
    } catch (error: unknown) {
      console.log(`${tokenName} price test failed:`, error);
    }
  }

  // Verify LB Pair details
  console.log("\nVerifying LB Pair configurations...");
  
  // Verify USDC pair
  if (networkConfig.tokens.usdc?.lbPair) {
    console.log("\n--- wS-USDC Pair ---");
    const usdcPair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", networkConfig.tokens.usdc.lbPair.address);
    const usdcTokenX = await usdcPair.getTokenX();
    const usdcTokenY = await usdcPair.getTokenY();
    console.log("Pair tokenX:", usdcTokenX);
    console.log("Pair tokenY:", usdcTokenY);
    console.log("Expected wS:", networkConfig.wnative);
    console.log("Expected USDC:", networkConfig.tokens.usdc.address);
  }
  
  // Verify WETH pair
  if (networkConfig.tokens.weth?.lbPair) {
    console.log("\n--- WETH-wS Pair ---");
    const wethPair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", networkConfig.tokens.weth.lbPair.address);
    const wethTokenX = await wethPair.getTokenX();
    const wethTokenY = await wethPair.getTokenY();
    console.log("Pair tokenX:", wethTokenX);
    console.log("Pair tokenY:", wethTokenY);
    console.log("Expected WETH:", networkConfig.tokens.weth.address);
    console.log("Expected wS:", networkConfig.wnative);
  }

  console.log("\n✅ Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Verify the token positions (X/Y) in your LB Pairs");
  console.log("2. Call setPriceLens on VaultFactory:");
  console.log(`   await vaultFactory.setPriceLens("${priceLensAddress}")`);
  console.log("3. Whitelist your LB Pairs:");
  console.log(`   await vaultFactory.setPairWhitelist(["0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995"], true)`);
  console.log("4. Create your market maker vault");

  // Save deployment
  const deployment = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    addresses: {
      hybridPriceLens: priceLensAddress,
      wnative: networkConfig.wnative,
    },
    configuration: {
      referenceTokens: networkConfig.referenceTokens,
      tokens: networkConfig.tokens
    }
  };

  const fs = await import("fs");
  const deploymentPath = `./deployments/hybrid-price-lens-${network.name}.json`;
  await fs.promises.mkdir("./deployments", { recursive: true });
  await fs.promises.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });