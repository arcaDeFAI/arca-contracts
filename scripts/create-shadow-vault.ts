import { ethers, network } from "hardhat";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

interface MultiDexDeployment {
  network: string;
  timestamp: string;
  deployer: string;
  addresses: {
    vaultFactory: string;
    vaultFactoryImpl: string;
    proxyAdmin: string;
    oracleVaultImpl: string;
    oracleRewardVaultImpl: string;
    strategyImpl: string;
    shadowStrategyImpl: string;
    shadowNPM: string;
    shadowVoter: string;
    wnative: string;
  };
}

interface HybridPriceLensDeployment {
  network: string;
  timestamp: string;
  deployer: string;
  addresses: {
    hybridPriceLens: string;
    wnative: string;
  };
  configuration: unknown;
}

async function main() {
  console.log(`Creating Shadow Oracle Vault on ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // Load deployment addresses from JSON files
  const multiDexPath = path.join(__dirname, "../deployments", `metropolis-${network.name}.json`);
  const priceLensPath = path.join(__dirname, "../deployments", `hybrid-price-lens-${network.name}.json`);

  if (!fs.existsSync(multiDexPath)) {
    console.log("❌ Multi-DEX deployment not found:", multiDexPath);
    console.log("Please run: npx hardhat run scripts/deploy-metropolis.ts --network", network.name);
    return;
  }

  if (!fs.existsSync(priceLensPath)) {
    console.log("❌ HybridPriceLens deployment not found:", priceLensPath);
    console.log("Please run: npx hardhat run scripts/deploy-hybrid-price-lens.ts --network", network.name);
    return;
  }

  const multiDexDeployment: MultiDexDeployment = JSON.parse(fs.readFileSync(multiDexPath, "utf8"));
  const priceLensDeployment: HybridPriceLensDeployment = JSON.parse(fs.readFileSync(priceLensPath, "utf8"));

  const VAULT_FACTORY_ADDRESS = multiDexDeployment.addresses.vaultFactory;
  const PRICE_LENS_ADDRESS = priceLensDeployment.addresses.hybridPriceLens;

  console.log("\n📄 Loaded deployment data:");
  console.log("  Multi-DEX deployed:", multiDexDeployment.timestamp);
  console.log("  PriceLens deployed:", priceLensDeployment.timestamp);
  console.log("  VaultFactory:", VAULT_FACTORY_ADDRESS);
  console.log("  HybridPriceLens:", PRICE_LENS_ADDRESS);
  console.log("  Shadow NPM:", multiDexDeployment.addresses.shadowNPM);
  console.log("  Shadow Voter:", multiDexDeployment.addresses.shadowVoter);
  
  // Check Shadow configuration
  if (multiDexDeployment.addresses.shadowNPM === "0x0000000000000000000000000000000000000000") {
    console.log("\n❌ Shadow NPM not configured!");
    console.log("Please update deploy-metropolis.ts with actual Shadow protocol addresses for", network.name);
    return;
  }

  // TODO: Configure these based on the specific Shadow pool you want to create a vault for
  // Example Shadow pool configuration (replace with actual values)
  const SHADOW_POOL_ADDRESS = "0x..."; // TODO: Replace with actual Shadow V3 pool address
  const TOKEN0_ADDRESS = "0x..."; // TODO: Replace with actual token0 address
  const TOKEN1_ADDRESS = "0x..."; // TODO: Replace with actual token1 address
  
  console.log("\n⚠️  Shadow pool configuration needed!");
  console.log("Please update this script with:");
  console.log("1. SHADOW_POOL_ADDRESS - The Shadow V3 pool you want to create a vault for");
  console.log("2. TOKEN0_ADDRESS - The token0 of the pool");
  console.log("3. TOKEN1_ADDRESS - The token1 of the pool");
  console.log("\nFor now, this script serves as a template.");
  return;

  // Get contracts
  const vaultFactory = await ethers.getContractAt("VaultFactory", VAULT_FACTORY_ADDRESS);

  // Step 1: Create oracle feeds for the tokens
  console.log("\nStep 1: Setting up oracle feeds for tokens...");
  
  // For Shadow vaults, we still need price oracles for the tokens
  // This would typically use OracleLensAggregator wrapping the HybridPriceLens
  console.log("Creating OracleLensAggregator for token0...");
  const OracleLensAggregator = await ethers.getContractFactory("OracleLensAggregator");
  const dataFeed0 = await OracleLensAggregator.deploy(PRICE_LENS_ADDRESS, TOKEN0_ADDRESS);
  await dataFeed0.waitForDeployment();
  console.log("Token0 oracle deployed at:", await dataFeed0.getAddress());

  console.log("Creating OracleLensAggregator for token1...");
  const dataFeed1 = await OracleLensAggregator.deploy(PRICE_LENS_ADDRESS, TOKEN1_ADDRESS);
  await dataFeed1.waitForDeployment();
  console.log("Token1 oracle deployed at:", await dataFeed1.getAddress());

  // Step 2: Create the Shadow vault and strategy
  console.log("\nStep 2: Creating Shadow Oracle Vault and Strategy...");
  
  // For Shadow, we need to create a "fake" LBPair parameter since the factory expects it
  // In practice, we might need to update the factory to support Shadow pools directly
  // For now, we'll use the pool address as the LBPair parameter
  const fakeLBPair = SHADOW_POOL_ADDRESS; // This is a workaround - may need factory update
  
  const heartbeat = 24 * 60 * 60; // 24 hours in seconds
  
  try {
    console.log("\nSubmitting transaction...");
    const tx = await vaultFactory.createOracleVaultAndShadowStrategy(
      fakeLBPair, // Using Shadow pool address as LBPair (workaround)
      await dataFeed0.getAddress(),
      await dataFeed1.getAddress(),
      heartbeat,
      heartbeat
    );
    
    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    
    // Parse events to get the created vault and strategy addresses
    let vaultAddress: string | undefined;
    let strategyAddress: string | undefined;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = vaultFactory.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsedLog?.name === "VaultCreated") {
          vaultAddress = parsedLog.args.vault;
          console.log("\n✅ Vault created at:", vaultAddress);
        } else if (parsedLog?.name === "StrategyCreated") {
          strategyAddress = parsedLog.args.strategy;
          console.log("✅ Shadow strategy created at:", strategyAddress);
        }
      } catch {
        // Ignore logs that can't be parsed
      }
    }
    
    if (vaultAddress && strategyAddress) {
      console.log("\n📝 Shadow Vault Creation Summary:");
      console.log("===================================");
      console.log("Network:", network.name);
      console.log("Vault Address:", vaultAddress);
      console.log("Strategy Address:", strategyAddress);
      console.log("Shadow Pool:", SHADOW_POOL_ADDRESS);
      console.log("Token0:", TOKEN0_ADDRESS);
      console.log("Token1:", TOKEN1_ADDRESS);
      console.log("===================================");
      
      console.log("\n📝 Next steps:");
      console.log("1. Configure the vault parameters as needed");
      console.log("2. Set up operator permissions if required");
      console.log("3. Initialize the Shadow position with desired tick range");
      console.log("4. Start accepting deposits!");
      
      // Save deployment info
      const shadowVaultDeployment = {
        network: network.name,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        vault: vaultAddress,
        strategy: strategyAddress,
        shadowPool: SHADOW_POOL_ADDRESS,
        token0: TOKEN0_ADDRESS,
        token1: TOKEN1_ADDRESS,
        oracles: {
          dataFeed0: await dataFeed0.getAddress(),
          dataFeed1: await dataFeed1.getAddress()
        }
      };
      
      const deploymentPath = `./deployments/shadow-vault-${network.name}-${Date.now()}.json`;
      fs.writeFileSync(deploymentPath, JSON.stringify(shadowVaultDeployment, null, 2));
      console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
    }
    
  } catch (error) {
    console.log("\n❌ Failed to create Shadow vault!");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Error:", errorMessage);
    
    // Try to decode the error
    if (error && typeof error === 'object' && 'data' in error) {
      try {
        const decodedError = vaultFactory.interface.parseError(error.data);
        console.log("Decoded error:", decodedError);
      } catch {
        console.log("Could not decode error data");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });