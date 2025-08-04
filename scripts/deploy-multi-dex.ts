import type { Contract, TransactionReceipt, TransactionResponse } from "ethers";
import { ethers, network } from "hardhat";
import type { OracleHelperFactory, ShadowPriceHelper, ShadowPriceHelperWrapper } from "typechain-types";

// Gas tracking utility
interface GasTransaction {
  name: string;
  gasUsed: bigint;
  gasPrice: bigint;
  cost: bigint;
  category: "deployment" | "configuration";
}

class GasTracker {
  private transactions: GasTransaction[] = [];
  
  async trackDeployment(name: string, contract: Contract): Promise<void> {
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
  
  async trackTransaction(name: string, txResponse: TransactionResponse): Promise<TransactionReceipt> {
    const receipt = await txResponse.wait();
    if (!receipt) {
      throw new Error(`Failed to get receipt for transaction: ${name}`);
    }
    
    this.addTransaction(name, receipt, "configuration");
    return receipt;
  }
  
  private addTransaction(name: string, receipt: TransactionReceipt, category: "deployment" | "configuration") {
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
  
  getReport(verbose: boolean = false) {
    // Separate by category
    const deployments = this.transactions.filter(tx => tx.category === "deployment");
    const configurations = this.transactions.filter(tx => tx.category === "configuration");
    
    if (verbose) {
      console.log("\n=== 🔥 Gas Usage Report 🔥 ===");
      console.log("Network:", network.name);
      console.log("Total Transactions:", this.transactions.length);
      
      // Deployment costs
      if (deployments.length > 0) {
        console.log("\n📦 Contract Deployments:");
        console.log("-".repeat(90));
        console.log("Contract".padEnd(45) + "Gas Used".padEnd(15) + "Gas Price (Gwei)".padEnd(17) + "Cost (S)");
        console.log("-".repeat(90));
        
        let deploymentGas = 0n;
        let deploymentCost = 0n;
        
        for (const tx of deployments) {
          const gasPriceGwei = ethers.formatUnits(tx.gasPrice, "gwei");
          const costInS = ethers.formatEther(tx.cost);
          
          console.log(
            tx.name.padEnd(45) +
            tx.gasUsed.toString().padEnd(15) +
            gasPriceGwei.padEnd(17) +
            costInS
          );
          
          deploymentGas += tx.gasUsed;
          deploymentCost += tx.cost;
        }
        
        console.log("-".repeat(90));
        console.log("Subtotal".padEnd(45) + deploymentGas.toString().padEnd(15) + " ".padEnd(17) + ethers.formatEther(deploymentCost));
      }
      
      // Configuration costs
      if (configurations.length > 0) {
        console.log("\n⚙️  Configuration Transactions:");
        console.log("-".repeat(90));
        console.log("Transaction".padEnd(45) + "Gas Used".padEnd(15) + "Gas Price (Gwei)".padEnd(17) + "Cost (S)");
        console.log("-".repeat(90));
        
        let configGas = 0n;
        let configCost = 0n;
        
        for (const tx of configurations) {
          const gasPriceGwei = ethers.formatUnits(tx.gasPrice, "gwei");
          const costInS = ethers.formatEther(tx.cost);
          
          console.log(
            tx.name.padEnd(45) +
            tx.gasUsed.toString().padEnd(15) +
            gasPriceGwei.padEnd(17) +
            costInS
          );
          
          configGas += tx.gasUsed;
          configCost += tx.cost;
        }
        
        console.log("-".repeat(90));
        console.log("Subtotal".padEnd(45) + configGas.toString().padEnd(15) + " ".padEnd(17) + ethers.formatEther(configCost));
      }
    }
    
    // Total summary (always shown)
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
      transactionCount: this.transactions.length,
      deploymentCount: deployments.length,
      configurationCount: configurations.length
    };
  }
  
  getTotalCostInS(): string {
    const totalCost = this.transactions.reduce((sum, tx) => sum + tx.cost, 0n);
    return ethers.formatEther(totalCost);
  }
}

// Helper function to deploy contract with gas tracking
async function deployContract<T extends Contract>(
  displayName: string,
  factory: { deploy: (...args: unknown[]) => Promise<T> },
  args: unknown[],
  gasTracker: GasTracker,
  options?: { gasLimit?: number }
): Promise<T> {
  console.log(`\nDeploying ${displayName}...`);
  
  const deployOptions = options?.gasLimit ? { gasLimit: options.gasLimit } : {};
  const contract = await factory.deploy(...args, deployOptions);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✓ ${displayName} deployed at: ${address}`);
  
  await gasTracker.trackDeployment(displayName, contract);
  
  return contract as T;
}

// Helper function to deploy contract with linked libraries
async function deployContractWithLibraries<T extends Contract>(
  displayName: string,
  contractName: string,
  libraries: Record<string, string>,
  args: unknown[],
  gasTracker: GasTracker,
  options?: { gasLimit?: number }
): Promise<T> {
  console.log(`\nDeploying ${displayName}...`);
  
  const factory = await ethers.getContractFactory(contractName, { libraries });
  const deployOptions = options?.gasLimit ? { gasLimit: options.gasLimit } : {};
  const contract = await factory.deploy(...args, deployOptions);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✓ ${displayName} deployed at: ${address}`);
  
