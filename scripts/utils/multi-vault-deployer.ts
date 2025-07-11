import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { NetworkConfig, VaultConfig } from "../types/config";
import { getEnabledVaults } from "../types/config";
import type { DeployedToken } from "./token-deployer";
import { deployAllTokens, deploySpecificTokens, deployMockToken } from "./token-deployer";
import type { DeployedLBPair } from "./lb-pair-manager";
import { getOrCreateLBPair, addInitialLiquidity, deployMockLBRouter, deployMockLBFactory } from "./lb-pair-manager";
import type { DeploymentAddresses} from "../deployArcaSystem";
import { DeploymentConfig } from "../deployArcaSystem";
import fs from "fs";
import path from "path";

export interface SharedInfrastructure {
  registry: string;
  queueHandlerBeacon: string;
  feeManagerBeacon: string;
  lbRouter: string;
  lbFactory: string;
}

export interface VaultDeployment {
  vaultId: string;
  addresses: DeploymentAddresses;
  tokenX: string;
  tokenY: string;
  lbPair: string;
}

export interface MultiVaultDeploymentResult {
  sharedInfrastructure: SharedInfrastructure;
  tokens: Map<string, DeployedToken>;
  lbPairs: Map<string, DeployedLBPair>;
  vaults: Map<string, VaultDeployment>;
}

import type { TokenConfig } from "../types/config";
import { IERC20, MockERC20 } from "typechain-types";

export interface DeploymentProgress {
  network: string;
  timestamp: number;
  sharedInfrastructure?: SharedInfrastructure;
  deployedTokens: Record<string, string>; // symbol -> address
  deployedLBPairs: Record<string, string>; // vaultId -> pairAddress
  deployedVaults: string[]; // List of completed vault IDs
  failedVaults: string[]; // List of failed vault IDs
}

/**
 * Deploy shared infrastructure that is used across all vaults
 */
async function deploySharedInfrastructure(
  deployer: HardhatEthersSigner,
  networkConfig: NetworkConfig
): Promise<SharedInfrastructure> {
  console.log("\n🏗️  Deploying shared infrastructure...");

  // Deploy Registry (only one for all vaults)
  console.log("Deploying Vault Registry...");
  const VaultRegistry = await ethers.getContractFactory("ArcaVaultRegistry", deployer);
  const registry = await VaultRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✓ Registry deployed to:", registryAddress);

  // Deploy beacons (shared across all vaults)
  console.log("\nDeploying shared beacons...");
  
  const QueueHandlerFactory = await ethers.getContractFactory("ArcaQueueHandlerV1", deployer);
  const queueHandlerBeacon = await upgrades.deployBeacon(QueueHandlerFactory);
  await queueHandlerBeacon.waitForDeployment();
  const queueHandlerBeaconAddress = await queueHandlerBeacon.getAddress();
  console.log("✓ QueueHandler beacon deployed to:", queueHandlerBeaconAddress);

  const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1", deployer);
  const feeManagerBeacon = await upgrades.deployBeacon(FeeManagerFactory);
  await feeManagerBeacon.waitForDeployment();
  const feeManagerBeaconAddress = await feeManagerBeacon.getAddress();
  console.log("✓ FeeManager beacon deployed to:", feeManagerBeaconAddress);

  // Deploy or get LB Router
  let lbRouter: string;
  if (networkConfig.sharedContracts.lbRouter === "DEPLOY_MOCK") {
    lbRouter = await deployMockLBRouter(deployer);
  } else {
    lbRouter = networkConfig.sharedContracts.lbRouter;
    console.log(`✓ Using existing LB Router at: ${lbRouter}`);
  }

  // Deploy or get LB Factory
  let lbFactory: string;
  if (networkConfig.sharedContracts.lbFactory === "DEPLOY_MOCK") {
    lbFactory = await deployMockLBFactory(deployer);
  } else {
    lbFactory = networkConfig.sharedContracts.lbFactory;
    console.log(`✓ Using existing LB Factory at: ${lbFactory}`);
  }

  return {
    registry: registryAddress,
    queueHandlerBeacon: queueHandlerBeaconAddress,
    feeManagerBeacon: feeManagerBeaconAddress,
    lbRouter,
    lbFactory
  };
}

