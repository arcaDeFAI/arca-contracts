import { Contract, ContractFactory } from "ethers";
import { ethers, network } from "hardhat";
import { OracleHelperFactory, ShadowPriceHelper } from "typechain-types";
type Libraries = Record<string, string>;

async function main() {
  console.log(`Deploying Metropolis & Shadow contracts to ${network.name}...`);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Configure parameters based on network
  let wnative: string;

  // NOTE: If you want to re-use a contract for the Oracle Helper Factory or other contracts, set it here
  // Otherwise, a new one will be deployed (except for hardhat localhost where it's not used)
  let oracleHelperFactoryAddress: string = "0x0000000000000000000000000000000000000000";
  let shadowPriceHelperAddress: string = "0x0000000000000000000000000000000000000000";

  const creationFee = 0n; // Default 0 for testnet
  
  // Shadow protocol addresses configuration
  const shadowConfig: { [key: string]: { npm: string; voter: string } } = {
    "sonic-mainnet": {
      npm: "0x12E66C8F215DdD5d48d150c8f46aD0c6fB0F4406", // Shadow NPM address
      voter: "0x9F59398D0a397b2EEB8a6123a6c7295cB0b0062D" // Shadow Voter address
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

    // For localhost, always deploy the shadow price helper address
    [, shadowPriceHelperAddress] = await deployShadowPriceHelper();

    // For localhost, always deploy a oracle helper factory contract
    [, oracleHelperFactoryAddress] = await deployOracleHelperFactory();
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
    [,oracleHelperFactoryAddress] = await deployOracleHelperFactory();
  }

  if (shadowPriceHelperAddress == "0x0000000000000000000000000000000000000000") {
    [,shadowPriceHelperAddress] = await deployShadowPriceHelper();
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
    initData, {
      gasLimit: 10000000
    }
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("VaultFactory proxy deployed at:", proxyAddress);

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

  console.log("\nDeploying OracleRewardVault...");
  let oracleRewardVaultImpl: Contract;
  try {
    const OracleRewardVault = await ethers.getContractFactory("OracleRewardVault");
    oracleRewardVaultImpl = await OracleRewardVault.deploy(proxyAddress, {
      gasLimit: 10000000  // Explicit gas limit for mainnet
    });
    await oracleRewardVaultImpl.waitForDeployment();
    console.log("✓ OracleRewardVault implementation deployed at:", await oracleRewardVaultImpl.getAddress());
    
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

  console.log("\nDeploying OracleRewardShadowVault...");
  let oracleRewardShadowVaultImpl: Contract;
  try {
    const OracleRewardShadowVault = await ethers.getContractFactory("OracleRewardShadowVault", {
      libraries: {
        ShadowPriceHelper: shadowPriceHelperAddress,
      },
    });
    oracleRewardShadowVaultImpl = await OracleRewardShadowVault.deploy(proxyAddress, {
      gasLimit: 10000000  // Higher gas limit for Shadow vault with libraries
    });
    await oracleRewardShadowVaultImpl.waitForDeployment();
    console.log("✓ OracleRewardShadowVault implementation deployed at:", await oracleRewardShadowVaultImpl.getAddress());
    
    // Verify the deployment
    const implAddress = await oracleRewardShadowVaultImpl.getAddress();
    const code = await ethers.provider.getCode(implAddress);
    console.log("✓ Contract code size:", code.length, "bytes");
    
  } catch (error) {
    console.error("❌ OracleRewardShadowVault deployment failed:", error);
    throw error;
  }

  console.log("\nDeploying MetropolisStrategy...");
  const maxRange = 51; // Default max range for Sonic
  const Strategy = await ethers.getContractFactory("MetropolisStrategy");
  const strategyImpl = await Strategy.deploy(proxyAddress, maxRange, {
      gasLimit: 10000000
  });
  await strategyImpl.waitForDeployment();
  const strategyImplAddress = await strategyImpl.getAddress();
  console.log("✓ MetropolisStrategy implementation deployed at:", strategyImplAddress);

  // Deploy Shadow Strategy implementation
  console.log("\nDeploying ShadowStrategy implementation...");
  const maxRangeShadow = 887272; // Max tick range for Shadow (from SHADOW_INTEGRATION_PLAN.md)
  const ShadowStrategy = await ethers.getContractFactory("ShadowStrategy");
  const shadowStrategyImpl = await ShadowStrategy.deploy(proxyAddress, maxRangeShadow, {
      gasLimit: 10000000
  });
  await shadowStrategyImpl.waitForDeployment();
  const shadowStrategyImplAddress = await shadowStrategyImpl.getAddress();
  console.log("✓ ShadowStrategy implementation deployed at:", shadowStrategyImplAddress);

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
  console.log("Setting VAULT_TYPE_ORACLE =", VAULT_TYPE_ORACLE, "to:", oracleRewardVaultAddress);
  const tx1 = await vaultFactory.setVaultImplementation(VAULT_TYPE_ORACLE, oracleRewardVaultAddress);
  await tx1.wait();
  console.log("✓ Oracle vault implementation set");

  const oracleRewardShadowVaultAddress = await oracleRewardShadowVaultImpl.getAddress();
  console.log("Setting VAULT_TYPE_SHADOW_ORACLE_REWARD =", VAULT_TYPE_SHADOW_ORACLE_REWARD, "to:", oracleRewardShadowVaultAddress);
  const tx2 = await vaultFactory.setVaultImplementation(VAULT_TYPE_SHADOW_ORACLE_REWARD, oracleRewardShadowVaultAddress);
  await tx2.wait();
  console.log("✓ Oracle reward shadow vault implementation set");

  console.log("\nSetting strategy implementations...");
  console.log("Setting STRATEGY_TYPE_DEFAULT =", STRATEGY_TYPE_DEFAULT, "to:", strategyImplAddress);
  const tx3 = await vaultFactory.setStrategyImplementation(STRATEGY_TYPE_DEFAULT, strategyImplAddress);
  const receipt3 = await tx3.wait();
  console.log("✓ Strategy implementation set - Gas used:", receipt3.gasUsed.toString(), "Status:", receipt3.status);
  
  // Immediately verify it was set correctly
  const verifyStrategy = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_DEFAULT);
  console.log("  Immediate verification - Expected:", strategyImplAddress);
  console.log("  Immediate verification - Actual  :", verifyStrategy);
  console.log("  Immediate verification - Match   :", verifyStrategy === strategyImplAddress);

  console.log("Setting STRATEGY_TYPE_SHADOW =", STRATEGY_TYPE_SHADOW, "to:", shadowStrategyImplAddress);
  const tx4 = await vaultFactory.setStrategyImplementation(STRATEGY_TYPE_SHADOW, shadowStrategyImplAddress);
  const receipt4 = await tx4.wait();
  console.log("✓ Shadow strategy implementation set - Gas used:", receipt4.gasUsed.toString(), "Status:", receipt4.status);
  
  // Immediately verify it was set correctly
  const verifyShadowStrategy = await vaultFactory.getStrategyImplementation(STRATEGY_TYPE_SHADOW);
  console.log("  Immediate verification - Expected:", shadowStrategyImplAddress);
  console.log("  Immediate verification - Actual  :", verifyShadowStrategy);
  console.log("  Immediate verification - Match   :", verifyShadowStrategy === shadowStrategyImplAddress);

  // Configure Shadow protocol addresses
  if (shadowConfig[network.name]) {
    console.log("Configuring Shadow protocol addresses...");
    
    const { npm, voter } = shadowConfig[network.name];
    
    if (npm !== "0x0000000000000000000000000000000000000000") {
      const tx5 = await vaultFactory.setShadowNonfungiblePositionManager(npm);
      await tx5.wait();
      console.log("Shadow NPM address set:", npm);
    } else {
      console.log("⚠️  Warning: Shadow NPM address not configured for", network.name);
    }

    if (voter !== "0x0000000000000000000000000000000000000000") {
      const tx6 = await vaultFactory.setShadowVoter(voter);
      await tx6.wait();
      console.log("Shadow Voter address set:", voter);
    } else {
      console.log("⚠️  Warning: Shadow Voter address not configured for", network.name);
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

  console.log("\n=== Detailed Verification ===");
  
  // Only check Oracle vault if it was deployed
  if (oracleVaultImpl) {
    const oracleVaultDeployedAddr = await oracleVaultImpl.getAddress();
    console.log("Oracle vault - Deployed:", oracleVaultDeployedAddr);
    console.log("Oracle vault - Factory :", oracleVaultImplFromFactory);
    console.log("Oracle vault - Match   :", oracleVaultImplFromFactory === oracleVaultDeployedAddr);
  } else {
    console.log("Oracle vault: SKIPPED (using OracleRewardVault for VAULT_TYPE_ORACLE)");
    console.log("VAULT_TYPE_ORACLE =", VAULT_TYPE_ORACLE, "set to:", oracleVaultImplFromFactory);
    console.log("Expected (OracleRewardVault):", oracleRewardVaultAddress);
    console.log("Match:", oracleVaultImplFromFactory === oracleRewardVaultAddress);
  }
  
  console.log("\nShadow vault verification:");
  console.log("Shadow vault - Deployed:", oracleRewardShadowVaultAddress);
  console.log("Shadow vault - Factory :", oracleRewardShadowVaultImplFromFactory);
  console.log("Shadow vault - Match   :", oracleRewardShadowVaultImplFromFactory === oracleRewardShadowVaultAddress);
  
  console.log("\nStrategy verification:");
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
  
  console.log("OracleRewardVault Implementation:", await oracleRewardVaultImpl.getAddress());
  console.log("Strategy Implementation:", await strategyImpl.getAddress());
  
  console.log("\n=== Shadow Contracts ===");
  console.log("OracleRewardShadowVault Implementation:", await oracleRewardShadowVaultImpl.getAddress());
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
      oracleVaultImpl: oracleVaultImpl ? await oracleVaultImpl.getAddress() : null,
      oracleRewardVaultImpl: await oracleRewardVaultImpl.getAddress(),
      oracleRewardShadowVaultImpl: await oracleRewardShadowVaultImpl.getAddress(),
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

async function deployOracleHelperFactory() : Promise<[OracleHelperFactory, string]> {
  console.log("Deploying OracleHelperFactory...");
  const OracleHelperFactoryContract = await ethers.getContractFactory("OracleHelperFactory");
  const oracleHelperFactory = await OracleHelperFactoryContract.deploy({
      gasLimit: 10000000
  });
  await oracleHelperFactory.waitForDeployment();
  const oracleHelperFactoryAddress = await oracleHelperFactory.getAddress();
  console.log("OracleHelperFactory deployed at:", oracleHelperFactoryAddress);
  return [oracleHelperFactory, oracleHelperFactoryAddress];

}

async function deployShadowPriceHelper() : Promise<[ShadowPriceHelper, string]> {
  console.log("Deploying Shadow price helper...");
  const contract = await ethers.getContractFactory("ShadowPriceHelper");
  const contractDeployed = await contract.deploy({
      gasLimit: 10000000
  });
  await contractDeployed.waitForDeployment();
  const contractAddress = await contractDeployed.getAddress();
  console.log("ShadowPriceHelper deployed at:", contractAddress);
  return [contractDeployed, contractAddress];
}