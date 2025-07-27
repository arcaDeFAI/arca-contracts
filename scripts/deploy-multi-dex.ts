import { ethers, network } from "hardhat";

async function main() {
  console.log(`Deploying Metropolis & Shadow contracts to ${network.name}...`);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Configure parameters based on network
  let wnative: string;

  // NOTE: If you want to re-use a contract for the Oracle Helper Factory, set it here
  // Otherwise, a new one will be deployed (except for hardhat localhost where it's not used)
  let oracleHelperFactoryAddress: string = "0x0000000000000000000000000000000000000000";
  const creationFee = 0n; // Default 0 for testnet
  
  // Shadow protocol addresses configuration
  const shadowConfig: { [key: string]: { npm: string; voter: string } } = {
    "sonic-mainnet": {
      npm: "0x0000000000000000000000000000000000000000", // TODO: Add actual Shadow NPM address
      voter: "0x0000000000000000000000000000000000000000" // TODO: Add actual Shadow Voter address
    },
    "sonic-testnet": {
      npm: "0x0000000000000000000000000000000000000000", // TODO: Add testnet Shadow NPM address
      voter: "0x0000000000000000000000000000000000000000" // TODO: Add testnet Shadow Voter address
    },
    "localhost": {
      npm: "0x0000000000000000000000000000000000000000", // Will be set from mock deployment
      voter: "0x0000000000000000000000000000000000000000" // Will be set from mock deployment
    }
  };
  
  if (network.name === "localhost" || network.name === "hardhat") {
    // For localhost, deploy a mock wS
    console.log("Deploying Mock wS token...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockWS = await MockERC20.deploy("Wrapped Sonic", "wS", 18, deployer.address);
    await mockWS.waitForDeployment();
    wnative = await mockWS.getAddress();
    console.log("Mock wS deployed at:", wnative);
    const mockOracleHelperFactoryContract = await ethers.getContractFactory("OracleHelperFactory");
    const mockOracleHelperFactory = await mockOracleHelperFactoryContract.deploy();
    mockOracleHelperFactory.waitForDeployment();
    oracleHelperFactoryAddress = await mockOracleHelperFactory.getAddress();
  } else if (network.name === "sonic-testnet") {
    // For testnet, use the testnet wS address
    wnative = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // Actual testnet wS
    
    
  } else if (network.name === "sonic-mainnet") {
    // For mainnet, use the mainnet wS address
    wnative = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"; // Actual mainnet wS

    // NOTE: If you want to re-use a contract for the Oracle Helper Factory, set it here
    oracleHelperFactoryAddress = "0x0000000000000000000000000000000000000000";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  if (oracleHelperFactoryAddress == "0x0000000000000000000000000000000000000000") {
    // Deploy OracleHelperFactory
    console.log("Deploying OracleHelperFactory...");
    const OracleHelperFactoryContract = await ethers.getContractFactory("OracleHelperFactory");
    const oracleHelperFactory = await OracleHelperFactoryContract.deploy();
    await oracleHelperFactory.waitForDeployment();
    oracleHelperFactoryAddress = await oracleHelperFactory.getAddress();
    console.log("OracleHelperFactory deployed at:", oracleHelperFactoryAddress);
  }

  // Deploy VaultFactory implementation
  console.log("Deploying VaultFactory implementation...");
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactoryImpl = await VaultFactory.deploy(wnative, oracleHelperFactoryAddress);
  await vaultFactoryImpl.waitForDeployment();
  console.log("VaultFactory implementation deployed at:", await vaultFactoryImpl.getAddress());

  // Deploy ProxyAdmin to control upgrades
  console.log("Deploying ProxyAdmin...");
  const ProxyAdmin = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
  );
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
  await proxyAdmin.waitForDeployment();
  console.log("ProxyAdmin deployed at:", await proxyAdmin.getAddress());

  // Deploy TransparentUpgradeableProxy with ProxyAdmin
  console.log("Deploying VaultFactory proxy...");
  const TransparentUpgradeableProxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy"
  );
  
  // Encode the initialize4 function call
  const initData = VaultFactory.interface.encodeFunctionData("initialize4", [
    deployer.address,
    creationFee
  ]);
  
  const proxy = await TransparentUpgradeableProxy.deploy(
    await vaultFactoryImpl.getAddress(),
    await proxyAdmin.getAddress(),
    initData
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("VaultFactory proxy deployed at:", proxyAddress);

  // Get the VaultFactory interface at the proxy address
  const vaultFactory = VaultFactory.attach(proxyAddress);

  // Deploy implementation contracts
  console.log("Deploying implementation contracts...");
  
  const OracleVault = await ethers.getContractFactory("OracleVault");
  const oracleVaultImpl = await OracleVault.deploy(proxyAddress);
  await oracleVaultImpl.waitForDeployment();
  console.log("OracleVault implementation deployed at:", await oracleVaultImpl.getAddress());

  const OracleRewardVault = await ethers.getContractFactory("OracleRewardVault");
  const oracleRewardVaultImpl = await OracleRewardVault.deploy(proxyAddress);
  await oracleRewardVaultImpl.waitForDeployment();
  console.log("OracleRewardVault implementation deployed at:", await oracleRewardVaultImpl.getAddress());

  const maxRange = 51; // Default max range for Sonic
  const Strategy = await ethers.getContractFactory("Strategy");
  const strategyImpl = await Strategy.deploy(proxyAddress, maxRange);
  await strategyImpl.waitForDeployment();
  console.log("Strategy implementation deployed at:", await strategyImpl.getAddress());

  // Deploy Shadow Strategy implementation
  console.log("Deploying ShadowStrategy implementation...");
  const maxRangeShadow = 887272; // Max tick range for Shadow (from SHADOW_INTEGRATION_PLAN.md)
  const ShadowStrategy = await ethers.getContractFactory("ShadowStrategy");
  const shadowStrategyImpl = await ShadowStrategy.deploy(proxyAddress, maxRangeShadow);
  await shadowStrategyImpl.waitForDeployment();
  console.log("ShadowStrategy implementation deployed at:", await shadowStrategyImpl.getAddress());

  // Set vault and strategy implementations
  console.log("Setting vault and strategy implementations...");
  
  const VAULT_TYPE_ORACLE = 2;
  const STRATEGY_TYPE_DEFAULT = 1;
  const STRATEGY_TYPE_SHADOW = 2;

  const tx1 = await vaultFactory.setVaultImplementation(VAULT_TYPE_ORACLE, await oracleRewardVaultImpl.getAddress());
  await tx1.wait();
  console.log("Oracle vault implementation set");

  const tx2 = await vaultFactory.setStrategyImplementation(STRATEGY_TYPE_DEFAULT, await strategyImpl.getAddress());
  await tx2.wait();
  console.log("Strategy implementation set");

  const tx3 = await vaultFactory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, await shadowStrategyImpl.getAddress());
  await tx3.wait();
  console.log("Shadow strategy implementation set");

  // Configure Shadow protocol addresses
  if (shadowConfig[network.name]) {
    console.log("Configuring Shadow protocol addresses...");
    
    const { npm, voter } = shadowConfig[network.name];
    
    if (npm !== "0x0000000000000000000000000000000000000000") {
      const tx4 = await vaultFactory.setShadowNonfungiblePositionManager(npm);
      await tx4.wait();
      console.log("Shadow NPM address set:", npm);
    } else {
      console.log("⚠️  Warning: Shadow NPM address not configured for", network.name);
    }

    if (voter !== "0x0000000000000000000000000000000000000000") {
      const tx5 = await vaultFactory.setShadowVoter(voter);
      await tx5.wait();
      console.log("Shadow Voter address set:", voter);
    } else {
      console.log("⚠️  Warning: Shadow Voter address not configured for", network.name);
    }
  }

  // Verify the configuration
  console.log("\nVerifying configuration...");
  const owner = await vaultFactory.owner();
  const oracleVaultImplFromFactory = await vaultFactory.getVaultImplementation(VAULT_TYPE_ORACLE);
  const strategyImplFromFactory = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_DEFAULT);
  const shadowStrategyImplFromFactory = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
  const npmFromFactory = await vaultFactory.getNonfungiblePositionManager();
  const voterFromFactory = await vaultFactory.getShadowVoter();

  console.log("Configuration verified:");
  console.log("Owner:", owner);
  console.log("Oracle vault implementation matches:", oracleVaultImplFromFactory === await oracleRewardVaultImpl.getAddress());
  console.log("Strategy implementation matches:", strategyImplFromFactory === await strategyImpl.getAddress());
  console.log("Shadow strategy implementation matches:", shadowStrategyImplFromFactory === await shadowStrategyImpl.getAddress());
  console.log("Shadow NPM configured:", npmFromFactory);
  console.log("Shadow Voter configured:", voterFromFactory);

  console.log("\n✅ Deployment complete!");
  console.log("\n=== Metropolis Contracts ===");
  console.log("VaultFactory (Proxy):", proxyAddress);
  console.log("VaultFactory (Implementation):", await vaultFactoryImpl.getAddress());
  console.log("ProxyAdmin:", await proxyAdmin.getAddress());
  console.log("OracleVault Implementation:", await oracleVaultImpl.getAddress());
  console.log("OracleRewardVault Implementation:", await oracleRewardVaultImpl.getAddress());
  console.log("Strategy Implementation:", await strategyImpl.getAddress());
  
  console.log("\n=== Shadow Contracts ===");
  console.log("ShadowStrategy Implementation:", await shadowStrategyImpl.getAddress());
  console.log("Shadow NPM:", npmFromFactory);
  console.log("Shadow Voter:", voterFromFactory);
  
  console.log("\n📝 Note: Only the ProxyAdmin owner can upgrade the VaultFactory implementation");
  console.log("ProxyAdmin is owned by:", deployer.address);

  // Save deployment addresses
  const deployment = {
    network: network.name,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    addresses: {
      vaultFactory: proxyAddress,
      vaultFactoryImpl: await vaultFactoryImpl.getAddress(),
      proxyAdmin: await proxyAdmin.getAddress(),
      oracleVaultImpl: await oracleVaultImpl.getAddress(),
      oracleRewardVaultImpl: await oracleRewardVaultImpl.getAddress(),
      strategyImpl: await strategyImpl.getAddress(),
      shadowStrategyImpl: await shadowStrategyImpl.getAddress(),
      shadowNPM: npmFromFactory,
      shadowVoter: voterFromFactory,
      wnative: wnative,
    },
    configuration: {
      metropolisMaxRange: maxRange,
      shadowMaxRange: maxRangeShadow,
      shadowConfig: shadowConfig[network.name] || null
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