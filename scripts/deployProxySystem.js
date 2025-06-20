const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Deploying Arca Vault System with Proxies...");

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

    // Step 1: Deploy beacons for supporting contracts
    console.log("\n=== Step 1: Deploying Beacons ===");
    
    console.log("Deploying QueueHandler beacon...");
    const queueHandlerBeacon = await upgrades.deployBeacon("ArcaQueueHandlerV1");
    await queueHandlerBeacon.waitForDeployment();
    const queueHandlerBeaconAddress = await queueHandlerBeacon.getAddress();
    console.log("QueueHandler beacon deployed to:", queueHandlerBeaconAddress);

    console.log("Deploying FeeManager beacon...");
    const feeManagerBeacon = await upgrades.deployBeacon("ArcaFeeManagerV1");
    await feeManagerBeacon.waitForDeployment();
    const feeManagerBeaconAddress = await feeManagerBeacon.getAddress();
    console.log("FeeManager beacon deployed to:", feeManagerBeaconAddress);

    // Step 2: Deploy beacon proxies for supporting contracts
    console.log("\n=== Step 2: Deploying Beacon Proxies ===");
    
    console.log("Deploying QueueHandler beacon proxy...");
    const queueHandler = await upgrades.deployBeaconProxy(
        queueHandlerBeacon,
        "ArcaQueueHandlerV1",
        []
    );
    await queueHandler.waitForDeployment();
    const queueHandlerAddress = await queueHandler.getAddress();
    console.log("QueueHandler deployed to:", queueHandlerAddress);

    console.log("Deploying FeeManager beacon proxy...");
    const feeManager = await upgrades.deployBeaconProxy(
        feeManagerBeacon,
        "ArcaFeeManagerV1",
        [deployer.address] // Fee recipient
    );
    await feeManager.waitForDeployment();
    const feeManagerAddress = await feeManager.getAddress();
    console.log("FeeManager deployed to:", feeManagerAddress);

    // Step 3: Deploy UUPS proxies for core contracts
    console.log("\n=== Step 3: Deploying UUPS Proxies ===");
    
    // Mock parameters for testing
    const mockTokenX = "0x1234567890123456789012345678901234567890";
    const mockTokenY = "0x0987654321098765432109876543210987654321";
    const mockRewarder = "0x1111111111111111111111111111111111111111";
    const mockRewardToken = "0x2222222222222222222222222222222222222222";
    const mockNativeToken = "0x3333333333333333333333333333333333333333";
    const mockLbpContract = "0x4444444444444444444444444444444444444444";
    const mockLpAMM = "0x5555555555555555555555555555555555555555";
    const mockLbpContractUSD = "0x6666666666666666666666666666666666666666";
    const mockLbRouter = "0x7777777777777777777777777777777777777777";
    
    console.log("Deploying RewardClaimer UUPS proxy...");
    const rewardClaimer = await upgrades.deployProxy(
        "ArcaRewardClaimerV1",
        [
            mockRewarder,
            mockRewardToken,
            feeManagerAddress,
            mockNativeToken,
            mockLbpContract,
            mockLpAMM,
            mockLbpContractUSD,
            mockLbRouter,
            100, // idSlippage
            mockTokenX,
            mockTokenY
        ],
        { kind: 'uups' }
    );
    await rewardClaimer.waitForDeployment();
    const rewardClaimerAddress = await rewardClaimer.getAddress();
    console.log("RewardClaimer deployed to:", rewardClaimerAddress);

    console.log("Deploying main Vault UUPS proxy...");
    const vault = await upgrades.deployProxy(
        "ArcaTestnetV1",
        [
            mockTokenX,
            mockTokenY,
            100, // binStep
            1000, // amountXMin
            1000, // amountYMin
            "Arca Test Vault",
            "ARCA-TEST",
            mockLbRouter,
            mockLpAMM,
            mockLbpContract,
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
    
    const VaultRegistry = await ethers.getContractFactory("ArcaVaultRegistry");
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
        mockTokenX,
        mockTokenY,
        "Arca Test Vault",
        "ARCA-TEST",
        1, // deploymentId
        true // isProxy
    );

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

    return {
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
}

main()
    .then((addresses) => {
        console.log("\nDeployment addresses:", JSON.stringify(addresses, null, 2));
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });