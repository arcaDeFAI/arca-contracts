import hre from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadNetworkConfig } from "./utils/network-config";

export interface MockContracts {
  tokenX: string;
  tokenY: string;
  rewardToken: string;
  lbRouter: string;
  lbPair: string;
  rewarder: string;
}

export async function deployMockContracts(): Promise<MockContracts> {
  console.log("Deploying mock contracts for local testing...");
  
  const [deployer]: HardhatEthersSigner[] = await hre.ethers.getSigners();
  console.log("Deploying mocks with account:", deployer.address);
  
  // Load network config
  const networkConfig = loadNetworkConfig("localhost");
  
  if (!networkConfig.mockTokens) {
    throw new Error("Mock token configuration not found for localhost");
  }
  
  // Deploy mock tokens
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  
  console.log("\n=== Deploying Mock Tokens ===");
  
  // Deploy TokenX
  const tokenX = await MockERC20.deploy(
    networkConfig.mockTokens.tokenX.name,
    networkConfig.mockTokens.tokenX.symbol,
    networkConfig.mockTokens.tokenX.decimals
  );
  await tokenX.waitForDeployment();
  const tokenXAddress = await tokenX.getAddress();
  console.log(`TokenX deployed to: ${tokenXAddress}`);
  
  // Deploy TokenY
  const tokenY = await MockERC20.deploy(
    networkConfig.mockTokens.tokenY.name,
    networkConfig.mockTokens.tokenY.symbol,
    networkConfig.mockTokens.tokenY.decimals
  );
  await tokenY.waitForDeployment();
  const tokenYAddress = await tokenY.getAddress();
  console.log(`TokenY deployed to: ${tokenYAddress}`);
  
  // Deploy Reward Token (METRO)
  const rewardToken = await MockERC20.deploy(
    networkConfig.mockTokens.rewardToken.name,
    networkConfig.mockTokens.rewardToken.symbol,
    networkConfig.mockTokens.rewardToken.decimals
  );
  await rewardToken.waitForDeployment();
  const rewardTokenAddress = await rewardToken.getAddress();
  console.log(`Reward Token deployed to: ${rewardTokenAddress}`);
  
  console.log("\n=== Deploying Mock Contracts ===");
  
  // Deploy Mock LB Router
  const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
  const lbRouter = await MockLBRouter.deploy();
  await lbRouter.waitForDeployment();
  const lbRouterAddress = await lbRouter.getAddress();
  console.log(`LB Router deployed to: ${lbRouterAddress}`);
  
  // Deploy Mock LB Pair
  const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
  const lbPair = await MockLBPair.deploy();
  await lbPair.waitForDeployment();
  const lbPairAddress = await lbPair.getAddress();
  console.log(`LB Pair deployed to: ${lbPairAddress}`);
  
  // Deploy Mock Rewarder
  const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
  const rewarder = await MockRewarder.deploy();
  await rewarder.waitForDeployment();
  const rewarderAddress = await rewarder.getAddress();
  console.log(`Rewarder deployed to: ${rewarderAddress}`);
  
  // Fund test accounts if configured
  if (networkConfig.testAccounts) {
    console.log("\n=== Funding Test Accounts ===");
    const signers = await hre.ethers.getSigners();
    const accountsToFund = Math.min(networkConfig.testAccounts.count, signers.length);
    
    for (let i = 0; i < accountsToFund; i++) {
      const signer = signers[i];
      const address = signer.address;
      
      // Mint tokens to test accounts
      if (networkConfig.testAccounts.fundingAmounts.tokenX) {
        await tokenX.mint(address, networkConfig.testAccounts.fundingAmounts.tokenX);
      }
      
      if (networkConfig.testAccounts.fundingAmounts.tokenY) {
        await tokenY.mint(address, networkConfig.testAccounts.fundingAmounts.tokenY);
      }
      
      console.log(`Funded account ${i}: ${address}`);
    }
  }
  
  console.log("\n=== Mock Deployment Summary ===");
  const mockContracts: MockContracts = {
    tokenX: tokenXAddress,
    tokenY: tokenYAddress,
    rewardToken: rewardTokenAddress,
    lbRouter: lbRouterAddress,
    lbPair: lbPairAddress,
    rewarder: rewarderAddress
  };
  
  console.log("Mock contracts:", mockContracts);
  
  return mockContracts;
}

// Direct execution
async function main() {
  try {
    const mocks = await deployMockContracts();
    console.log("\n✅ Mock deployment completed successfully!");
    console.log("\nMock addresses:", JSON.stringify(mocks, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Error deploying mocks:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}