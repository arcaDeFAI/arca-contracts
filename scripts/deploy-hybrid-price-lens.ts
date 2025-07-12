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
        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894" // USDC
      ],
      tokens: {
        usdc: {
          address: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
          // No external oracle on testnet, use LB Pair
          lbPair: {
            address: "0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995", // wS-USDC pair
            isTokenX: false // Assuming USDC is tokenY in the pair
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
      wnative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      referenceTokens: [],
      tokens: {}
      // TODO: Add mainnet configuration with real oracle feeds
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
      const tx = await priceLens.setExternalOracle(
        tokenConfig.address,
        tokenConfig.oracle.feed,
        tokenConfig.oracle.type,
        tokenConfig.oracle.maxStaleness || 0
      );
      await tx.wait();
      console.log(`✓ Configured external ${OracleType[tokenConfig.oracle.type]} oracle`);
    } else if (tokenConfig.lbPair) {
      // LB Pair configuration
      const tx = await priceLens.setLBPairRoute(
        tokenConfig.address,
        tokenConfig.lbPair.address,
        tokenConfig.lbPair.referenceToken || ethers.ZeroAddress,
        tokenConfig.lbPair.isTokenX
      );
      await tx.wait();
      console.log(`✓ Configured LB Pair route${tokenConfig.lbPair.referenceToken ? ' via reference token' : ' (direct)'}`);
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

  // Verify LB Pair details for USDC
  if (networkConfig.tokens.usdc?.lbPair) {
    console.log("\nVerifying wS-USDC pair configuration...");
    const pair = await ethers.getContractAt("ILBPair", networkConfig.tokens.usdc.lbPair.address);
    const tokenX = await pair.getTokenX();
    const tokenY = await pair.getTokenY();
    console.log("Pair tokenX:", tokenX);
    console.log("Pair tokenY:", tokenY);
    console.log("wS address:", networkConfig.wnative);
    console.log("USDC address:", networkConfig.tokens.usdc.address);
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