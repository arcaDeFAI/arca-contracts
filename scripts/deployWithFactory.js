const { ethers } = require("hardhat");

async function main() {
    console.log("Testing ArcaVaultFactory deployment...");

    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy factory and registry
    console.log("\n1. Deploying ArcaVaultFactory...");
    const VaultFactory = await ethers.getContractFactory("ArcaVaultFactory");
    const factory = await VaultFactory.deploy();
    await factory.waitForDeployment();
    console.log("ArcaVaultFactory deployed to:", await factory.getAddress());

    console.log("\n2. Deploying ArcaVaultRegistry...");
    const VaultRegistry = await ethers.getContractFactory("ArcaVaultRegistry");
    const registry = await VaultRegistry.deploy();
    await registry.waitForDeployment();
    console.log("ArcaVaultRegistry deployed to:", await registry.getAddress());

    // Test deployment process
    console.log("\n3. Testing factory deployment process...");
    
    // Start deployment
    console.log("Starting deployment...");
    const startTx = await factory.startDeployment();
    await startTx.wait();
    console.log("Deployment started");

    // Deploy fee manager
    console.log("Deploying fee manager...");
    const deployFeeManagerTx = await factory.deployFeeManager(deployer.address);
    await deployFeeManagerTx.wait();

    // Deploy queue handler
    console.log("Deploying queue handler...");
    const deployQueueHandlerTx = await factory.deployQueueHandler();
    await deployQueueHandlerTx.wait();

    console.log("\n✅ Factory system test successful!");
    console.log("Stack-too-deep issue resolved with sequential deployment pattern");
    
    return {
        factory: await factory.getAddress(),
        registry: await registry.getAddress()
    };
}

main()
    .then((addresses) => {
        console.log("\nDeployment addresses:", addresses);
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });