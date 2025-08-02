import { ethers, network } from "hardhat";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

interface MetropolisDeployment {
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
  console.log(`Creating Market Maker Oracle Vault on ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);

  // Load deployment addresses from JSON files
  const metropolisPath = path.join(__dirname, "../deployments", `metropolis-${network.name}.json`);
  const priceLensPath = path.join(__dirname, "../deployments", `hybrid-price-lens-${network.name}.json`);

  if (!fs.existsSync(metropolisPath)) {
    console.log("❌ Metropolis deployment not found:", metropolisPath);
    console.log("Please run: npx hardhat run scripts/deploy-multi-dex.ts --network!", network.name);
    return;
  }

  if (!fs.existsSync(priceLensPath)) {
    console.log("❌ HybridPriceLens deployment not found:", priceLensPath);
    console.log("Please run: npx hardhat run scripts/deploy-hybrid-price-lens.ts --network", network.name);
    return;
  }

  const metropolisDeployment: MetropolisDeployment = JSON.parse(fs.readFileSync(metropolisPath, "utf8"));
  const priceLensDeployment: HybridPriceLensDeployment = JSON.parse(fs.readFileSync(priceLensPath, "utf8"));

  const VAULT_FACTORY_ADDRESS = metropolisDeployment.addresses.vaultFactory;
  const PRICE_LENS_ADDRESS = priceLensDeployment.addresses.hybridPriceLens;

  console.log("\n📄 Loaded deployment data:");
  console.log("  Metropolis deployed:", metropolisDeployment.timestamp);
  console.log("  PriceLens deployed:", priceLensDeployment.timestamp);
  console.log("  VaultFactory:", VAULT_FACTORY_ADDRESS);
  console.log("  HybridPriceLens:", PRICE_LENS_ADDRESS);
  
  // Mainnet LB Pair and tokens
  const LB_PAIR_ADDRESS = "0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC"; // S-USDC pair on mainnet
  const S_ADDRESS = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // S token (native wrapped)
  const USDC_ADDRESS = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894"; // USDC on mainnet
  
  const AUM_FEE = 1000; // 10% (in basis points * 100, max is 3000 = 30%)

  // Get contracts
  console.log("\n📋 Loading contracts...");
  const vaultFactory = await ethers.getContractAt("VaultFactory", VAULT_FACTORY_ADDRESS);
  console.log("VaultFactory loaded at:", await vaultFactory.getAddress());
  const priceLens = await ethers.getContractAt("HybridPriceLens", PRICE_LENS_ADDRESS);
  console.log("PriceLens loaded at:", await priceLens.getAddress());
  
  // Debug: Check if priceLens is already set
  try {
    const currentPriceLens = await vaultFactory.getPriceLens();
    console.log("Current PriceLens in VaultFactory:", currentPriceLens);
  } catch (e) {
    console.log("Could not get current PriceLens:", e.message);
  }

  // Step 1: Verify LB Pair configuration
  console.log("\nStep 1: Verifying LB Pair configuration...");
  const lbPair = await ethers.getContractAt("joe-v2/interfaces/ILBPair.sol:ILBPair", LB_PAIR_ADDRESS);
  
  const tokenX = await lbPair.getTokenX();
  const tokenY = await lbPair.getTokenY();
  console.log("Token X:", tokenX);
  console.log("Token Y:", tokenY);
  
  // Verify it's the S-USDC pair
  const isCorrectPair = 
    (tokenX.toLowerCase() === S_ADDRESS.toLowerCase() && tokenY.toLowerCase() === USDC_ADDRESS.toLowerCase()) ||
    (tokenX.toLowerCase() === USDC_ADDRESS.toLowerCase() && tokenY.toLowerCase() === S_ADDRESS.toLowerCase());
    
  if (!isCorrectPair) {
    console.log("❌ Unexpected token pair! Please verify the LB Pair address.");
    return;
  }
  
  // Check oracle
  const oracleParams = await lbPair.getOracleParameters();
  console.log("Oracle size:", oracleParams[1].toString());
  
  if (oracleParams[1] === 0n) {
    console.log("❌ LB Pair has no oracle data!");
    return;
  }
  console.log("✅ Oracle is configured");

  // Step 2: Set PriceLens on VaultFactory
  console.log("\nStep 2: Setting PriceLens on VaultFactory...");
  try {
    // First verify PriceLens is working
    const usdcPrice = await priceLens.getTokenPriceNative(USDC_ADDRESS);
    console.log("USDC price in S:", ethers.formatEther(usdcPrice));
    const sPrice = await priceLens.getTokenPriceNative(S_ADDRESS);
    console.log("S price in S:", ethers.formatEther(sPrice), "(should be 1.0)");
    
    // Set the PriceLens on VaultFactory
    console.log("Setting PriceLens on VaultFactory...");
    const setPriceLensTx = await vaultFactory.setPriceLens(PRICE_LENS_ADDRESS);
    await setPriceLensTx.wait();
    console.log("✅ PriceLens set on VaultFactory");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Ownable")) {
      console.log("❌ Only owner can set PriceLens. Are you using the correct account?");
      return;
    }
    console.log("✅ PriceLens might already be configured or error occurred:", errorMessage);
  }

  // Step 3: Whitelist the pair
  console.log("\nStep 3: Checking pair whitelist...");
  const isWhitelisted = await vaultFactory.isPairWhitelisted(LB_PAIR_ADDRESS);
  
  if (!isWhitelisted) {
    console.log("Whitelisting pair...");
    try {
      const whitelistTx = await vaultFactory.setPairWhitelist([LB_PAIR_ADDRESS], true);
      await whitelistTx.wait();
      console.log("✅ Pair whitelisted");
    } catch (error) {
      console.log("❌ Failed to whitelist pair. Only owner can whitelist.");
      return;
    }
  } else {
    console.log("✅ Pair already whitelisted");
  }

  // Step 4: Check creation fee
  console.log("\nStep 4: Checking creation fee...");
  const creationFee = await vaultFactory.getCreationFee();
  console.log("Creation fee:", ethers.formatEther(creationFee), "S");

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);

  // Step 5: Final safety checks and confirmation
  console.log("\nStep 5: Final Safety Checks...");
  
  // Check if vault already exists for this pair and operator
  console.log("\nChecking existing vaults...");
  const existingVaults = await vaultFactory.getVaultsByMarketMaker(deployer.address);
  console.log("You have", existingVaults.length, "existing vaults");
  
  if (existingVaults.length > 0) {
    console.log("Your existing vaults:");
    for (const vault of existingVaults) {
      console.log(" -", vault);
    }
  }
  
  // Display all parameters clearly
  console.log("\n=== VAULT CREATION PARAMETERS ===");
  console.log("Network:         ", network.name);
  console.log("Deployer:        ", deployer.address);
  console.log("LB Pair:         ", LB_PAIR_ADDRESS);
  console.log("Token Pair:      ", "S-USDC");
  console.log("AUM Fee:         ", AUM_FEE / 100, "%");
  console.log("Creation Fee:    ", ethers.formatEther(creationFee), "S");
  console.log("Your Balance:    ", ethers.formatEther(balance), "S");
  console.log("================================");
  
  // Check balance
  if (balance < creationFee) {
    console.log("\n❌ Insufficient balance for creation fee!");
    return;
  }
  
  // Cost warning
  if (creationFee > ethers.parseEther("0.1")) {
    console.log("\n⚠️  WARNING: Creation fee is greater than 0.1 S!");
  }
  
  // Final confirmation
  console.log("\n⚠️  IMPORTANT: Vault creation is IRREVERSIBLE!");
  console.log("Once created:");
  console.log("- The vault contract is permanently deployed");
  console.log("- The creation fee is non-refundable");
  console.log("- You will be the operator of this vault");
  console.log("- The vault will be linked to your address as market maker");
  
  console.log("\n🤔 Do you want to proceed with vault creation?");
  console.log("   Type 'yes' to continue or Ctrl+C to cancel");
  
  // Wait for user confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
  
  if (answer.toLowerCase() !== 'yes') {
    console.log("\n❌ Vault creation cancelled");
    return;
  }
  
  // Step 6: Create the vault
  console.log("\nStep 6: Creating Market Maker Oracle Vault...");
  
  try {
    console.log("\nSubmitting transaction...");
    const tx = await vaultFactory.createMarketMakerOracleVault(
      LB_PAIR_ADDRESS,
      AUM_FEE,
      { value: creationFee, gasLimit: 10000000 }
    );
    
    console.log("Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    
    // Parse events to get the created vault address
    const vaultCreatedEvent = receipt.logs.find(
      (log) => {
        try {
          const parsedLog = vaultFactory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsedLog?.name === "VaultCreated";
        } catch {
          return false;
        }
      }
    );
    
    if (vaultCreatedEvent) {
      const parsedEvent = vaultFactory.interface.parseLog({
        topics: vaultCreatedEvent.topics,
        data: vaultCreatedEvent.data
      });
      
      if (parsedEvent) {
        console.log("\n✅ Vault created successfully!");
        console.log("Vault address:", parsedEvent.args.vault);
        console.log("Vault type:", parsedEvent.args.vType);
        
        // Save vault address
        console.log("\n📝 Next steps:");
        console.log("1. Save the vault address:", parsedEvent.args.vault);
        console.log("2. Verify the vault on Sonicscan");
        console.log("3. Configure vault settings as needed");
        console.log("4. Start accepting deposits!");
      }
    } else {
      console.log("\n✅ Transaction successful! Check Sonicscan for vault address.");
    }
    
  } catch (error) {
    console.log("\n❌ Failed to create vault!");
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Error:", errorMessage);
    
    // Try to decode the error
    if (error && typeof error === 'object' && 'data' in error) {
      try {
        const decodedError = vaultFactory.interface.parseError(error.data);
        console.log("Decoded error:", decodedError);
      } catch {
        console.log("Could not decode error data");
        console.log(error);
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