/**
 * Get rewarder address from LB Pair hooks parameters
 */
async function getRewarderFromLBPair(
  lbPairAddress: string,
  deployer: HardhatEthersSigner,
  networkName: string
): Promise<string> {
  // For mock environments, always return zero address
  if (networkName === "localhost" || networkName === "hardhat") {
    return ethers.ZeroAddress;
  }

  try {
    // Get the LB Pair contract
    const lbPairContract = await ethers.getContractAt("lib/joe-v2/src/interfaces/ILBPair.sol:ILBPair", lbPairAddress, deployer);
    
    // Get hooks parameters
    const hooksParameters = await lbPairContract.getLBHooksParameters();
    
    // Extract hooks address from the parameters
    // The hooks address is encoded in the first 160 bits (20 bytes) of the bytes32 value
    // In hex: 0x + 64 chars total, address is last 40 chars
    const hooksAddress = ethers.getAddress(
      "0x" + hooksParameters.slice(-40)
    );
    
    // Only use if not zero address
    if (hooksAddress !== ethers.ZeroAddress) {
      console.log(`✓ Found hooks/rewarder at: ${hooksAddress}`);
      
      // Optionally verify it's a valid rewarder by checking if it has expected functions
      try {
        const rewarder = await ethers.getContractAt("lib/joe-v2/src/interfaces/ILBHooksBaseRewarder.sol:ILBHooksBaseRewarder", hooksAddress, deployer);
        await rewarder.getRewardToken(); // Test call
        return hooksAddress;
      } catch {
        console.log("⚠️  Hooks address doesn't implement ILBHooksBaseRewarder interface");
        return ethers.ZeroAddress;
      }
    } else {
      console.log("⚠️  No hooks/rewarder configured for this LB Pair");
      return ethers.ZeroAddress;
    }
  } catch (error) {
    console.log("⚠️  Failed to get rewarder from LB Pair:", error instanceof Error ? error.message : String(error));
    return ethers.ZeroAddress;
  }
}

/**
 * Deploy a single vault using the shared infrastructure
 */
