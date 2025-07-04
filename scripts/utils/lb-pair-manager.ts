import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { NetworkConfig, VaultConfig } from "../types/config";
import type { ILBFactory, ILBPair, ILBRouter, MockLBPair, MockLBRouter } from "../../typechain-types";
import type { DeployedToken } from "./token-deployer";

export interface DeployedLBPair {
  address: string;
  tokenX: string;
  tokenY: string;
  binStep: number;
  isNew: boolean;
}

/**
 * Get or create an LB Pair based on network and configuration
 */
export async function getOrCreateLBPair(
  deployer: HardhatEthersSigner,
  vaultConfig: VaultConfig,
  tokenXAddress: string,
  tokenYAddress: string,
  lbFactoryAddress: string,
  networkName: string
): Promise<DeployedLBPair> {
  console.log(`\n🔄 Setting up LB Pair for ${vaultConfig.id} (${vaultConfig.tokens.tokenX.symbol}-${vaultConfig.tokens.tokenY.symbol})...`);

  // Validate inputs
  if (!ethers.isAddress(tokenXAddress) || !ethers.isAddress(tokenYAddress)) {
    throw new Error(`Invalid token addresses: tokenX=${tokenXAddress}, tokenY=${tokenYAddress}`);
  }

  if (!ethers.isAddress(lbFactoryAddress) && networkName !== "localhost" && networkName !== "hardhat") {
    throw new Error(`Invalid LB Factory address: ${lbFactoryAddress}`);
  }

  if (vaultConfig.lbPair.binStep === 0 || vaultConfig.lbPair.binStep > 250) {
    throw new Error(`Invalid bin step: ${vaultConfig.lbPair.binStep}. Must be between 1 and 250`);
  }

  try {
    // For localhost, deploy mock LB Pair
    if (networkName === "localhost" || networkName === "hardhat") {
      return await deployMockLBPair(deployer, vaultConfig, tokenXAddress, tokenYAddress);
    }

    // For testnet/mainnet, use real LB Factory
    return await createRealLBPair(
      deployer,
      vaultConfig,
      tokenXAddress,
      tokenYAddress,
      lbFactoryAddress
    );
  } catch (error) {
    console.error(`❌ Failed to get/create LB Pair for ${vaultConfig.id}:`, error);
    throw new Error(`LB Pair creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Deploy a mock LB Pair for local testing
 */
async function deployMockLBPair(
  deployer: HardhatEthersSigner,
  vaultConfig: VaultConfig,
  tokenXAddress: string,
  tokenYAddress: string
): Promise<DeployedLBPair> {
  console.log("Deploying mock LB Pair...");

  try {
    const MockLBPairFactory = await ethers.getContractFactory("MockLBPair", deployer);
    const mockPair = await MockLBPairFactory.deploy() as MockLBPair;
    await mockPair.waitForDeployment();

    const pairAddress = await mockPair.getAddress();
    console.log(`✓ Mock LB Pair deployed at: ${pairAddress}`);

    return {
      address: pairAddress,
      tokenX: tokenXAddress,
      tokenY: tokenYAddress,
      binStep: vaultConfig.lbPair.binStep,
      isNew: true
    };
  } catch (error) {
    throw new Error(`Failed to deploy mock LB Pair: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create or retrieve a real LB Pair using the factory
 */
async function createRealLBPair(
  deployer: HardhatEthersSigner,
  vaultConfig: VaultConfig,
  tokenXAddress: string,
  tokenYAddress: string,
  lbFactoryAddress: string
): Promise<DeployedLBPair> {
  let lbFactory: ILBFactory;
  
  try {
    lbFactory = await ethers.getContractAt("ILBFactory", lbFactoryAddress, deployer) as ILBFactory;
  } catch (error) {
    throw new Error(`Failed to connect to LB Factory at ${lbFactoryAddress}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check if pair already exists
  console.log("Checking for existing LB Pair...");
  
  try {
    const existingPairInfo = await lbFactory.getLBPairInformation(
      tokenXAddress,
      tokenYAddress,
      vaultConfig.lbPair.binStep
    );

    if (existingPairInfo.LBPair && existingPairInfo.LBPair !== ethers.ZeroAddress) {
      console.log(`✓ Found existing LB Pair at: ${existingPairInfo.LBPair}`);
      return {
        address: existingPairInfo.LBPair,
        tokenX: tokenXAddress,
        tokenY: tokenYAddress,
        binStep: vaultConfig.lbPair.binStep,
        isNew: false
      };
    }
  } catch (error) {
    // Pair doesn't exist, will create new one
    console.log("No existing pair found, creating new one...");
  }

  // Create new pair
  console.log(`Creating new LB Pair with bin step ${vaultConfig.lbPair.binStep}...`);
  
  let tx;
  try {
    tx = await lbFactory.createLBPair(
      tokenXAddress,
      tokenYAddress,
      vaultConfig.lbPair.activeId,
      vaultConfig.lbPair.binStep
    );
  } catch (error) {
    // Check if it's a specific error we can handle
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("LBFactory__LBPairAlreadyExists")) {
      throw new Error(`LB Pair already exists with these parameters. This shouldn't happen - check the pair lookup logic.`);
    }
    if (errorMessage.includes("LBFactory__BinStepTooLow")) {
      throw new Error(`Bin step ${vaultConfig.lbPair.binStep} is too low for this factory.`);
    }
    throw new Error(`Failed to create LB Pair: ${errorMessage}`);
  }
  
  const receipt = await tx.wait();
  
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  
  // Find the LBPairCreated event to get the pair address
  const lbPairCreatedEvent = receipt.logs.find((log) => {
    try {
      const parsed = lbFactory.interface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });
      return parsed?.name === "LBPairCreated";
    } catch {
      return false;
    }
  });

  if (!lbPairCreatedEvent) {
    throw new Error("Failed to find LBPairCreated event in transaction receipt");
  }

  const parsedEvent = lbFactory.interface.parseLog({
    topics: lbPairCreatedEvent.topics as string[],
    data: lbPairCreatedEvent.data
  });

  const pairAddress = parsedEvent?.args?.LBPair;
  
  if (!pairAddress || pairAddress === ethers.ZeroAddress) {
    throw new Error("Invalid pair address returned from factory");
  }
  
  console.log(`✓ Created new LB Pair at: ${pairAddress}`);

  return {
    address: pairAddress,
    tokenX: tokenXAddress,
    tokenY: tokenYAddress,
    binStep: vaultConfig.lbPair.binStep,
    isNew: true
  };
}

/**
 * Add initial liquidity to a newly created LB Pair
 */
export async function addInitialLiquidity(
  deployer: HardhatEthersSigner,
  lbRouterAddress: string,
  lbPairAddress: string,
  tokenX: DeployedToken,
  tokenY: DeployedToken,
  vaultConfig: VaultConfig,
  networkName: string
): Promise<void> {
  console.log(`\n💧 Adding initial liquidity to ${vaultConfig.id} pair...`);

  // For mock pairs, we don't need to add real liquidity
  if (networkName === "localhost" || networkName === "hardhat") {
    console.log("✓ Skipping liquidity addition for mock pair");
    return;
  }

  // Validate inputs
  if (!ethers.isAddress(lbRouterAddress)) {
    throw new Error(`Invalid LB Router address: ${lbRouterAddress}`);
  }
  
  if (!ethers.isAddress(lbPairAddress)) {
    throw new Error(`Invalid LB Pair address: ${lbPairAddress}`);
  }

  let lbRouter: ILBRouter;
  try {
    lbRouter = await ethers.getContractAt("ILBRouter", lbRouterAddress, deployer) as ILBRouter;
  } catch (error) {
    throw new Error(`Failed to connect to LB Router at ${lbRouterAddress}: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Calculate liquidity amounts based on decimals
  const amountX = ethers.parseUnits("100000", tokenX.config.decimals);
  const amountY = ethers.parseUnits("100000", tokenY.config.decimals);

  // Approve router to spend tokens
  console.log("Approving tokens for router...");
  await tokenX.contract.approve(lbRouterAddress, amountX);
  await tokenY.contract.approve(lbRouterAddress, amountY);

  // Prepare liquidity parameters
  const liquidityParameters = {
    tokenX: tokenX.address,
    tokenY: tokenY.address,
    binStep: vaultConfig.lbPair.binStep,
    amountX: amountX,
    amountY: amountY,
    amountXMin: 0n, // No slippage protection for initial liquidity
    amountYMin: 0n,
    activeIdDesired: vaultConfig.lbPair.activeId,
    idSlippage: parseInt(vaultConfig.deployment.idSlippage),
    deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5], // Distribute across 11 bins
    distributionX: new Array(11).fill(0n),
    distributionY: new Array(11).fill(0n),
    to: deployer.address,
    refundTo: deployer.address,
    deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
  };

  // Calculate even distribution (total must equal 1e18)
  const distributionPerBin = ethers.parseEther("1") / 11n;
  const remainder = ethers.parseEther("1") - (distributionPerBin * 11n);
  
  // Set distributions
  for (let i = 0; i < 11; i++) {
    // Add remainder to the center bin
    liquidityParameters.distributionX[i] = i === 5 ? distributionPerBin + remainder : distributionPerBin;
    liquidityParameters.distributionY[i] = i === 5 ? distributionPerBin + remainder : distributionPerBin;
  }

  console.log("Adding liquidity to LB Pair...");
  
  try {
    const tx = await lbRouter.addLiquidity(liquidityParameters);
    const receipt = await tx.wait();
    
    if (!receipt || receipt.status === 0) {
      throw new Error("Liquidity addition transaction failed");
    }

    console.log(`✓ Added initial liquidity: ${ethers.formatUnits(amountX, tokenX.config.decimals)} ${tokenX.config.symbol} + ${ethers.formatUnits(amountY, tokenY.config.decimals)} ${tokenY.config.symbol}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for common errors
    if (errorMessage.includes("insufficient allowance")) {
      throw new Error("Token approval failed. Make sure the tokens are properly approved for the router.");
    }
    if (errorMessage.includes("insufficient balance")) {
      throw new Error("Insufficient token balance. Make sure the deployer has enough tokens.");
    }
    if (errorMessage.includes("deadline")) {
      throw new Error("Transaction deadline exceeded. Try again with a longer deadline.");
    }
    
    throw new Error(`Failed to add liquidity: ${errorMessage}`);
  }
}

/**
 * Deploy mock LB Router for local testing
 */
export async function deployMockLBRouter(
  deployer: HardhatEthersSigner
): Promise<string> {
  console.log("\nDeploying mock LB Router...");
  
  const MockLBRouterFactory = await ethers.getContractFactory("MockLBRouter", deployer);
  const mockRouter = await MockLBRouterFactory.deploy() as MockLBRouter;
  await mockRouter.waitForDeployment();
  
  const address = await mockRouter.getAddress();
  console.log(`✓ Mock LB Router deployed at: ${address}`);
  
  return address;
}

/**
 * Deploy mock LB Factory for local testing (if needed)
 */
export async function deployMockLBFactory(
  deployer: HardhatEthersSigner
): Promise<string> {
  console.log("\nDeploying mock LB Factory...");
  
  // For now, we'll return the mock LB Pair address as factory
  // In a real implementation, you might want to create a proper MockLBFactory
  const MockLBPairFactory = await ethers.getContractFactory("MockLBPair", deployer);
  const mockPair = await MockLBPairFactory.deploy() as MockLBPair;
  await mockPair.waitForDeployment();
  
  const address = await mockPair.getAddress();
  console.log(`✓ Using mock LB Pair as factory: ${address}`);
  
  return address;
}

/**
 * Calculate appropriate activeId based on token decimals and desired price
 * For 1:1 price ratio, activeId should be 2^23 = 8388608
 */
export function calculateActiveId(
  tokenXDecimals: number,
  tokenYDecimals: number,
  targetPrice: number = 1
): number {
  // Base activeId for 1:1 price
  const baseActiveId = 8388608; // 2^23
  
  // Adjust for decimal differences
  const decimalDiff = tokenXDecimals - tokenYDecimals;
  
  // Each bin represents approximately 0.01% price change
  // Need to adjust activeId if decimals are different
  if (decimalDiff === 0) {
    return baseActiveId;
  }
  
  // For each decimal difference, we need to adjust by approximately 1000 bins
  // This is a simplified calculation and may need fine-tuning
  const binAdjustment = decimalDiff * 1000;
  
  return baseActiveId + binAdjustment;
}