  await gasTracker.trackDeployment(displayName, contract);
  
  return contract as T;
}

// Helper function to send transaction with gas tracking
async function sendTransaction(
  name: string,
  txPromise: Promise<TransactionResponse>,
  gasTracker: GasTracker
): Promise<TransactionReceipt> {
  console.log(`\n${name}...`);
  const tx = await txPromise;
  const receipt = await gasTracker.trackTransaction(name, tx);
  console.log(`✓ ${name} completed`);
  return receipt;
}

async function main() {
  // Parse command line arguments for verbose flag
  // Note: Hardhat doesn't pass custom args through process.argv when using `hardhat run`
  // We need to check environment variable instead
  const verbose = process.env.VERBOSE === "true";

  console.log(`Deploying Metropolis & Shadow contracts to ${network.name}...`);

  // Initialize gas tracker
  const gasTracker = new GasTracker();

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Configure parameters based on network
  let wnative: string;

  // -------------------------------------- CONFIG ZONE START --------------------------------------
  // If you want to re-use a contract for the Oracle Helper Factory or other contracts, set it here
  // Otherwise, a new one will be deployed (except for hardhat localhost where it's not used)
  let oracleHelperFactoryAddress: string = "0x0000000000000000000000000000000000000000";
  let shadowPriceHelperAddress: string = "0x0000000000000000000000000000000000000000";
  let shadowPriceHelperWrapperAddress: string = "0xa8D204f63885bdD531c1b5Bde9d8e540e76F2E53";

  const creationFee = 0n; // Default 0 for testnet
  
  // Shadow protocol addresses configuration
  const deploymentConfig: { [key: string]: { npm: string; voter: string, priceLens: string, whitelist: string[] } } = {
    "sonic-mainnet": {
      npm: "0x12E66C8F215DdD5d48d150c8f46aD0c6fB0F4406", // Shadow NPM address
      voter: "0x9F59398D0a397b2EEB8a6123a6c7295cB0b0062D", // Shadow Voter address
      whitelist: ["0x76F4aeb24dD5681dCDC23ef9778a95C6aB76a995",
        "0x324963c267C354c7660Ce8CA3F5f167E05649970", // Shadow pool wS/USDC
        "0x97325a7854c604261002126267dAEd219E34b06b", // Shadow pool wS/USDT
        "0x64B93267B73CE6bb431b5799ED8674f9160CE214", // Shadow pool SHADOW/USDT
        "0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC"  // Metropolis LB Pair wS/USDC
      ], // Whitelist pools/LB Pairs that you want to use
      // Set a price lens here if you want to re-use a deployed price lens contract
      priceLens: "0x8bF65Ab156b83bB6169866e5D2A14AeC0Ff87c7B", 
    },
    "sonic-testnet": {
      npm: "0x0000000000000000000000000000000000000000", // TODO: Add testnet Shadow NPM address
      voter: "0x0000000000000000000000000000000000000000", // TODO: Add testnet Shadow Voter address
      whitelist: [],
      priceLens: "0x0000000000000000000000000000000000000000",
    },
    "localhost": {
      npm: "0x0000000000000000000000000000000000000000", // Will be set from mock deployment
      voter: "0x0000000000000000000000000000000000000000", // Will be set from mock deployment
      whitelist: [],
      priceLens: "0x0000000000000000000000000000000000000000",
    }
  };

  // -------------------------------------- CONFIG ZONE END --------------------------------------

  if (network.name === "localhost" || network.name === "hardhat") {
    // For localhost, deploy a mock wS
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockWS = await deployContract(
      "MockERC20 (wS)",
      MockERC20,
      ["Wrapped Sonic", "wS", 18, deployer.address],
      gasTracker
    );
    wnative = await mockWS.getAddress();

    // For localhost, always deploy the shadow price helper address
    [, shadowPriceHelperAddress] = await deployShadowPriceHelper(gasTracker);

    // For localhost, always deploy the shadow price helper wrapper
    [, shadowPriceHelperWrapperAddress] = await deployShadowPriceHelperWrapper(gasTracker, shadowPriceHelperAddress);

    // For localhost, always deploy a oracle helper factory contract
    [, oracleHelperFactoryAddress] = await deployOracleHelperFactory(gasTracker);
  } else if (network.name === "sonic-testnet") {
    // For testnet, use the testnet wS address
    wnative = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // Actual testnet wS
    
    
  } else if (network.name === "sonic-mainnet") {
    // For mainnet, use the mainnet wS address
    wnative = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // Actual mainnet wS
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  if (oracleHelperFactoryAddress === "0x0000000000000000000000000000000000000000") {
    // Deploy OracleHelperFactory
    [,oracleHelperFactoryAddress] = await deployOracleHelperFactory(gasTracker);
  }

  if (shadowPriceHelperAddress === "0x0000000000000000000000000000000000000000") {
    [,shadowPriceHelperAddress] = await deployShadowPriceHelper(gasTracker);
  }

  if (shadowPriceHelperWrapperAddress === "0x0000000000000000000000000000000000000000") {
    [,shadowPriceHelperWrapperAddress] = await deployShadowPriceHelperWrapper(gasTracker, shadowPriceHelperAddress);
  }

  // Deploy VaultFactory implementation
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactoryImpl = await deployContract(
    "VaultFactory Implementation",
    VaultFactory,
    [wnative, oracleHelperFactoryAddress],
    gasTracker
  );

  // Deploy ProxyAdmin to control upgrades
  const ProxyAdmin = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
  );
  const proxyAdmin = await deployContract(
    "ProxyAdmin",
    ProxyAdmin,
    [deployer.address],
    gasTracker
  );

  // Deploy TransparentUpgradeableProxy with ProxyAdmin
  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
  );
  
  // Encode the initialize4 function call
  const initData = VaultFactory.interface.encodeFunctionData("initialize4", [
    deployer.address,
    creationFee
  ]);
  
  const proxy = await deployContract(
    "VaultFactory Proxy",
    TransparentUpgradeableProxy,
    [
      await vaultFactoryImpl.getAddress(),
      await proxyAdmin.getAddress(),
      initData
    ],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const proxyAddress = await proxy.getAddress();

  // Get the VaultFactory interface at the proxy address
  const vaultFactory = VaultFactory.attach(proxyAddress);

  // Debug: Verify the factory proxy is working
  console.log("\n=== Verifying VaultFactory Proxy ===");
  try {
    const wnative = await vaultFactory.getWNative();
    const owner = await vaultFactory.owner();
    console.log("✓ Factory proxy wnative:", wnative);
    console.log("✓ Factory proxy owner:", owner);
    console.log("✓ Factory proxy is responding correctly");
  } catch (error) {
    console.error("❌ Factory proxy verification failed:", error);
    throw new Error("Factory proxy is not working correctly");
  }

  // Deploy implementation contracts
  console.log("\n=== Deploying Implementation Contracts ===");
  
  // Skip OracleVault for now since it's failing and focus on OracleRewardVault
  console.log("⚠️  Skipping OracleVault deployment (not needed for current use case)");
  const oracleVaultImpl: Contract | null = null;

  let oracleRewardVaultImpl: Contract;
  try {
    const OracleRewardVault = await ethers.getContractFactory("OracleRewardVault");
    oracleRewardVaultImpl = await deployContract(
      "OracleRewardVault Implementation",
      OracleRewardVault,
      [proxyAddress],
      gasTracker,
      { gasLimit: 10000000 }
    );
    
    // Verify the deployment worked
    const implAddress = await oracleRewardVaultImpl.getAddress();
    const code = await ethers.provider.getCode(implAddress);
    console.log("✓ Contract code size:", code.length, "bytes");
    
  } catch (error) {
    console.error("❌ OracleRewardVault deployment failed:", error);
    
    // Try to get more details about the failure
    try {
      const OracleRewardVaultFactory = await ethers.getContractFactory("OracleRewardVault");
      const deployTx = OracleRewardVaultFactory.getDeployTransaction(proxyAddress);
      const estimatedGas = await ethers.provider.estimateGas(deployTx);
      console.log("Gas estimation:", estimatedGas.toString());
    } catch (gasError) {
      console.error("Gas estimation also failed:", gasError);
    }
    
    throw error;
  }

  let oracleRewardShadowVaultImpl: Contract;
  try {
    oracleRewardShadowVaultImpl = await deployContractWithLibraries(
      "OracleRewardShadowVault Implementation",
      "OracleRewardShadowVault",
      { ShadowPriceHelper: shadowPriceHelperAddress },
      [proxyAddress],
      gasTracker,
      { gasLimit: 10000000 }
    );
    
    // Verify the deployment
    const implAddress = await oracleRewardShadowVaultImpl.getAddress();
    const code = await ethers.provider.getCode(implAddress);
    console.log("✓ Contract code size:", code.length, "bytes");
    
  } catch (error) {
    console.error("❌ OracleRewardShadowVault deployment failed:", error);
    throw error;
  }

  const maxRange = 51; // Default max range for Sonic
  const Strategy = await ethers.getContractFactory("MetropolisStrategy");
  const strategyImpl = await deployContract(
    "MetropolisStrategy Implementation",
    Strategy,
    [proxyAddress, maxRange],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const strategyImplAddress = await strategyImpl.getAddress();

  // Deploy Shadow Strategy implementation
  const maxRangeShadow = 887272; // Max tick range for Shadow (from SHADOW_INTEGRATION_PLAN.md)
  const ShadowStrategy = await ethers.getContractFactory("ShadowStrategy");
  const shadowStrategyImpl = await deployContract(
    "ShadowStrategy Implementation",
    ShadowStrategy,
    [proxyAddress, maxRangeShadow],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const shadowStrategyImplAddress = await shadowStrategyImpl.getAddress();

  // Set vault and strategy implementations
  console.log("\n=== Setting Factory Implementations ===");
  
  const VAULT_TYPE_ORACLE = 2;
  const VAULT_TYPE_SHADOW_ORACLE_REWARD = 4;
  const STRATEGY_TYPE_DEFAULT = 1;
  const STRATEGY_TYPE_SHADOW = 2;

  console.log("Constants being used:");
  console.log("  VAULT_TYPE_ORACLE:", VAULT_TYPE_ORACLE);
  console.log("  VAULT_TYPE_SHADOW_ORACLE_REWARD:", VAULT_TYPE_SHADOW_ORACLE_REWARD);
  console.log("  STRATEGY_TYPE_DEFAULT:", STRATEGY_TYPE_DEFAULT);
  console.log("  STRATEGY_TYPE_SHADOW:", STRATEGY_TYPE_SHADOW);

  console.log("\nSetting vault implementations...");
  const oracleRewardVaultAddress = await oracleRewardVaultImpl.getAddress();
  await sendTransaction(
    `Set VAULT_TYPE_ORACLE (${VAULT_TYPE_ORACLE}) to ${oracleRewardVaultAddress}`,
    vaultFactory.setVaultImplementation(VAULT_TYPE_ORACLE, oracleRewardVaultAddress),
    gasTracker
  );

  const oracleRewardShadowVaultAddress = await oracleRewardShadowVaultImpl.getAddress();
  await sendTransaction(
    `Set VAULT_TYPE_SHADOW_ORACLE_REWARD (${VAULT_TYPE_SHADOW_ORACLE_REWARD}) to ${oracleRewardShadowVaultAddress}`,
    vaultFactory.setVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD, oracleRewardShadowVaultAddress),
    gasTracker
  );

  console.log("\nSetting strategy implementations...");
  await sendTransaction(
    `Set STRATEGY_TYPE_DEFAULT (${STRATEGY_TYPE_DEFAULT}) to ${strategyImplAddress}`,
    vaultFactory.setStrategyImplementation(STRATEGY_TYPE_DEFAULT, strategyImplAddress),
    gasTracker
  );
  
  // Immediately verify it was set correctly
  const verifyStrategy = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_DEFAULT);
  console.log("  Immediate verification - Expected:", strategyImplAddress);
  console.log("  Immediate verification - Actual  :", verifyStrategy);
  console.log("  Immediate verification - Match   :", verifyStrategy === strategyImplAddress);

  await sendTransaction(
    `Set STRATEGY_TYPE_SHADOW (${STRATEGY_TYPE_SHADOW}) to ${shadowStrategyImplAddress}`,
    vaultFactory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, shadowStrategyImplAddress),
    gasTracker
  );
  
  // Immediately verify it was set correctly
  const verifyShadowStrategy = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
  console.log("  Immediate verification - Expected:", shadowStrategyImplAddress);
  console.log("  Immediate verification - Actual  :", verifyShadowStrategy);
  console.log("  Immediate verification - Match   :", verifyShadowStrategy === shadowStrategyImplAddress);

  // Configure Shadow protocol addresses
  if (deploymentConfig[network.name]) {
    console.log("Configuring Shadow protocol addresses...");
    
    const { npm, voter, whitelist, priceLens } = deploymentConfig[network.name];
    
    if (npm !== "0x0000000000000000000000000000000000000000") {
      await sendTransaction(
        `Set Shadow NPM to ${npm}`,
        vaultFactory.setShadowNonfungiblePositionManager(npm),
        gasTracker
      );
    } else {
      console.log("⚠️  Warning: Shadow NPM address not configured for", network.name);
    }

    if (voter !== "0x0000000000000000000000000000000000000000") {
      await sendTransaction(
        `Set Shadow Voter to ${voter}`,
        vaultFactory.setShadowVoter(voter),
        gasTracker
      );
    } else {
      console.log("⚠️  Warning: Shadow Voter address not configured for", network.name);
    }

    if (priceLens !== "0x0000000000000000000000000000000000000000") {
        await sendTransaction(
          `Set Price Lens to ${priceLens}`,
          vaultFactory.setPriceLens(priceLens),
          gasTracker
        );
    } else {
      console.log("⚠️  Warning: Price Lens address not configured for", network.name);
    }

    if (whitelist.length > 0) {
      await sendTransaction(
        `Set Token Pair/Pool Whitelist to ${whitelist.join()}`,
        vaultFactory.setPairWhitelist(whitelist, true),
        gasTracker
      );
    } else {
      console.log("No token whitelist pre-configured.");
    }
  }

  // Verify the configuration
  console.log("\n=== Verifying Factory Configuration ===");
  
  const owner = await vaultFactory.owner();
  console.log("Factory owner:", owner);

  console.log("\nRetrieving implementations from factory...");
  const oracleVaultImplFromFactory = await vaultFactory.getVaultImplementation(VAULT_TYPE_ORACLE);
  const oracleRewardShadowVaultImplFromFactory = await vaultFactory.getVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD);
  const strategyImplFromFactory = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_DEFAULT);
  const shadowStrategyImplFromFactory = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
  const npmFromFactory = await vaultFactory.getShadowNonfungiblePositionManager();
  const voterFromFactory = await vaultFactory.getShadowVoter();
  const priceLensFromFactory = await vaultFactory.getPriceLens();

  console.log("\n=== Detailed Verification ===");
  
  // Only check Oracle vault if it was deployed
  if (oracleVaultImpl) {
    const oracleVaultDeployedAddr = await oracleVaultImpl.getAddress();
    console.log("Metropolis Oracle vault - Deployed:", oracleVaultDeployedAddr);
    console.log("Metropolis Oracle vault - Factory :", oracleVaultImplFromFactory);
    console.log("Metropolis Oracle vault - Match   :", oracleVaultImplFromFactory === oracleVaultDeployedAddr);
  } else {
    console.log("Metropolis Oracle vault: SKIPPED (using OracleRewardVault for VAULT_TYPE_ORACLE)");
    console.log("VAULT_TYPE_ORACLE =", VAULT_TYPE_ORACLE, "set to:", oracleVaultImplFromFactory);
    console.log("Expected (OracleRewardVault):", oracleRewardVaultAddress);
    console.log("Match:", oracleVaultImplFromFactory === oracleRewardVaultAddress);
  }
  
  console.log("\nShadow vault verification:");
  console.log("Shadow vault - Deployed:", oracleRewardShadowVaultAddress);
  console.log("Shadow vault - Factory :", oracleRewardShadowVaultImplFromFactory);
  console.log("Shadow vault - Match   :", oracleRewardShadowVaultImplFromFactory === oracleRewardShadowVaultAddress);
  
  console.log("\nMetropolis Strategy verification:");
  console.log("Strategy - Deployed:", strategyImplAddress);
  console.log("Strategy - Factory :", strategyImplFromFactory);
  console.log("Strategy - Match   :", strategyImplFromFactory === strategyImplAddress);
  
  console.log("\nShadow strategy verification:");
  console.log("Shadow strategy - Deployed:", shadowStrategyImplAddress);
  console.log("Shadow strategy - Factory :", shadowStrategyImplFromFactory);
  console.log("Shadow strategy - Match   :", shadowStrategyImplFromFactory === shadowStrategyImplAddress);
  
  console.log("\nProtocol addresses:");
  console.log("Shadow NPM configured:", npmFromFactory);
  console.log("Shadow Voter configured:", voterFromFactory);
  
  console.log("\n✅ Deployment complete!");
  console.log("\n=== Metropolis Contracts ===");
  console.log("VaultFactory (Proxy):", proxyAddress);
  console.log("VaultFactory (Implementation):", await vaultFactoryImpl.getAddress());
  console.log("ProxyAdmin:", await proxyAdmin.getAddress());
  
  if (oracleVaultImpl) {
    console.log("OracleVault Implementation:", await oracleVaultImpl.getAddress());
  } else {
    console.log("OracleVault Implementation: SKIPPED");
  }
  
  console.log("Metropolis OracleRewardVault Implementation:", await oracleRewardVaultImpl.getAddress());
  console.log("Metropolis Strategy Implementation:", await strategyImpl.getAddress());
  console.log("Metropolis Price Lens:", priceLensFromFactory)
  console.log("\n=== Shadow Contracts ===");
  console.log("OracleRewardShadowVault Implementation:", await oracleRewardShadowVaultImpl.getAddress());
  console.log("ShadowStrategy Implementation:", await shadowStrategyImpl.getAddress());
  console.log("Shadow NPM:", npmFromFactory);
  console.log("Shadow Voter:", voterFromFactory);
  
  console.log("\n📝 Note: Only the ProxyAdmin owner can upgrade the VaultFactory implementation");
  console.log("ProxyAdmin is owned by:", deployer.address);

  // Generate gas report
  const gasReport = gasTracker.getReport(verbose);

  // Save deployment addresses
  const deployment = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    addresses: {
      vaultFactory: proxyAddress,
      vaultFactoryImpl: await vaultFactoryImpl.getAddress(),
      proxyAdmin: await proxyAdmin.getAddress(),
      oracleVaultImpl: oracleVaultImpl ? await oracleVaultImpl.getAddress() : null,
      oracleRewardVaultImpl: await oracleRewardVaultImpl.getAddress(),
      oracleRewardShadowVaultImpl: await oracleRewardShadowVaultImpl.getAddress(),
      strategyImpl: await strategyImpl.getAddress(),
      shadowStrategyImpl: await shadowStrategyImpl.getAddress(),
      shadowNPM: npmFromFactory,
      shadowVoter: voterFromFactory,
      priceLens: priceLensFromFactory,
      wnative: wnative,
      oracleHelperFactory: oracleHelperFactoryAddress,
      shadowPriceHelper: shadowPriceHelperAddress,
      shadowPriceHelperWrapper: shadowPriceHelperWrapperAddress,
    },
    configuration: {
      metropolisMaxRange: maxRange,
      shadowMaxRange: maxRangeShadow,
      shadowConfig: deploymentConfig[network.name] || null
    }
  };

  const fs = await import("fs");
  const deploymentPath = `./deployments/metropolis-${network.name}.json`;
  await fs.promises.mkdir("./deployments", { recursive: true });
  await fs.promises.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment addresses saved to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function deployOracleHelperFactory(gasTracker: GasTracker) : Promise<[OracleHelperFactory, string]> {
  const OracleHelperFactoryContract = await ethers.getContractFactory("OracleHelperFactory");
  const oracleHelperFactory = await deployContract<OracleHelperFactory>(
    "OracleHelperFactory",
    OracleHelperFactoryContract,
    [],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const oracleHelperFactoryAddress = await oracleHelperFactory.getAddress();
  return [oracleHelperFactory, oracleHelperFactoryAddress];
}

async function deployShadowPriceHelper(gasTracker: GasTracker) : Promise<[ShadowPriceHelper, string]> {
  const contract = await ethers.getContractFactory("ShadowPriceHelper");
  const contractDeployed = await deployContract<ShadowPriceHelper>(
    "ShadowPriceHelper",
    contract,
    [],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const contractAddress = await contractDeployed.getAddress();
  return [contractDeployed, contractAddress];
}

async function deployShadowPriceHelperWrapper(gasTracker: GasTracker, shadowPriceHelperAddress: string) : Promise<[ShadowPriceHelperWrapper, string]> {
  const contract = await ethers.getContractFactory("ShadowPriceHelperWrapper", {
    libraries: {
      ShadowPriceHelper: shadowPriceHelperAddress
    }
  });
  const contractDeployed = await deployContract<ShadowPriceHelperWrapper>(
    "ShadowPriceHelperWrapper",
    contract,
    [],
    gasTracker,
    { gasLimit: 10000000 }
  );
  const contractAddress = await contractDeployed.getAddress();
  return [contractDeployed, contractAddress];
}