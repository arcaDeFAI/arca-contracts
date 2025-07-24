 
import hre from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import * as fs from "fs";
import * as path from "path";
import { loadNetworkConfig, networkConfigToDeploymentConfig, validateDeploymentConfig } from "./utils/network-config";
import { deployMockContracts } from "./archive/utils/deploy-mocks";

export interface DeploymentConfig {
  tokenX: string;
  tokenY: string;
  binStep: number;
  amountXMin: bigint;
  amountYMin: bigint;
  name: string;
  symbol: string;
  lbRouter: string;
  lbpAMM: string;
  lbpContract: string;
  rewarder: string;
  rewardToken: string;
  nativeToken: string;
  lbpContractUSD: string;
  idSlippage: bigint;
  feeRecipient: string;
}

export interface DeploymentAddresses {
  vault: string;
  rewardClaimer: string;
  queueHandler: string;
  feeManager: string;
  registry: string;
  beacons: {
    queueHandler: string;
    feeManager: string;
  };
}

export async function deployArcaSystem(config: DeploymentConfig): Promise<DeploymentAddresses> {
  console.log("Deploying Arca Vault System with Proxies...");
  console.log("Network:", hre.network.name);

  // Get deployer
  const [deployer]: HardhatEthersSigner[] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
  
  // Validate configuration
  validateDeploymentConfig(config, hre.network.name);

  // Step 1: Deploy beacons for supporting contracts
  console.log("\n=== Step 1: Deploying Beacons ===");
  
  console.log("Deploying QueueHandler beacon...");
  const QueueHandlerFactory = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
  const queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandlerFactory);
  await queueHandlerBeacon.waitForDeployment();
  const queueHandlerBeaconAddress = await queueHandlerBeacon.getAddress();
  console.log("QueueHandler beacon deployed to:", queueHandlerBeaconAddress);

  console.log("Deploying FeeManager beacon...");
  const FeeManagerFactory = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
  const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManagerFactory);
  await feeManagerBeacon.waitForDeployment();
  const feeManagerBeaconAddress = await feeManagerBeacon.getAddress();
  console.log("FeeManager beacon deployed to:", feeManagerBeaconAddress);

  // Step 2: Deploy beacon proxies for supporting contracts
  console.log("\n=== Step 2: Deploying Beacon Proxies ===");
  
  console.log("Deploying QueueHandler beacon proxy...");
  const queueHandler = await hre.upgrades.deployBeaconProxy(
    queueHandlerBeacon,
    QueueHandlerFactory,
    []
  );
  await queueHandler.waitForDeployment();
  const queueHandlerAddress = await queueHandler.getAddress();
  console.log("QueueHandler deployed to:", queueHandlerAddress);

  console.log("Deploying FeeManager beacon proxy...");
  const feeManager = await hre.upgrades.deployBeaconProxy(
    feeManagerBeacon,
    FeeManagerFactory,
    [config.feeRecipient]
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("FeeManager deployed to:", feeManagerAddress);

  // Step 3: Deploy UUPS proxies for core contracts
  console.log("\n=== Step 3: Deploying UUPS Proxies ===");
  
  console.log("Deploying RewardClaimer UUPS proxy...");
  const RewardClaimerFactory = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
  const rewardClaimer = await hre.upgrades.deployProxy(
    RewardClaimerFactory,
    [
      config.rewarder,
      config.rewardToken,
      feeManagerAddress,
      config.nativeToken,
      config.lbpContract,
      config.lbpAMM,
      config.lbpContractUSD,
      config.lbRouter,
      config.idSlippage,
      config.tokenX,
      config.tokenY
    ],
    { kind: 'uups' }
  );
  await rewardClaimer.waitForDeployment();
  const rewardClaimerAddress = await rewardClaimer.getAddress();
  console.log("RewardClaimer deployed to:", rewardClaimerAddress);

  console.log("Deploying main Vault UUPS proxy...");
  const VaultFactory = await hre.ethers.getContractFactory("ArcaTestnetV1");
  const vault = await hre.upgrades.deployProxy(
    VaultFactory,
    [
      config.tokenX,
      config.tokenY,
      config.binStep,
      config.amountXMin,
      config.amountYMin,
      config.lbRouter,
      config.lbpAMM,
      config.lbpContract,
      rewardClaimerAddress,
      queueHandlerAddress,
      feeManagerAddress
    ],
    { kind: 'uups' }
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Vault deployed to:", vaultAddress);

  // Step 4: Transfer ownership of supporting contracts to vault
  console.log("\n=== Step 4: Transferring Ownership ===");
  
  console.log("Transferring QueueHandler ownership...");
  await queueHandler.transferOwnership(vaultAddress);
  
  console.log("Transferring FeeManager ownership...");
  await feeManager.transferOwnership(vaultAddress);
  
  console.log("Transferring RewardClaimer ownership...");
  await rewardClaimer.transferOwnership(vaultAddress);

  // Step 5: Deploy Registry and register the vault
  console.log("\n=== Step 5: Deploying Registry ===");
  
  const VaultRegistry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
  const registry = await VaultRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("Registry deployed to:", registryAddress);

  console.log("Registering vault in registry...");
  await registry.registerVault(
    vaultAddress,
    rewardClaimerAddress,
    queueHandlerAddress,
    feeManagerAddress,
    config.tokenX,
    config.tokenY,
    config.name,
    config.symbol,
    1, // deploymentId
    true // isProxy
  );

  const addresses: DeploymentAddresses = {
    vault: vaultAddress,
    rewardClaimer: rewardClaimerAddress,
    queueHandler: queueHandlerAddress,
    feeManager: feeManagerAddress,
    registry: registryAddress,
    beacons: {
      queueHandler: queueHandlerBeaconAddress,
      feeManager: feeManagerBeaconAddress
    }
  };

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("QueueHandler Beacon:", queueHandlerBeaconAddress);
  console.log("FeeManager Beacon:", feeManagerBeaconAddress);
  console.log("QueueHandler Proxy:", queueHandlerAddress);
  console.log("FeeManager Proxy:", feeManagerAddress);
  console.log("RewardClaimer UUPS:", rewardClaimerAddress);
  console.log("Main Vault UUPS:", vaultAddress);
  console.log("Registry:", registryAddress);
  
  console.log("\n✅ Proxy deployment system working successfully!");
  console.log("All contracts are now upgradeable through OpenZeppelin proxy patterns");

  // Save deployment artifacts
  await saveDeploymentArtifacts(addresses, config);

  return addresses;
}

async function saveDeploymentArtifacts(addresses: DeploymentAddresses, config: DeploymentConfig) {
  const network = hre.network.name;
  const timestamp = new Date().toISOString();
  const deploymentsDir = path.join(__dirname, "../deployments", network);
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Create deployment record with BigInt serialization
  const deployment = {
    network,
    timestamp,
    deployer: (await hre.ethers.getSigners())[0].address,
    addresses,
    config: {
      ...config,
      // Convert BigInt values to strings for JSON serialization
      amountXMin: config.amountXMin.toString(),
      amountYMin: config.amountYMin.toString(),
      idSlippage: config.idSlippage.toString(),
      binStep: config.binStep.toString()
    },
    contractVersions: {
      vault: "ArcaTestnetV1",
      rewardClaimer: "ArcaRewardClaimerV1",
      queueHandler: "ArcaQueueHandlerV1",
      feeManager: "ArcaFeeManagerV1",
      registry: "ArcaVaultRegistry"
    }
  };
  
  // Save to timestamped file
  const filename = `deployment-${timestamp.replace(/:/g, "-")}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  
  // Also save as latest
  const latestPath = path.join(deploymentsDir, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(deployment, null, 2));
  
  console.log(`\n📁 Deployment artifacts saved to: ${filepath}`);
}

// Main function with network configuration support
async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Starting deployment on ${network}...`);
  
  try {
    // Get deployer
    const [deployer]: HardhatEthersSigner[] = await hre.ethers.getSigners();
    
    // Load network configuration
    const networkConfig = loadNetworkConfig(network);
    let deploymentConfig = networkConfigToDeploymentConfig(networkConfig);
    
    // For localhost, deploy mocks first
    if (network === "localhost" || network === "hardhat") {
      console.log("\n📦 Setting up mock contracts for local testing...");
      const mockContracts = await deployMockContracts(
        deployer,
        networkConfig.mockTokens!,
        networkConfig.testAccounts!
      );
      
      // Update deployment config with mock addresses
      deploymentConfig = {
        ...deploymentConfig,
        tokenX: mockContracts.tokenX,
        tokenY: mockContracts.tokenY,
        rewardToken: mockContracts.rewardToken,
        lbRouter: mockContracts.lbRouter,
        lbpAMM: mockContracts.lbpAMM,
        lbpContract: mockContracts.lbpContract,
        rewarder: mockContracts.rewarder,
        nativeToken: mockContracts.nativeToken,
        lbpContractUSD: mockContracts.lbpContractUSD
      };
    }
    
    // Deploy Arca system
    const addresses = await deployArcaSystem(deploymentConfig);
    
    console.log("\n✅ Deployment completed successfully!");
    console.log("\nDeployment addresses:", JSON.stringify(addresses, null, 2));
    
    // For testnet/mainnet, provide verification command
    if (network !== "localhost" && network !== "hardhat") {
      console.log("\n📝 To verify contracts, run:");
      console.log(`npx hardhat verify --network ${network} ${addresses.vault}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}