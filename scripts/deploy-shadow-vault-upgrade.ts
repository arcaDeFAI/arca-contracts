import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as readline from "readline";
import type { BaseContract, Contract, ContractFactory, ContractTransactionResponse, TransactionReceipt, TransactionResponse } from "ethers";
import type { 
  VaultFactory, 
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
async function deployContractWithLibraries<T extends Contract>(
  displayName: string,
  contractName: string,
  libraries: Record<string, string>,
  args: unknown[],
  gasTracker: GasTracker,
  overrides?: { gasLimit?: number }
): Promise<T> {
  console.log(`\nDeploying ${displayName}...`);
  
  const factory = await ethers.getContractFactory(contractName, { libraries });
  const contract = await factory.deploy(...args, overrides || {});
  const tx = await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✓ ${displayName} deployed at: ${address}`);
  
  await gasTracker.trackDeployment(displayName, contract);
  
  return contract as T;
}

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
  shadowVaultImpl?: string;
  shadowPriceHelper?: string;
  shadowNPM?: string;
}

async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Run multi-dex deployment first.`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  return {
    vaultFactory: deployment.addresses.vaultFactory,
    shadowVaultImpl: deployment.addresses.oracleRewardShadowVault,
    shadowPriceHelper: deployment.addresses.shadowPriceHelper,
    shadowNPM: deployment.addresses.shadowNPM
  };
}

// ================================
// Get Shadow Vaults
// ================================
interface VaultInfo {
  address: string;
  name: string;
  pool: string;
  implementation: string;
  totalShares: bigint;
  totalValue: string;
}

async function getShadowVaults(factory: VaultFactory): Promise<VaultInfo[]> {
  const vaults: VaultInfo[] = [];
  
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
        const totalShares = await vault.totalSupply();
        
        // Get vault implementation (this will be used to check if upgrade is needed)
        const implementation = await factory.getVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD);
        
        // Calculate approximate total value (simplified)
        const [balanceX, balanceY] = await vault.getBalances();
        const totalValue = `${ethers.formatUnits(balanceX, 18)} ${tokenX} + ${ethers.formatUnits(balanceY, 18)} ${tokenY}`;
        
        vaults.push({
          address: vaultAddress,
          name: `${tokenX}-${tokenY}`,
          pool: pool,
          implementation: implementation,
          totalShares: totalShares,
          totalValue: totalValue
        });
      } catch (error) {
        console.warn(`⚠️  Could not get details for vault ${vaultAddress}`, error);
      }
    }
  } catch (error) {
    console.log("No Shadow vaults found or error accessing factory");
  }
  
  return vaults;
}

// ================================
// Migration Planning
// ================================
interface MigrationPlan {
  oldVaults: VaultInfo[];
  newImplementation: string;
  estimatedMigrationSteps: number;
  requiresUserAction: boolean;
  migrationInstructions: string[];
}

function createMigrationPlan(vaults: VaultInfo[], newImplementation: string): MigrationPlan {
  const vaultsNeedingUpgrade = vaults.filter(v => v.implementation !== newImplementation);
  
  return {
    oldVaults: vaultsNeedingUpgrade,
    newImplementation,
    estimatedMigrationSteps: vaultsNeedingUpgrade.length * 3, // Emergency mode + new vault + strategy
    requiresUserAction: vaultsNeedingUpgrade.length > 0,
    migrationInstructions: [
      "1. Set existing vaults to emergency mode (pauses new deposits)",
      "2. Deploy new vault instances with updated implementation",
      "3. Users must manually migrate their positions",
      "4. Strategy contracts can be relinked if needed",
      "5. Existing vaults remain functional but use old implementation"
    ]
  };
}

