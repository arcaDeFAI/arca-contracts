import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { NetworkConfig } from "./network-config";

export interface MockAddresses {
  tokenX: string;
  tokenY: string;
  lbRouter: string;
  lbpAMM: string;
  lbpContract: string;
  rewarder: string;
  rewardToken: string;
  nativeToken: string;
  lbpContractUSD: string;
}

export async function deployMockContracts(
  deployer: HardhatEthersSigner,
  mockTokenConfig: NetworkConfig["mockTokens"],
  testAccountConfig: NetworkConfig["testAccounts"]
): Promise<MockAddresses> {
  if (!mockTokenConfig || !testAccountConfig) {
    throw new Error("Mock token configuration not found");
  }

  console.log("Deploying mock tokens...");

  // Deploy mock ERC20 tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20", deployer);
  
  const tokenX = await MockERC20.deploy(
    mockTokenConfig.tokenX.name,
    mockTokenConfig.tokenX.symbol,
    mockTokenConfig.tokenX.decimals
  );
  await tokenX.waitForDeployment();
  await tokenX.mint(deployer.address, mockTokenConfig.tokenX.initialSupply);
  console.log(`✓ Token X deployed: ${await tokenX.getAddress()}`);

  const tokenY = await MockERC20.deploy(
    mockTokenConfig.tokenY.name,
    mockTokenConfig.tokenY.symbol,
    mockTokenConfig.tokenY.decimals
  );
  await tokenY.waitForDeployment();
  await tokenY.mint(deployer.address, mockTokenConfig.tokenY.initialSupply);
  console.log(`✓ Token Y deployed: ${await tokenY.getAddress()}`);

  const rewardToken = await MockERC20.deploy(
    mockTokenConfig.rewardToken.name,
    mockTokenConfig.rewardToken.symbol,
    mockTokenConfig.rewardToken.decimals
  );
  await rewardToken.waitForDeployment();
  await rewardToken.mint(deployer.address, mockTokenConfig.rewardToken.initialSupply);
  console.log(`✓ Reward Token deployed: ${await rewardToken.getAddress()}`);

  console.log("\nDeploying mock infrastructure...");

  // Deploy mock router
  const MockLBRouter = await ethers.getContractFactory("MockLBRouter", deployer);
  const lbRouter = await MockLBRouter.deploy();
  await lbRouter.waitForDeployment();
  console.log(`✓ LB Router deployed: ${await lbRouter.getAddress()}`);

  // Deploy mock LB pair
  const MockLBPair = await ethers.getContractFactory("MockLBPair", deployer);
  const lbPair = await MockLBPair.deploy();
  await lbPair.waitForDeployment();
  console.log(`✓ LB Pair deployed: ${await lbPair.getAddress()}`);

  // Deploy mock rewarder
  const MockRewarder = await ethers.getContractFactory("MockLBHooksBaseRewarder", deployer);
  const rewarder = await MockRewarder.deploy();
  await rewarder.waitForDeployment();
  
  // Set reward token
  await rewarder.setRewardToken(await rewardToken.getAddress());
  await rewarder.setClaimAmount(ethers.parseEther("100")); // Set default claim amount
  
  console.log(`✓ Rewarder deployed: ${await rewarder.getAddress()}`);

  // Fund test accounts
  if (testAccountConfig.count > 0) {
    console.log(`\nFunding ${testAccountConfig.count} test accounts...`);
    const signers = await ethers.getSigners();
    
    for (let i = 1; i <= Math.min(testAccountConfig.count, signers.length - 1); i++) {
      const account = signers[i];
      
      // Transfer tokens
      await tokenX.transfer(account.address, testAccountConfig.fundingAmounts.tokenX);
      await tokenY.transfer(account.address, testAccountConfig.fundingAmounts.tokenY);
      
      // Transfer native tokens if needed
      if (testAccountConfig.fundingAmounts.native && testAccountConfig.fundingAmounts.native !== "0") {
        await deployer.sendTransaction({
          to: account.address,
          value: BigInt(testAccountConfig.fundingAmounts.native)
        });
      }
      
      console.log(`✓ Account ${i} funded: ${account.address}`);
    }
  }

  return {
    tokenX: await tokenX.getAddress(),
    tokenY: await tokenY.getAddress(),
    lbRouter: await lbRouter.getAddress(),
    lbpAMM: await lbPair.getAddress(), // Using pair address as AMM
    lbpContract: await lbPair.getAddress(),
    rewarder: await rewarder.getAddress(),
    rewardToken: await rewardToken.getAddress(),
    nativeToken: await tokenX.getAddress(), // Using tokenX as native for simplicity
    lbpContractUSD: await lbPair.getAddress() // Using same pair for USD
  };
}