async function deploySingleVault(
  deployer: HardhatEthersSigner,
  vaultConfig: VaultConfig,
  sharedInfrastructure: SharedInfrastructure,
  tokenX: DeployedToken,
  tokenY: DeployedToken,
  lbPair: DeployedLBPair,
  networkConfig: NetworkConfig
): Promise<DeploymentAddresses> {
  console.log(`\n📦 Deploying vault contracts for ${vaultConfig.id}...`);

  // Deploy beacon proxies for this vault
  console.log("Deploying QueueHandler beacon proxy...");
  const QueueHandlerFactory = await ethers.getContractFactory("ArcaQueueHandlerV1", deployer);
  const queueHandler = await upgrades.deployBeaconProxy(
    sharedInfrastructure.queueHandlerBeacon,
    QueueHandlerFactory,
    []
  );
  await queueHandler.waitForDeployment();
  const queueHandlerAddress = await queueHandler.getAddress();
  console.log("✓ QueueHandler deployed to:", queueHandlerAddress);

  console.log("Deploying FeeManager beacon proxy...");
  const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1", deployer);
  const feeManager = await upgrades.deployBeaconProxy(
    sharedInfrastructure.feeManagerBeacon,
    FeeManagerFactory,
    [vaultConfig.deployment.feeRecipient]
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✓ FeeManager deployed to:", feeManagerAddress);

  // Get rewarder address from LB Pair
  console.log("\nChecking for rewarder...");
  const rewarderAddress = await getRewarderFromLBPair(lbPair.address, deployer, networkConfig.name);

  // Deploy RewardClaimer UUPS proxy
  console.log("\nDeploying RewardClaimer UUPS proxy...");
  const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1", deployer);
  
  // Determine METRO token address
  const metroTokenAddress = networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK"
    ? (tokenX.config.symbol === "METRO" ? tokenX.address : 
       tokenY.config.symbol === "METRO" ? tokenY.address : 
       ethers.ZeroAddress)
    : networkConfig.sharedContracts.metroToken;

  if (metroTokenAddress === ethers.ZeroAddress) {
    console.log("⚠️  Warning: METRO token not found, using zero address");
  }
  
  const rewardClaimer = await upgrades.deployProxy(
    RewardClaimerFactory,
    [
      rewarderAddress,
      metroTokenAddress,
      feeManagerAddress,
      tokenX.address, // Using tokenX as native token
      lbPair.address,
      sharedInfrastructure.lbFactory,
      lbPair.address, // Using same pair for USD pair (simplified)
      sharedInfrastructure.lbRouter,
      BigInt(vaultConfig.deployment.idSlippage),
      tokenX.address,
      tokenY.address
    ],
    { kind: 'uups' }
  );
  await rewardClaimer.waitForDeployment();
  const rewardClaimerAddress = await rewardClaimer.getAddress();
  console.log("✓ RewardClaimer deployed to:", rewardClaimerAddress);

  // Deploy main Vault UUPS proxy
  console.log("\nDeploying main Vault UUPS proxy...");
  const VaultFactory = await ethers.getContractFactory("ArcaTestnetV1", deployer);
  const vault = await upgrades.deployProxy(
    VaultFactory,
    [
      tokenX.address,
      tokenY.address,
      vaultConfig.lbPair.binStep,
      BigInt(vaultConfig.deployment.amountXMin),
      BigInt(vaultConfig.deployment.amountYMin),
      sharedInfrastructure.lbRouter,
      sharedInfrastructure.lbFactory,
      lbPair.address,
      rewardClaimerAddress,
      queueHandlerAddress,
      feeManagerAddress
    ],
    { kind: 'uups' }
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✓ Vault deployed to:", vaultAddress);

  // Transfer ownership of supporting contracts to vault
  console.log("\nTransferring ownership to vault...");
  try {
    await queueHandler.transferOwnership(vaultAddress);
    await feeManager.transferOwnership(vaultAddress);
    await rewardClaimer.transferOwnership(vaultAddress);
    console.log("✓ Ownership transferred successfully");
  } catch (error) {
    console.error("⚠️  Failed to transfer ownership:", error);
    throw new Error(`Ownership transfer failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    vault: vaultAddress,
    rewardClaimer: rewardClaimerAddress,
    queueHandler: queueHandlerAddress,
    feeManager: feeManagerAddress,
    registry: sharedInfrastructure.registry,
    beacons: {
      queueHandler: sharedInfrastructure.queueHandlerBeacon,
      feeManager: sharedInfrastructure.feeManagerBeacon
    }
  };
}

/**
 * Save deployment progress
 */
function saveProgress(networkName: string, progress: DeploymentProgress): void {
  const progressDir = path.join("deployments", networkName);
  const progressFile = path.join(progressDir, "multi-vault-progress.json");

  if (!fs.existsSync(progressDir)) {
    fs.mkdirSync(progressDir, { recursive: true });
  }

  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  console.log(`💾 Progress saved to ${progressFile}`);
}

/**
 * Load deployment progress
 */
function loadProgress(networkName: string): DeploymentProgress | null {
  const progressFile = path.join("deployments", networkName, "multi-vault-progress.json");

  if (!fs.existsSync(progressFile)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(progressFile, "utf8"));
    console.log(`📂 Loaded progress from ${progressFile}`);
    return data;
  } catch (error) {
    console.error(`Failed to load progress: ${error}`);
    return null;
  }
}

/**
 * Main multi-vault deployment function
 */
export async function deployAllVaults(
  deployer: HardhatEthersSigner,
  networkConfig: NetworkConfig,
  options?: {
    vaultIds?: string[];
    resume?: boolean;
  }
): Promise<MultiVaultDeploymentResult> {
  console.log("\n🚀 Starting multi-vault deployment...");
  console.log(`Network: ${networkConfig.name}`);
  console.log(`Deployer: ${deployer.address}`);

  // Validate network configuration
  const enabledVaults = getEnabledVaults(networkConfig);
  if (enabledVaults.length === 0) {
    throw new Error("No enabled vaults found in configuration");
  }

  let progress: DeploymentProgress | null = null;

  // Load progress if resuming
  if (options?.resume) {
    progress = loadProgress(networkConfig.name);
    if (progress) {
      console.log(`✓ Resuming from previous deployment (${progress.deployedVaults.length} vaults completed)`);
    } else {
      console.log("⚠️  No previous progress found, starting fresh");
    }
  }

  // Initialize progress if not loaded
  if (!progress) {
    progress = {
      network: networkConfig.name,
      timestamp: Date.now(),
      deployedTokens: {},
      deployedLBPairs: {},
      deployedVaults: [],
      failedVaults: []
    };
  }

  const result: MultiVaultDeploymentResult = {
    sharedInfrastructure: {} as SharedInfrastructure,
    tokens: new Map(),
    lbPairs: new Map(),
    vaults: new Map()
  };

  try {
    // Step 1: Deploy shared infrastructure
    if (!progress.sharedInfrastructure) {
      console.log("\n=== Step 1: Deploying Shared Infrastructure ===");
      progress.sharedInfrastructure = await deploySharedInfrastructure(deployer, networkConfig);
      saveProgress(networkConfig.name, progress);
    } else {
      console.log("\n✓ Using existing shared infrastructure from progress");
    }
    result.sharedInfrastructure = progress.sharedInfrastructure;

    // Step 2: Deploy or restore tokens
    console.log("\n=== Step 2: Setting up Tokens ===");
    
    // Check if we have tokens from previous progress
    if (progress.deployedTokens && Object.keys(progress.deployedTokens).length > 0) {
      console.log("Restoring tokens from previous deployment...");
      
      // Restore tokens from progress
      for (const [symbol, address] of Object.entries(progress.deployedTokens)) {
        const contract = await ethers.getContractAt("MockERC20", address, deployer);
        
        // Find token config from network config
        let tokenConfig: TokenConfig | undefined;
        for (const vault of networkConfig.vaults) {
          if (vault.tokens.tokenX.symbol === symbol) {
            tokenConfig = vault.tokens.tokenX;
            break;
          }
          if (vault.tokens.tokenY.symbol === symbol) {
            tokenConfig = vault.tokens.tokenY;
            break;
          }
        }
        
        // Check shared tokens
        if (!tokenConfig && symbol === "METRO" && networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK") {
          tokenConfig = {
            address: "DEPLOY_MOCK",
            symbol: "METRO",
            name: "Metropolis",
            decimals: 18,
            deployMock: true
          };
        }
        
        if (tokenConfig) {
          result.tokens.set(symbol, {
            address,
            contract: contract,
            config: tokenConfig
          });
          console.log(`✓ Restored ${symbol} at ${address}`);
        }
      }
      
      // Check if we need to deploy any new tokens
      const requiredTokens = new Set<string>();
      
      // Collect required token symbols - including existing tokens
      for (const vault of getEnabledVaults(networkConfig)) {
        // Add tokenX - whether it needs deployment or just tracking
        requiredTokens.add(vault.tokens.tokenX.symbol);
        // Add tokenY - whether it needs deployment or just tracking  
        requiredTokens.add(vault.tokens.tokenY.symbol);
      }
      
      // Add METRO if needed
      if (networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK") {
        requiredTokens.add("METRO");
      }
      
      // Deploy only missing tokens
      const missingTokens = Array.from(requiredTokens).filter(symbol => !result.tokens.has(symbol));
      
      if (missingTokens.length > 0) {
        console.log(`\nDeploying ${missingTokens.length} missing token(s): ${missingTokens.join(", ")}`);
        
        // Deploy or get missing tokens
        for (const symbol of missingTokens) {
          let handled = false;
          
          // Check if it's defined in vault configs with existing address
          for (const vault of getEnabledVaults(networkConfig)) {
            if (vault.tokens.tokenX.symbol === symbol && vault.tokens.tokenX.address !== "DEPLOY_MOCK") {
              const contract = await ethers.getContractAt("MockERC20", vault.tokens.tokenX.address, deployer);
              result.tokens.set(symbol, {
                address: vault.tokens.tokenX.address,
                contract: contract,
                config: vault.tokens.tokenX
              });
              progress.deployedTokens[symbol] = vault.tokens.tokenX.address;
              console.log(`✓ Using existing ${symbol} at ${vault.tokens.tokenX.address}`);
              handled = true;
              break;
            }
            if (vault.tokens.tokenY.symbol === symbol && vault.tokens.tokenY.address !== "DEPLOY_MOCK") {
              const contract = await ethers.getContractAt("MockERC20", vault.tokens.tokenY.address, deployer);
              result.tokens.set(symbol, {
                address: vault.tokens.tokenY.address,
                contract: contract,
                config: vault.tokens.tokenY
              });
              progress.deployedTokens[symbol] = vault.tokens.tokenY.address;
              console.log(`✓ Using existing ${symbol} at ${vault.tokens.tokenY.address}`);
              handled = true;
              break;
            }
          }
          
          // If not handled and needs deployment, deploy it
          if (!handled) {
            const newlyDeployedTokens = await deploySpecificTokens(deployer, networkConfig, [symbol]);
            const token = newlyDeployedTokens.get(symbol);
            if (token) {
              progress.deployedTokens[symbol] = token.address;
              result.tokens.set(symbol, token);
            }
          }
        }
        
        saveProgress(networkConfig.name, progress);
      } else {
        console.log("✓ All required tokens already deployed");
      }
    } else {
      // Fresh deployment - deploy or track all tokens
      console.log("Setting up tokens...");
      
      // Process each vault's tokens
      for (const vault of getEnabledVaults(networkConfig)) {
        // Handle tokenX
        if (!result.tokens.has(vault.tokens.tokenX.symbol)) {
          if (vault.tokens.tokenX.deployMock && vault.tokens.tokenX.address === "DEPLOY_MOCK") {
            // Deploy mock token
            const token = await deployMockToken(deployer, vault.tokens.tokenX, networkConfig.name);
            result.tokens.set(vault.tokens.tokenX.symbol, token);
            progress.deployedTokens[vault.tokens.tokenX.symbol] = token.address;
          } else if (vault.tokens.tokenX.address !== "DEPLOY_MOCK") {
            // Use existing token
            const contract = await ethers.getContractAt("MockERC20", vault.tokens.tokenX.address, deployer);
            result.tokens.set(vault.tokens.tokenX.symbol, {
              address: vault.tokens.tokenX.address,
              contract: contract,
              config: vault.tokens.tokenX
            });
            progress.deployedTokens[vault.tokens.tokenX.symbol] = vault.tokens.tokenX.address;
            console.log(`✓ Using existing ${vault.tokens.tokenX.symbol} at ${vault.tokens.tokenX.address}`);
          }
        }
        
        // Handle tokenY
        if (!result.tokens.has(vault.tokens.tokenY.symbol)) {
          if (vault.tokens.tokenY.deployMock && vault.tokens.tokenY.address === "DEPLOY_MOCK") {
            // Deploy mock token
            const token = await deployMockToken(deployer, vault.tokens.tokenY, networkConfig.name);
            result.tokens.set(vault.tokens.tokenY.symbol, token);
            progress.deployedTokens[vault.tokens.tokenY.symbol] = token.address;
          } else if (vault.tokens.tokenY.address !== "DEPLOY_MOCK") {
            // Use existing token
            const contract = await ethers.getContractAt("MockERC20", vault.tokens.tokenY.address, deployer);
            result.tokens.set(vault.tokens.tokenY.symbol, {
              address: vault.tokens.tokenY.address,
              contract: contract,
              config: vault.tokens.tokenY
            });
            progress.deployedTokens[vault.tokens.tokenY.symbol] = vault.tokens.tokenY.address;
            console.log(`✓ Using existing ${vault.tokens.tokenY.symbol} at ${vault.tokens.tokenY.address}`);
          }
        }
      }
      
      // Handle METRO token if needed
      if (networkConfig.sharedContracts.metroToken === "DEPLOY_MOCK" && !result.tokens.has("METRO")) {
        const metroConfig: TokenConfig = {
          address: "DEPLOY_MOCK",
          symbol: "METRO",
          name: "Metropolis",
          decimals: 18,
          deployMock: true
        };
        const metroToken = await deployMockToken(deployer, metroConfig, networkConfig.name);
        result.tokens.set("METRO", metroToken);
        progress.deployedTokens["METRO"] = metroToken.address;
      }
      
      saveProgress(networkConfig.name, progress);
    }

    // Restore LB pairs from progress
    if (progress.deployedLBPairs && Object.keys(progress.deployedLBPairs).length > 0) {
      console.log("\nRestoring LB pairs from previous deployment...");
      for (const [vaultId, pairAddress] of Object.entries(progress.deployedLBPairs)) {
        // Find the vault config to get bin step
        const vaultConfig = networkConfig.vaults.find(v => v.id === vaultId);
        if (vaultConfig) {
          result.lbPairs.set(vaultId, {
            address: pairAddress,
            binStep: vaultConfig.lbPair.binStep,
            isNew: false,
            tokenX: vaultConfig.tokens.tokenX.address,
            tokenY: vaultConfig.tokens.tokenY.address
          });
          console.log(`✓ Restored LB pair for ${vaultId} at ${pairAddress}`);
        }
      }
    }
    
    // Step 3: Deploy vaults
    console.log("\n=== Step 3: Deploying Vaults ===");
    
    // Filter vaults to deploy
    let vaultsToDeploy = enabledVaults;
    
    // Filter by vault IDs if specified
    if (options?.vaultIds && options.vaultIds.length > 0) {
      vaultsToDeploy = vaultsToDeploy.filter(v => options.vaultIds!.includes(v.id));
    }

    // Skip already completed vaults
    vaultsToDeploy = vaultsToDeploy.filter(v => !progress!.deployedVaults.includes(v.id));

    console.log(`Deploying ${vaultsToDeploy.length} vault(s)...`);
    
    // If no vaults to deploy but we're resuming, restore already deployed vaults
    if (vaultsToDeploy.length === 0 && options?.resume && progress.deployedVaults.length > 0) {
      console.log("All vaults already deployed. Use --vaults flag to deploy specific new vaults.");
    }

    for (let i = 0; i < vaultsToDeploy.length; i++) {
      const vaultConfig = vaultsToDeploy[i];
      
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Vault ${i + 1}/${vaultsToDeploy.length}: ${vaultConfig.id} (${vaultConfig.tokens.tokenX.symbol}-${vaultConfig.tokens.tokenY.symbol})`);
      console.log(`${"=".repeat(60)}`);

      try {
        // Get tokens
        const tokenX = result.tokens.get(vaultConfig.tokens.tokenX.symbol);
        const tokenY = result.tokens.get(vaultConfig.tokens.tokenY.symbol);

        if (!tokenX || !tokenY) {
          throw new Error(`Tokens not found for vault ${vaultConfig.id}`);
        }

        // Get or create LB Pair
        console.log("\nSetting up LB Pair...");
        const lbPair = await getOrCreateLBPair(
          deployer,
          vaultConfig,
          tokenX.address,
          tokenY.address,
          result.sharedInfrastructure.lbFactory,
          networkConfig.name
        );
        result.lbPairs.set(vaultConfig.id, lbPair);
        progress.deployedLBPairs[vaultConfig.id] = lbPair.address;

        // Add initial liquidity if needed
        if (lbPair.isNew && (networkConfig.name !== "localhost" && networkConfig.name !== "hardhat")) {
          try {
            await addInitialLiquidity(
              deployer,
              result.sharedInfrastructure.lbRouter,
              lbPair.address,
              tokenX,
              tokenY,
              vaultConfig,
              networkConfig.name
            );
          } catch (error) {
            console.log("⚠️  Failed to add initial liquidity:", error instanceof Error ? error.message : String(error));
            console.log("   You'll need to add liquidity manually after deployment");
          }
        }

        // Deploy vault contracts
        const vaultAddresses = await deploySingleVault(
          deployer,
          vaultConfig,
          result.sharedInfrastructure,
          tokenX,
          tokenY,
          lbPair,
          networkConfig
        );

        // Register vault in registry
        console.log("\nRegistering vault in registry...");
        const registry = await ethers.getContractAt("ArcaVaultRegistry", result.sharedInfrastructure.registry, deployer);
        
        await registry.registerVault(
          vaultAddresses.vault,
          vaultAddresses.rewardClaimer,
          vaultAddresses.queueHandler,
          vaultAddresses.feeManager,
          tokenX.address,
          tokenY.address,
          vaultConfig.deployment.vaultName,
          vaultConfig.deployment.vaultSymbol,
          i + 1, // deploymentId
          true // isProxy
        );

        console.log("✓ Vault registered successfully");

        // Save vault deployment
        result.vaults.set(vaultConfig.id, {
          vaultId: vaultConfig.id,
          addresses: vaultAddresses,
          tokenX: tokenX.address,
          tokenY: tokenY.address,
          lbPair: lbPair.address
        });

        progress.deployedVaults.push(vaultConfig.id);
        // Remove from failed list if it was there
        progress.failedVaults = progress.failedVaults.filter(id => id !== vaultConfig.id);
        saveProgress(networkConfig.name, progress);

        console.log(`\n✅ Vault ${vaultConfig.id} deployed successfully!`);

      } catch (error) {
        console.error(`\n❌ Failed to deploy vault ${vaultConfig.id}:`, error);
        // Only add to failed list if not already there
        if (!progress.failedVaults.includes(vaultConfig.id)) {
          progress.failedVaults.push(vaultConfig.id);
        }
        saveProgress(networkConfig.name, progress);
        
        // Ask user if they want to continue
        console.log("\n⚠️  Vault deployment failed. Continue with remaining vaults? (deployment can be resumed later)");
        // In automated environments, continue by default
        continue;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network: ${networkConfig.name}`);
    console.log(`Total vaults: ${enabledVaults.length}`);
    console.log(`✅ Deployed: ${progress.deployedVaults.length}`);
    
    if (progress.failedVaults.length > 0) {
      console.log(`❌ Failed: ${progress.failedVaults.length} (${progress.failedVaults.join(", ")})`);
      console.log("\nTo retry failed vaults, run deployment again with --resume flag");
    }

    // Save final deployment artifacts
    await saveDeploymentArtifacts(result, networkConfig);

    return result;

  } catch (error) {
    console.error("\n❌ Critical deployment error:", error);
    if (progress) {
      saveProgress(networkConfig.name, progress);
    }
    throw error;
  }
}

/**
 * Save deployment artifacts in a format compatible with UI and other tools
 */
async function saveDeploymentArtifacts(
  result: MultiVaultDeploymentResult,
  networkConfig: NetworkConfig
): Promise<void> {
  const timestamp = new Date().toISOString();
  const deploymentsDir = path.join("deployments", networkConfig.name);
  
  const deployment = {
    network: networkConfig.name,
    timestamp,
    sharedInfrastructure: result.sharedInfrastructure,
    vaults: Array.from(result.vaults.entries()).map(([id, vault]) => ({
      id,
      ...vault
    })),
    tokens: Object.fromEntries(
      Array.from(result.tokens.entries()).map(([symbol, token]) => [
        symbol,
        token.address
      ])
    )
  };

  // Save timestamped version
  const filename = `multi-vault-deployment-${timestamp.replace(/:/g, "-")}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  
  // Save as latest
  const latestPath = path.join(deploymentsDir, "latest-multi-vault.json");
  fs.writeFileSync(latestPath, JSON.stringify(deployment, null, 2));
  
  console.log(`\n📁 Deployment artifacts saved to: ${filepath}`);
}