// ================================
// Main Deployment Function  
// ================================
async function main() {
  console.log("\n🚀 Shadow Vault Upgrade Script");
  console.log("====================================");
  console.log(`Network: ${network.name}`);
  
  const gasTracker = new GasTracker();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Load configuration
  const config = await loadDeploymentConfig();
  console.log("\n📋 Configuration loaded:");
  console.log("  VaultFactory:", config.vaultFactory);
  console.log("  Current ShadowVault Implementation:", config.shadowVaultImpl);
  console.log("  ShadowPriceHelper Library:", config.shadowPriceHelper);
  
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
    console.log("  - Update the factory's vault implementation");
    console.log("  - Set vaults to emergency mode");
  }
  
  // Get existing vaults
  const existingVaults = await getShadowVaults(factory);
  console.log(`\n📋 Found ${existingVaults.length} existing Shadow vaults:`);
  existingVaults.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.name} (${v.address})`);
    console.log(`     Pool: ${v.pool}`);
    console.log(`     Total Value: ${v.totalValue}`);
    console.log(`     Implementation: ${v.implementation}`);
  });
  
  // ================================
  // Step 1: Deploy New Implementation
  // ================================
  const deployNewImpl = await promptConfirm("\n📦 Deploy new Shadow Vault implementation?");
  
  let newImplementation: string = config.shadowVaultImpl || "";
  
  if (deployNewImpl) {
    if (!config.shadowPriceHelper) {
      throw new Error("ShadowPriceHelper library address not found in deployment config");
    }
    
    console.log(`\nDeploying with ShadowPriceHelper library: ${config.shadowPriceHelper}`);
    
    const shadowVaultImpl = await deployContractWithLibraries(
      "OracleRewardShadowVault Implementation",
      "OracleRewardShadowVault",
      { ShadowPriceHelper: config.shadowPriceHelper },
      [config.vaultFactory],
      gasTracker,
      { gasLimit: 10000000 }
    );

    // Verify the contract with Sonic Explorer
    newImplementation = await shadowVaultImpl.getAddress();
    let successMessage = false

    try {
          await run("verify:verify", {
                address: newImplementation,
                constructorArguments: [config.vaultFactory],
                contract: "contracts-shadow/src/OracleRewardShadowVault.sol:OracleRewardShadowVault",
                force: true, // Force verification even if already verified
                libraries: {
                  ShadowPriceHelper: config.shadowPriceHelper
                }
              });
              successMessage = true;
    } catch (error) {
      successMessage = false;
      const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (errorMessage.includes("already verified") || 
          errorMessage.includes("already been verified")) {
        console.log(`✅ Shadow Vault Implementation is already verified`);
      } else {
        throw error;
      }
    }
    
    if (successMessage) {
      console.log(`✅ Shadow Vault Implementation verified successfully!`);
    }
  }
  
  // ================================
  // Step 2: Create Migration Plan
  // ================================
  const migrationPlan = createMigrationPlan(existingVaults, newImplementation);
  
  if (migrationPlan.requiresUserAction) {
    console.log(`\n📋 MIGRATION PLAN`);
    console.log("=".repeat(50));
    console.log(`Vaults requiring migration: ${migrationPlan.oldVaults.length}`);
    console.log(`Estimated migration steps: ${migrationPlan.estimatedMigrationSteps}`);
    console.log(`\n📝 Migration Process:`);
    migrationPlan.migrationInstructions.forEach(instruction => {
      console.log(`  ${instruction}`);
    });
    console.log("\n⚠️  IMPORTANT: Users must manually migrate their positions!");
    console.log("   Old vaults will continue working but won't receive implementation updates.");
  } else {
    console.log(`\n✅ No migration required - all vaults use current implementation`);
  }
  
  // ================================
  // Step 3: Update Factory Implementation
  // ================================
  if (newImplementation && newImplementation !== config.shadowVaultImpl) {
    const updateFactory = await promptConfirm("\n🔧 Update factory's Shadow Vault implementation?");
    
    if (updateFactory) {
      if (!isOwner) {
        console.log("\n❌ Cannot update factory implementation - you are not the factory owner");
        console.log("Please run this script with the factory owner account");
      } else {
        const VAULT_TYPE_SHADOW_ORACLE_REWARD = 4;
        console.log(`\nUpdating factory vault implementation (type ${VAULT_TYPE_SHADOW_ORACLE_REWARD})...`);
        
        const tx = await factory.setVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD, newImplementation);
        await gasTracker.trackTransaction("Update factory vault implementation", tx);
        
        const confirmationOfSetOperation = (await factory.getVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD)) === newImplementation

        if (confirmationOfSetOperation) {
          console.log("✅ Factory updated with new vault implementation [CONFIRMED]");
        } else {
          console.log("❌ Factory failed to be updated with new vault implementation!");
          return;
        }
      }
    }
  }
  
  // ================================
  // Step 4: Migration Management
  // ================================
  if (migrationPlan.requiresUserAction && isOwner) {
    const manageMigration = await promptConfirm("\n🔄 Manage existing vault migration?");
    
    if (manageMigration) {
      console.log("\n📋 Available Migration Actions:");
      console.log("  1. Set vaults to emergency mode (pause deposits)");
      console.log("  2. Deploy new vault instances");
      console.log("  3. Generate migration report");
      console.log("  4. Skip migration management");
      
      const action = await prompt("\nSelect action (1-4): ");

      
      
      switch (action) {
        case "1":
          // Set emergency mode
          console.log("\n🚨 Setting vaults to emergency mode...");
          for (const vault of migrationPlan.oldVaults) {
            try {
              const tx = await factory.setEmergencyMode(vault.address);
              await gasTracker.trackTransaction(`Emergency mode: ${vault.name}`, tx, "migration");
              console.log(`✅ ${vault.name} set to emergency mode`);
            } catch (error) {
              console.error(`❌ Failed to set emergency mode for ${vault.name}:`, error);
            }
          }
          break;
          
        case "2":
          console.log("\n🏗️  New vault deployment would happen here");
          console.log("   This requires creating new vaults with updated implementation");
          console.log("   Users would then need to migrate manually");
          break;
          
        case "3":
          // Generate migration report
          await migrationReport();
          break;
          
        case "4":
          console.log("\n⏭️  Skipping migration management");
          break;
          
        default:
          console.log("\n❓ Invalid selection, skipping migration management");
      }
    }
  }
  
  // ================================
  // Save Deployment Info
  // ================================
  if (newImplementation && newImplementation !== config.shadowVaultImpl) {
    const deployment = {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      shadowVaultImplementation: newImplementation,
      factoryUpdated: isOwner,
      migrationRequired: migrationPlan.requiresUserAction,
      affectedVaults: migrationPlan.oldVaults.length
    };
    
    await fs.promises.mkdir("./deployments", { recursive: true });
    const deploymentPath = `./deployments/shadow-vault-upgrade-${network.name}.json`;
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, replacer, 2));
    console.log(`\n💾 Deployment saved to ${deploymentPath}`);
  }
  
  // Generate gas report
  gasTracker.getReport();
  
  console.log("\n✅ Vault upgrade script complete!");
  
  if (!isOwner) {
    console.log("\n📝 Note: To fully update factory implementation and manage migrations, run this script as the factory owner");
  }
  
  if (migrationPlan.requiresUserAction) {
    console.log("\n⚠️  IMPORTANT REMINDERS:");
    console.log("  - Existing vaults continue to work with old implementation");
    console.log("  - Users must manually migrate to benefit from new implementation"); 
    console.log("  - New vaults created after factory update will use new implementation");
    console.log("  - Consider communication plan for affected users");
  }

  async function migrationReport() {
    const migrationReport = {
      network: network.name,
      timestamp: new Date().toISOString(),
      oldImplementation: config.shadowVaultImpl,
      newImplementation: newImplementation,
      vaultsRequiringMigration: migrationPlan.oldVaults.map(v => ({
        address: v.address,
        name: v.name,
        pool: v.pool,
        totalSupply: v.totalShares.toString(),
        totalValue: v.totalValue
      })),
      migrationInstructions: migrationPlan.migrationInstructions
    };
    await fs.promises.mkdir("./deployments", { recursive: true });
    const reportPath = `./deployments/shadow-vault-migration-${network.name}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(migrationReport, replacer, 2));
    console.log(`\n💾 Migration report saved to ${reportPath}`);
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });