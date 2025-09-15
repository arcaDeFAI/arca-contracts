import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as readline from "readline";
import type { BaseContract, Contract, ContractFactory, ContractTransactionResponse, TransactionReceipt, TransactionResponse } from "ethers";
import type { 
  VaultFactory, 
  ShadowStrategy, 
  IOracleRewardShadowVault 
} from "../typechain-types";

// ================================
// Gas Tracking Utility
// ================================
interface GasTransaction {
  name: string;
  gasUsed: bigint;
  gasPrice: bigint;
  cost: bigint;
  category: "deployment" | "configuration" | "migration";
}

const replacer = (key: unknown, value: unknown) => {
  if (typeof value === 'bigint') {
    return value.toString(); // Convert BigInt to string
  }
  return value;
}

class GasTracker {
  private transactions: GasTransaction[] = [];
  
  async trackDeployment(name: string, contract: Contract | BaseContract & { deploymentTransaction(): ContractTransactionResponse; } & Omit<BaseContract, keyof BaseContract>): Promise<void> {
    const deployTx = contract.deploymentTransaction();
    if (!deployTx) {
      console.warn(`⚠️  No deployment transaction found for ${name}`);
      return;
    }
    
    const receipt = await deployTx.wait();
    if (!receipt) {
      throw new Error(`Failed to get receipt for deployment: ${name}`);
    }
    
    this.addTransaction(name, receipt, "deployment");
  }
  
  async trackTransaction(name: string, txResponse: TransactionResponse, category: "configuration" | "migration" = "configuration"): Promise<TransactionReceipt> {
    const receipt = await txResponse.wait();
    if (!receipt) {
      throw new Error(`Failed to get receipt for transaction: ${name}`);
    }
    
    this.addTransaction(name, receipt, category);
    return receipt;
  }
  
  private addTransaction(name: string, receipt: TransactionReceipt, category: "deployment" | "configuration" | "migration") {
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice || 0n;
    const cost = gasUsed * gasPrice;
    
    this.transactions.push({
      name,
      gasUsed,
      gasPrice,
      cost,
      category
    });
    
    console.log(`  ⛽ Gas used: ${gasUsed.toString()}, Cost: ${ethers.formatEther(cost)} S`);
  }
  
  getReport() {
    const totalGas = this.transactions.reduce((sum, tx) => sum + tx.gasUsed, 0n);
    const totalCost = this.transactions.reduce((sum, tx) => sum + tx.cost, 0n);
    
    console.log("\n💰 TOTAL DEPLOYMENT SUMMARY");
    console.log("=".repeat(90));
    console.log(`Total Gas Used: ${totalGas.toLocaleString()}`);
    console.log(`Total Cost: ${ethers.formatEther(totalCost)} S`);
    
    if (this.transactions.length > 0 && this.transactions[0].gasPrice > 0n) {
      const avgGasPrice = this.transactions.reduce((sum, tx) => sum + tx.gasPrice, 0n) / BigInt(this.transactions.length);
      console.log(`Average Gas Price: ${ethers.formatUnits(avgGasPrice, "gwei")} Gwei`);
    }
    
    console.log("=".repeat(90));
    
    return {
      totalGas,
      totalCost,
      totalCostInS: ethers.formatEther(totalCost),
      transactionCount: this.transactions.length
    };
  }
}

// ================================
// Helper Functions
// ================================
async function deployContract<T extends Contract>(
  displayName: string,
  factory: ContractFactory,
  args: unknown[],
  gasTracker: GasTracker
): Promise<T> {
  console.log(`\nDeploying ${displayName}...`);
  
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✓ ${displayName} deployed at: ${address}`);
  
  await gasTracker.trackDeployment(displayName, contract);
  
  return contract as T;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptConfirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function getTokenSymbol(tokenAddress: string): Promise<string> {
  // Minimal ABI
  const ERC20_ABI = [
    "function symbol() view returns (string)"
  ];

  // Get provider (Hardhat default network or specify one in hardhat.config.js)
  const provider = ethers.provider;

  // Create contract instance
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // Call symbol
  const symbol = await tokenContract.symbol();
  return symbol;
}

// ================================
// Load Deployment Configuration
// ================================
interface DeploymentConfig {
  vaultFactory: string;
  shadowStrategyImpl?: string;
  shadowNPM?: string;
  maxRange?: number;
}

async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Run multi-dex deployment first.`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  return {
    vaultFactory: deployment.addresses.vaultFactory,
    shadowStrategyImpl: deployment.addresses.shadowStrategyImpl,
    shadowNPM: deployment.addresses.shadowNPM,
    maxRange: deployment.configuration?.shadowMaxRange || 887272
  };
}

