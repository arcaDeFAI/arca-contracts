import { ethers, upgrades } from "hardhat";

async function deployVaultContracts() {
  console.log("\n🚀 Deploying Vault Contracts for TEST1-USDC\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} S\n`);
  
  // Our existing addresses
  const addresses = {
    test1: "0x46e6B680eBae63e086e6D820529Aed187465aeDA",
    usdc: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
    registry: "0x1D134fBA4456F9F1130dFc7d1b5C379a4C8abbb8",
    queueHandlerBeacon: "0xB6DB386354c1a74F5071B90B087db57c7C350Ac6",
    feeManagerBeacon: "0x7a075c7496c96AE220833aEA019EA1c9695d0685",
    lbRouter: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
    lbFactory: "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7",
    metroToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
    lbPair: "0xc1603bA905f4E268CDf451591eF51bdFb1185EEB",
    feeRecipient: "0x6daF0A44419201a00d8364bbE57e6Ca7B4dC0A98"
  };
  
  const deployedContracts: any = {};
  
  try {
    // Step 1: Deploy Queue Handler (Beacon Proxy)
    console.log("=== Step 1: Deploying Queue Handler ===");
    const QueueHandlerFactory = await ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandler = await upgrades.deployBeaconProxy(
      addresses.queueHandlerBeacon,
      QueueHandlerFactory,
      []
    );
    await queueHandler.waitForDeployment();
    deployedContracts.queueHandler = await queueHandler.getAddress();
    console.log(`✅ Queue Handler deployed to: ${deployedContracts.queueHandler}`);
    
    // Step 2: Deploy Fee Manager (Beacon Proxy)
    console.log("\n=== Step 2: Deploying Fee Manager ===");
    const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManager = await upgrades.deployBeaconProxy(
      addresses.feeManagerBeacon,
      FeeManagerFactory,
      [addresses.feeRecipient]
    );
    await feeManager.waitForDeployment();
    deployedContracts.feeManager = await feeManager.getAddress();
    console.log(`✅ Fee Manager deployed to: ${deployedContracts.feeManager}`);
    console.log(`   Fee Recipient: ${addresses.feeRecipient}`);
    
    // Step 3: Deploy Reward Claimer (UUPS Proxy)
    console.log("\n=== Step 3: Deploying Reward Claimer ===");
    const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1");
    
    // For testnet, we'll use a simplified setup without swap paths
    const rewardClaimer = await upgrades.deployProxy(
      RewardClaimerFactory,
      [
        ethers.ZeroAddress, // rewarder (will be set later when we have one)
        addresses.metroToken,
        deployedContracts.feeManager,
        addresses.test1, // native token (wS equivalent)
        addresses.lbPair,
        addresses.lbPair, // lpAMM (same as lbPair for now)
        addresses.lbPair, // lbpContractUSD (simplified)
        addresses.lbRouter,
        5, // idSlippage
        addresses.test1,
        addresses.usdc
      ],
      { kind: 'uups' }
    );
    await rewardClaimer.waitForDeployment();
    deployedContracts.rewardClaimer = await rewardClaimer.getAddress();
    console.log(`✅ Reward Claimer deployed to: ${deployedContracts.rewardClaimer}`);
    
    // Step 4: Deploy Main Vault (UUPS Proxy)
    console.log("\n=== Step 4: Deploying Main Vault ===");
    const VaultFactory = await ethers.getContractFactory("ArcaTestnetV1");
    
    const vault = await upgrades.deployProxy(
      VaultFactory,
      [
        addresses.test1,
        addresses.usdc,
        25, // binStep
        ethers.parseEther("0.01"), // minAmountX
        ethers.parseUnits("0.01", 6), // minAmountY (USDC has 6 decimals)
        addresses.lbRouter,
        addresses.lbPair, // lbpAMM
        addresses.lbPair, // lbpContract
        deployedContracts.rewardClaimer,
        deployedContracts.queueHandler,
        deployedContracts.feeManager
      ],
      { kind: 'uups' }
    );
    await vault.waitForDeployment();
    deployedContracts.vault = await vault.getAddress();
    console.log(`✅ Vault deployed to: ${deployedContracts.vault}`);
    
    // Step 5: Transfer Ownership
    console.log("\n=== Step 5: Transferring Ownership ===");
    
    const queueHandlerContract = QueueHandlerFactory.attach(deployedContracts.queueHandler);
    const feeManagerContract = FeeManagerFactory.attach(deployedContracts.feeManager);
    const rewardClaimerContract = RewardClaimerFactory.attach(deployedContracts.rewardClaimer);
    
    await queueHandlerContract.transferOwnership(deployedContracts.vault);
    console.log(`✅ Queue Handler ownership transferred to vault`);
    
    await feeManagerContract.transferOwnership(deployedContracts.vault);
    console.log(`✅ Fee Manager ownership transferred to vault`);
    
    await rewardClaimerContract.transferOwnership(deployedContracts.vault);
    console.log(`✅ Reward Claimer ownership transferred to vault`);
    
    // Step 6: Register in Registry
    console.log("\n=== Step 6: Registering Vault ===");
    const RegistryFactory = await ethers.getContractFactory("ArcaVaultRegistry");
    const registry = RegistryFactory.attach(addresses.registry);
    
    await registry.registerVault(
      deployedContracts.vault,
      deployedContracts.rewardClaimer,
      deployedContracts.queueHandler,
      deployedContracts.feeManager,
      addresses.test1,
      addresses.usdc,
      "Arca TEST1-USDC Vault",
      "ARCA-TEST1-USDC",
      1, // deploymentId
      true // isProxy
    );
    console.log(`✅ Vault registered in registry`);
    
    // Step 7: Summary
    console.log("\n\n=== 🎉 DEPLOYMENT COMPLETE! ===");
    console.log("\nDeployed Contracts:");
    console.log(`├─ Vault: ${deployedContracts.vault}`);
    console.log(`├─ Queue Handler: ${deployedContracts.queueHandler}`);
    console.log(`├─ Fee Manager: ${deployedContracts.feeManager}`);
    console.log(`└─ Reward Claimer: ${deployedContracts.rewardClaimer}`);
    
    console.log("\nUsing Infrastructure:");
    console.log(`├─ TEST1 Token: ${addresses.test1}`);
    console.log(`├─ USDC Token: ${addresses.usdc}`);
    console.log(`├─ LB Pair: ${addresses.lbPair}`);
    console.log(`├─ Registry: ${addresses.registry}`);
    console.log(`└─ Fee Recipient: ${addresses.feeRecipient}`);
    
    console.log("\nView on Explorer:");
    console.log(`- Vault: https://testnet.sonicscan.org/address/${deployedContracts.vault}`);
    console.log(`- LB Pair: https://testnet.sonicscan.org/address/${addresses.lbPair}`);
    
    console.log("\n📝 Next Steps:");
    console.log("1. Add liquidity to the LB pair (via Metropolis UI or vault)");
    console.log("2. Test deposit operations");
    console.log("3. Test rebalance functionality");
    console.log("4. Test withdrawal operations");
    
    // Save deployment info
    const deployment = {
      network: "sonic-testnet",
      timestamp: new Date().toISOString(),
      contracts: deployedContracts,
      infrastructure: addresses,
      vaultConfig: {
        name: "Arca TEST1-USDC Vault",
        symbol: "ARCA-TEST1-USDC",
        tokenX: addresses.test1,
        tokenY: addresses.usdc,
        binStep: 25,
        lbPair: addresses.lbPair
      }
    };
    
    const fs = await import("fs");
    const path = await import("path");
    const deploymentPath = path.join(
      process.cwd(),
      "deployments",
      "sonic-testnet",
      `test1-usdc-vault-${Date.now()}.json`
    );
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log(`\n💾 Deployment saved to: ${deploymentPath}`);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    console.log("\nPartially deployed contracts:", deployedContracts);
    throw error;
  }
}

async function main() {
  try {
    await deployVaultContracts();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();