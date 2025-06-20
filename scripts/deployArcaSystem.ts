import hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

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

  // Get deployer
  const [deployer]: HardhatEthersSigner[] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Step 1: Deploy beacons for supporting contracts
  console.log("\n=== Step 1: Deploying Beacons ===");
  
  console.log("Deploying QueueHandler beacon...");
  const queueHandlerBeacon = await hre.hre.upgrades.deployBeacon("ArcaQueueHandlerV1");
  await queueHandlerBeacon.waitForDeployment();
  const queueHandlerBeaconAddress = await queueHandlerBeacon.getAddress();
  console.log("QueueHandler beacon deployed to:", queueHandlerBeaconAddress);

  console.log("Deploying FeeManager beacon...");
  const feeManagerBeacon = await hre.upgrades.deployBeacon("ArcaFeeManagerV1");
  await feeManagerBeacon.waitForDeployment();
  const feeManagerBeaconAddress = await feeManagerBeacon.getAddress();
  console.log("FeeManager beacon deployed to:", feeManagerBeaconAddress);

  // Step 2: Deploy beacon proxies for supporting contracts
  console.log("\n=== Step 2: Deploying Beacon Proxies ===");
  
  console.log("Deploying QueueHandler beacon proxy...");
  const queueHandler = await hre.upgrades.deployBeaconProxy(
    queueHandlerBeacon,
    "ArcaQueueHandlerV1",
    []
  );
  await queueHandler.waitForDeployment();
  const queueHandlerAddress = await queueHandler.getAddress();
  console.log("QueueHandler deployed to:", queueHandlerAddress);

  console.log("Deploying FeeManager beacon proxy...");
  const feeManager = await hre.upgrades.deployBeaconProxy(
    feeManagerBeacon,
    "ArcaFeeManagerV1",
    [config.feeRecipient]
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("FeeManager deployed to:", feeManagerAddress);

  // Step 3: Deploy UUPS proxies for core contracts
  console.log("\n=== Step 3: Deploying UUPS Proxies ===");
  
  console.log("Deploying RewardClaimer UUPS proxy...");
  const rewardClaimer = await hre.upgrades.deployProxy(
    "ArcaRewardClaimerV1",
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
  const vault = await hre.upgrades.deployProxy(
    "ArcaTestnetV1",
    [
      config.tokenX,
      config.tokenY,
      config.binStep,
      config.amountXMin,
      config.amountYMin,
      config.name,
      config.symbol,
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

  return addresses;
}

// Example usage for direct script execution
async function main() {
  const mockConfig: DeploymentConfig = {
    tokenX: "0x1234567890123456789012345678901234567890",
    tokenY: "0x0987654321098765432109876543210987654321",
    binStep: 100,
    amountXMin: 1000n,
    amountYMin: 1000n,
    name: "Arca Test Vault",
    symbol: "ARCA-TEST",
    lbRouter: "0x7777777777777777777777777777777777777777",
    lbpAMM: "0x5555555555555555555555555555555555555555",
    lbpContract: "0x4444444444444444444444444444444444444444",
    rewarder: "0x1111111111111111111111111111111111111111",
    rewardToken: "0x2222222222222222222222222222222222222222",
    nativeToken: "0x3333333333333333333333333333333333333333",
    lbpContractUSD: "0x6666666666666666666666666666666666666666",
    idSlippage: 100n,
    feeRecipient: (await hre.ethers.getSigners())[0].address
  };

  try {
    const addresses = await deployArcaSystem(mockConfig);
    console.log("\nDeployment addresses:", JSON.stringify(addresses, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (require.main === module) {
  main();
}