// ================================
// Get Shadow Vaults
// ================================
async function getShadowVaults(factory: VaultFactory): Promise<{ address: string; name: string; pool: string }[]> {
  const vaults: { address: string; name: string; pool: string }[] = [];
  
  // VaultType.ShadowOracleReward = 4
  const VAULT_TYPE_SHADOW_ORACLE_REWARD = 4;
  
  try {
    const numVaults = await factory.getNumberOfVaults(VAULT_TYPE_SHADOW_ORACLE_REWARD);
    console.log(`\nFound ${numVaults} Shadow vaults in factory`);
    
    for (let i = 0; i < numVaults; i++) {
      const vaultAddress = await factory.getVaultAt(VAULT_TYPE_SHADOW_ORACLE_REWARD, i);
      const vault = await ethers.getContractAt("IOracleRewardShadowVault", vaultAddress);
      
      try {
        const tokenX = await getTokenSymbol(await vault.getTokenX());
        const tokenY = await getTokenSymbol(await vault.getTokenY());
        const pool = await vault.getPool();
        vaults.push({
          address: vaultAddress,
          name: `${tokenX}-${tokenY}`,
          pool: pool
        });
      } catch (error) {
        console.warn(`⚠️  Could not get details for vault ${vaultAddress}`);
      }
    }
  } catch (error) {
    console.log("No Shadow vaults found or error accessing factory");
  }
  
  return vaults;
}

