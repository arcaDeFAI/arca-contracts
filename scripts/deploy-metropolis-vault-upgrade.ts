import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as readline from "readline";
import type { BaseContract, Contract, ContractFactory, ContractTransactionResponse, TransactionReceipt, TransactionResponse } from "ethers";
import type {
  VaultFactory,
  IOracleVault
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

const replacer = (_key: unknown, value: unknown) => {
  if (typeof value === 'bigint') {
    return value.toString();
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

    this.transactions.push({ name, gasUsed, gasPrice, cost, category });
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
    return { totalGas, totalCost, totalCostInS: ethers.formatEther(totalCost), transactionCount: this.transactions.length };
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
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function promptConfirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function getTokenSymbol(tokenAddress: string): Promise<string> {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ["function symbol() view returns (string)"],
    ethers.provider
  );
  const symbol: string = await tokenContract.symbol();
  return symbol;
}

// ================================
// Load Deployment Configuration
// ================================
interface DeploymentConfig {
  vaultFactory: string;
  oracleRewardVaultImpl: string;
  wnative: string;
  oracleHelperFactory: string;
}

async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Run multi-dex deployment first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  return {
    vaultFactory: deployment.addresses.vaultFactory,
    oracleRewardVaultImpl: deployment.addresses.oracleRewardVaultImpl,
    wnative: deployment.addresses.wnative,
    oracleHelperFactory: deployment.addresses.oracleHelperFactory
  };
}

// ================================
// VaultType enum (must match IVaultFactory.VaultType)
// OracleRewardVault is registered under VaultType.OracleReward (3).
// Legacy vaults may exist under VaultType.Oracle (2).
// ================================
const VAULT_TYPE_ORACLE = 2;          // legacy
const VAULT_TYPE_ORACLE_REWARD = 3;   // current

// ================================
// Get Metropolis Vaults
// ================================
interface VaultInfo {
  address: string;
  name: string;
  pair: string;
  vaultType: number;
  totalShares: bigint;
  totalValue: string;
}

async function getMetropolisVaults(factory: VaultFactory): Promise<VaultInfo[]> {
  const vaults: VaultInfo[] = [];

  // Query both legacy (type 2) and current (type 3) vault types
  for (const vaultType of [VAULT_TYPE_ORACLE, VAULT_TYPE_ORACLE_REWARD]) {
    try {
      const numVaults = await factory.getNumberOfVaults(vaultType);
      const typeName = vaultType === VAULT_TYPE_ORACLE ? "Oracle (legacy)" : "OracleReward";
      if (numVaults > 0n) {
        console.log(`  Found ${numVaults} ${typeName} vault(s)`);
      }

      for (let i = 0; i < numVaults; i++) {
        const vaultAddress = await factory.getVaultAt(vaultType, i);
        const vault = await ethers.getContractAt("IOracleVault", vaultAddress) as IOracleVault;

        try {
          const tokenX = await getTokenSymbol(await vault.getTokenX());
          const tokenY = await getTokenSymbol(await vault.getTokenY());
          const pair = await vault.getPair();
          const totalShares = await vault.totalSupply();
          const [balanceX, balanceY] = await vault.getBalances();
          const totalValue = `${ethers.formatUnits(balanceX, 18)} ${tokenX} + ${ethers.formatUnits(balanceY, 18)} ${tokenY}`;

          vaults.push({ address: vaultAddress, name: `${tokenX}-${tokenY}`, pair, vaultType, totalShares, totalValue });
        } catch (error) {
          console.warn(`⚠️  Could not get details for vault ${vaultAddress}`, error);
        }
      }
    } catch {
      // No vaults of this type
    }
  }

  return vaults;
}

// ================================
// Main Deployment Function
// ================================
async function main() {
  console.log("\n🚀 Metropolis OracleRewardVault Upgrade Script");
  console.log("====================================");
  console.log(`Network: ${network.name}`);

  const gasTracker = new GasTracker();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Load configuration
  const config = await loadDeploymentConfig();
  console.log("\n📋 Configuration loaded:");
  console.log("  VaultFactory:", config.vaultFactory);
  console.log("  Current OracleRewardVault Implementation:", config.oracleRewardVaultImpl);

  // Get VaultFactory instance
  const factory = await ethers.getContractAt("VaultFactory", config.vaultFactory) as VaultFactory;

  // Show current on-chain implementation
  const currentImpl = await factory.getVaultImplementation(VAULT_TYPE_ORACLE_REWARD);
  console.log(`\n📋 On-chain VaultType.OracleReward (${VAULT_TYPE_ORACLE_REWARD}) implementation:`, currentImpl);

  // Also check legacy type for reference
  const legacyImpl = await factory.getVaultImplementation(VAULT_TYPE_ORACLE);
  if (legacyImpl !== ethers.ZeroAddress) {
    console.log(`  Legacy VaultType.Oracle (${VAULT_TYPE_ORACLE}) implementation:`, legacyImpl);
  }

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
  const existingVaults = await getMetropolisVaults(factory);
  if (existingVaults.length > 0) {
    console.log(`\n📋 Found ${existingVaults.length} existing Metropolis vault(s):`);
    existingVaults.forEach((v, i) => {
      const typeName = v.vaultType === VAULT_TYPE_ORACLE ? "legacy" : "current";
      console.log(`  ${i + 1}. [${typeName}] ${v.name} (${v.address})`);
      console.log(`     LBPair: ${v.pair}`);
      console.log(`     Total Value: ${v.totalValue}`);
    });
  } else {
    console.log("\n📋 No existing Metropolis vaults found");
  }

  // ================================
  // Step 1: Deploy new OracleRewardVault implementation
  // ================================
  // MetropolisPriceHelper is an internal library (all functions are `internal`),
  // so it compiles directly into OracleRewardVault — no library linking needed.
  const deployNew = await promptConfirm("\n📦 Deploy new OracleRewardVault implementation?");
  if (!deployNew) {
    console.log("Exiting.");
    return;
  }

  const OracleRewardVaultFactory = await ethers.getContractFactory("OracleRewardVault");
  const newImpl = await deployContract(
    "OracleRewardVault Implementation",
    OracleRewardVaultFactory,
    [config.vaultFactory],
    gasTracker
  );
  const newImplAddress = await newImpl.getAddress();

  // Verify on explorer (non-localhost)
  if (network.name !== "localhost" && network.name !== "hardhat") {
    await verifyContract(newImplAddress, [config.vaultFactory], "contracts-metropolis/src/OracleRewardVault.sol:OracleRewardVault");
  }

  // ================================
  // Step 2: Update Factory Implementation
  // ================================
  const updateFactory = await promptConfirm(`\n🔧 Update factory's VaultType.OracleReward implementation to ${newImplAddress}?`);

  if (updateFactory) {
    if (!isOwner) {
      console.log("\n❌ Cannot update factory implementation — you are not the factory owner");
    } else {
      console.log(`\nUpdating factory vault implementation (VaultType.OracleReward = ${VAULT_TYPE_ORACLE_REWARD})...`);

      const tx = await factory.setVaultImplementation(VAULT_TYPE_ORACLE_REWARD, newImplAddress);
      await gasTracker.trackTransaction("Update OracleRewardVault implementation", tx);

      const confirmed = await factory.getVaultImplementation(VAULT_TYPE_ORACLE_REWARD);
      if (confirmed === newImplAddress) {
        console.log("✅ Factory updated with new OracleRewardVault implementation [CONFIRMED]");
      } else {
        console.log("❌ Factory failed to update OracleRewardVault implementation!");
        return;
      }
    }
  }

  // ================================
  // Step 3: Migration Management
  // ================================
  const vaultsWithShares = existingVaults.filter(v => v.totalShares > 0n);
  if (vaultsWithShares.length > 0) {
    console.log(`\n📋 MIGRATION NOTES`);
    console.log("=".repeat(50));
    console.log(`  Existing vaults with shares: ${vaultsWithShares.length}`);
    console.log("  - New vaults created after this upgrade will use the new implementation");
    console.log("  - Existing vaults are immutable clones — they cannot be upgraded in place");
    console.log("  - If migration is needed: set existing vaults to emergency mode");
    console.log("  - Users must manually withdraw from old vaults and deposit into new ones");

    if (isOwner) {
      const manageMigration = await promptConfirm("\n🔄 Set existing vaults to emergency mode?");
      if (manageMigration) {
        for (const vault of vaultsWithShares) {
          try {
            const tx = await factory.setEmergencyMode(vault.address);
            await gasTracker.trackTransaction(`Emergency mode: ${vault.name}`, tx, "migration");
            console.log(`✅ ${vault.name} set to emergency mode`);
          } catch (error) {
            console.error(`❌ Failed to set emergency mode for ${vault.name}:`, error);
          }
        }
      }
    }
  }

  // ================================
  // Save Deployment Info
  // ================================
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  try {
    const existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    existingDeployment.addresses.oracleRewardVaultImpl = newImplAddress;
    existingDeployment.timestamp = new Date().toISOString();
    fs.writeFileSync(deploymentPath, JSON.stringify(existingDeployment, null, 2));
    console.log(`\n💾 Updated deployment file: ${deploymentPath}`);
  } catch (error) {
    console.warn(`⚠️  Could not update deployment file: ${error}`);
  }

  // Also save a separate upgrade record
  const upgradeRecord = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    newOracleRewardVaultImpl: newImplAddress,
    previousImpl: currentImpl,
    factoryUpdated: isOwner && updateFactory,
    existingVaults: existingVaults.length
  };

  await fs.promises.mkdir("./deployments", { recursive: true });
  const upgradePath = `./deployments/metropolis-vault-upgrade-${network.name}.json`;
  fs.writeFileSync(upgradePath, JSON.stringify(upgradeRecord, replacer, 2));
  console.log(`💾 Upgrade record saved to ${upgradePath}`);

  gasTracker.getReport();
  console.log("\n✅ Metropolis vault upgrade script complete!");

  if (!isOwner) {
    console.log("\n📝 Note: To update factory implementation, run this script as the factory owner");
  }
}

// ================================
// Verify Contract on Explorer
// ================================
async function verifyContract(address: string, constructorArgs: unknown[], contractPath: string): Promise<void> {
  console.log("Waiting for deployment to propagate...");
  await new Promise(f => setTimeout(f, 6000));

  try {
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
      contract: contractPath,
      force: true,
    });
    console.log(`✅ Contract verified successfully!`);
  } catch (error) {
    const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (errorMessage.includes("already verified") || errorMessage.includes("already been verified")) {
      console.log(`✅ Contract is already verified`);
    } else {
      console.warn(`⚠️  Verification failed:`, error);
      console.log("You can verify manually later.");
    }
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