// ================================
// Main Deployment Function  
// ================================
async function main() {
  console.log("\n🚀 Shadow Strategy Deployment Script");
  console.log("=====================================");
  console.log(`Network: ${network.name}`);
  
  const gasTracker = new GasTracker();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Load configuration
  const config = await loadDeploymentConfig();
  console.log("\n📋 Configuration loaded:");
  console.log("  VaultFactory:", config.vaultFactory);
  console.log("  Current ShadowStrategy Implementation:", config.shadowStrategyImpl);
  
  // Get VaultFactory instance
  const factory = await ethers.getContractAt("VaultFactory", config.vaultFactory) as VaultFactory;
  
  // Check if deployer is factory owner
  const factoryOwner = await factory.owner();
  const isOwner = factoryOwner.toLowerCase() === deployer.address.toLowerCase();
  
  if (!isOwner) {
    console.log("\n⚠️  WARNING: You are not the factory owner");
    console.log("  Factory owner:", factoryOwner);
    console.log("  Your address:", deployer.address);
    console.log("\n  You can deploy a new implementation but cannot:");
    console.log("  - Update the factory's strategy implementation");
    console.log("  - Call setStrategy on vaults");
  }
  
  // ================================
  // Step 1: Deploy New Implementation
  // ================================
  const deployNewImpl = await promptConfirm("\n📦 Deploy new ShadowStrategy implementation?");
  
  let newImplementation: string = config.shadowStrategyImpl || "";
  
  if (deployNewImpl) {
    const maxRange = config.maxRange || 887272;
    console.log(`\nDeploying with maxRange: ${maxRange}`);
    
    const ShadowStrategyFactory = await ethers.getContractFactory("ShadowStrategy");
    const shadowArgs = [config.vaultFactory, maxRange]
    const shadowStrategyImpl = await deployContract(
      "ShadowStrategy Implementation",
      ShadowStrategyFactory,
      shadowArgs,
      gasTracker
    );

    // Sleep a few seconds after deployment... to make sure it gets confirmed
    console.log("Waiting for deployment to propagate...");
    await new Promise(f => setTimeout(f, 6000));

    // Verify the contract with Sonic Explorer
    newImplementation = await shadowStrategyImpl.getAddress();
    let successMessage = false

    try {
          await run("verify:verify", {
                address: newImplementation,
                constructorArguments: shadowArgs,
                contract: "contracts-shadow/src/ShadowStrategy.sol:ShadowStrategy",
                force: true, // Force verification even if already verified
              });
              successMessage = true;
    } catch (error) {
      successMessage = false;
      const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (errorMessage.includes("already verified") || 
          errorMessage.includes("already been verified")) {
        console.log(`✅ Shadow Strategy Implementation is already verified`);
      } else {
        throw error;
      }
    }
    
    if (successMessage) {
      console.log(`✅ Shadow Strategy Implementation verified successfully!`);
    }

    // Update factory if we're the owner
    if (isOwner) {
      const updateFactory = await promptConfirm("\n🔧 Update factory's ShadowStrategy implementation?");
      
      if (updateFactory) {
        const STRATEGY_TYPE_SHADOW = 2;
        console.log(`\nUpdating factory strategy implementation (type ${STRATEGY_TYPE_SHADOW})...`);
        
        const tx = await factory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, newImplementation);
        await gasTracker.trackTransaction("Update factory strategy implementation", tx);
        
        const confirmationOfSetOperation = (await factory.getStrategyImplementation(STRATEGY_TYPE_SHADOW)) === newImplementation

        if (confirmationOfSetOperation) {
          console.log("✅ Factory updated with new implementation [CONFIRMED]");
        } else {
          console.log("❌ Factory failed to be updated with new strategy implementation!");
          return;
        }
      }
    }
  }
  
  // ================================
  // Step 2: Update Vault Strategy
  // ================================
  const updateVault = await promptConfirm("\n🔄 Update a vault to use new strategy?");
  
  if (updateVault) {
    if (!isOwner) {
      console.log("\n❌ Cannot update vault strategy - you are not the factory owner");
      console.log("Please run this script with the factory owner account");
    } else {
      // Get list of Shadow vaults
      const vaults = await getShadowVaults(factory);
      
      if (vaults.length === 0) {
        console.log(`\n❌ No Shadow vaults found for this factory: ${await factory.getAddress()}`);
      } else {
        console.log("\n📋 Available Shadow Vaults:");
        vaults.forEach((v, i) => {
          console.log(`  ${i + 1}. ${v.name}`);
          console.log(`     Address: ${v.address}`);
          console.log(`     Pool: ${v.pool}`);
        });
        
        const selection = await prompt("\nEnter vault number to update (or 0 to skip): ");
        const vaultIndex = parseInt(selection) - 1;
        
        if (vaultIndex >= 0 && vaultIndex < vaults.length) {
          const selectedVault = vaults[vaultIndex];
          console.log(`\n✅ Selected: ${selectedVault.name}`);
          
          // Get vault instance
          const vault = await ethers.getContractAt("IOracleRewardShadowVault", selectedVault.address) as IOracleRewardShadowVault;
          
          // Get current strategy
          const currentStrategy = await vault.getStrategy();
          console.log("Current strategy of vault:", currentStrategy);
          
          if (currentStrategy === ethers.ZeroAddress) {
            console.log("⚠️  Vault has no strategy (might be in emergency mode)");
          }
          
          // Deploy new strategy clone for this vault
          console.log("\n🔨 Deploying new strategy for this vault...");
          
          // Get vault details
          const tokenX = await vault.getTokenX();
          const tokenY = await vault.getTokenY();
          
          // Since we need to deploy through factory mechanisms, we'll need to call createAndLinkShadowStrategy
          // Internally, within the factory, this will call ImmutableClone.cloneDeterministic
          console.log("\nCalling createAndLinkShadowStrategy(...) on the Vault Factory...");

          const tx = await factory.createAndLinkShadowStrategy(selectedVault.address, selectedVault.pool, tokenX, tokenY)
          await gasTracker.trackTransaction("Update factory strategy implementation", tx);
          const finalResult = await tx.wait();

          // if (finalResult) {
          //   console.log("\nEvents:\n")
          //   console.log(JSON.stringify(finalResult?.logs, replacer))
          //   console.log("\n");
          // }

          if (finalResult && finalResult.status === 1) {
            console.log(`\n✅ Success executing createAndLinkShadowStrategy!}`);
          } else {
            console.log(`\n❌ There was an error with createAndLinkShadowStrategy: ${JSON.stringify(finalResult, replacer) ?? JSON.stringify(tx, replacer)}`);
          }

          const latestVaultStrategy = await vault.getStrategy();
          console.log("Latest strategy of vault:", latestVaultStrategy);

          if (latestVaultStrategy === currentStrategy) {
            console.log(`\n❌ Error: the vault strategy stayed the same: ${currentStrategy}`);
          }
        }
      }
    }
  }
  
  // ================================
  // Save Deployment Info
  // ================================
  if (newImplementation && newImplementation !== config.shadowStrategyImpl) {
    const deployment = {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      shadowStrategyImplementation: newImplementation,
    };
    
    await fs.promises.mkdir("./deployments", { recursive: true });
    const deploymentPath = `./deployments/shadow-strategy-${network.name}.json`;
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, replacer, 2));
    console.log(`\n💾 Deployment saved to ${deploymentPath}`);
  }
  
  // Generate gas report
  gasTracker.getReport();
  
  console.log("\n✅ Deployment script complete!");
  
  if (!isOwner) {
    console.log("\n📝 Note: To fully update vault strategies, run this script as the factory owner");
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });