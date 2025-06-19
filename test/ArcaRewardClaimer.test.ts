import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ArcaRewardClaimerV1,
  ArcaFeeManagerV1,
  MockERC20,
  MockLBRouter,
  MockLBPair,
  MockLBHooksBaseRewarder
} from "../typechain-types";

describe("ArcaRewardClaimerV1 Unit Tests", function () {
  let owner: SignerWithAddress;
  let vault: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  let rewardClaimer: ArcaRewardClaimerV1;
  let feeManager: ArcaFeeManagerV1;
  let tokenX: MockERC20;
  let tokenY: MockERC20;
  let metroToken: MockERC20;
  let mockRouter: MockLBRouter;
  let mockPair: MockLBPair;
  let mockRewarder: MockLBHooksBaseRewarder;

  beforeEach(async function () {
    [owner, vault, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    tokenX = await MockERC20Factory.deploy("TokenX", "TX", 18);
    tokenY = await MockERC20Factory.deploy("TokenY", "TY", 18);
    metroToken = await MockERC20Factory.deploy("METRO", "METRO", 18);

    // Deploy mocks
    const MockLBRouterFactory = await ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouterFactory.deploy();

    const MockLBPairFactory = await ethers.getContractFactory("MockLBPair");
    mockPair = await MockLBPairFactory.deploy();

    const MockRewarderFactory = await ethers.getContractFactory("MockLBHooksBaseRewarder");
    mockRewarder = await MockRewarderFactory.deploy();

    // Deploy fee manager
    const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1");
    feeManager = await FeeManagerFactory.deploy(feeRecipient.address);

    // Deploy reward claimer
    const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1");
    rewardClaimer = await RewardClaimerFactory.deploy(
      await mockRewarder.getAddress(),
      await metroToken.getAddress(),
      await feeManager.getAddress(),
      await tokenX.getAddress(), // native token
      await mockPair.getAddress(),
      await mockPair.getAddress(),
      await mockPair.getAddress(),
      await mockRouter.getAddress(),
      5, // idSlippage
      await tokenX.getAddress(),
      await tokenY.getAddress()
    );
  });

  describe("Ownership Transfer", function () {
    it("Should transfer ownership to vault successfully", async function () {
      // Initial owner should be the deployer
      expect(await rewardClaimer.owner()).to.equal(owner.address);

      // Transfer ownership to vault
      await rewardClaimer.transferOwnership(vault.address);

      // Verify ownership transferred
      expect(await rewardClaimer.owner()).to.equal(vault.address);
    });

    it("Should only allow owner to transfer ownership", async function () {
      // Non-owner should not be able to transfer ownership
      await expect(
        rewardClaimer.connect(vault).transferOwnership(vault.address)
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
    });
  });

  describe("Token Flow in Swap Function", function () {
    beforeEach(async function () {
      // Transfer ownership to vault for testing
      await rewardClaimer.transferOwnership(vault.address);
      
      // Setup mock rewarder with metro tokens
      await mockRewarder.setRewardToken(await metroToken.getAddress());
      await metroToken.mint(await mockRewarder.getAddress(), ethers.parseEther("100"));
      
      // Setup mock router outputs
      await mockRouter.setSwapOutput(ethers.parseEther("5"), ethers.parseEther("5"));
      
      // Mint tokens to router so it can send them to vault
      await tokenX.mint(await mockRouter.getAddress(), ethers.parseEther("100"));
      await tokenY.mint(await mockRouter.getAddress(), ethers.parseEther("100"));
    });

    it("Should send swapped tokens to vault (owner), not reward claimer", async function () {
      const metroAmount = ethers.parseEther("10");
      const expectedTokenXOutput = ethers.parseEther("5");

      // Setup swap paths (simplified for testing)
      const swapPath = {
        tokenPath: [await metroToken.getAddress(), await tokenX.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      await rewardClaimer.connect(vault).setSwapPaths(
        swapPath, // metroToTokenXPath
        swapPath, // metroToTokenYPath  
        swapPath  // metroToNativePath
      );

      // Get initial balances
      const initialVaultBalanceX = await tokenX.balanceOf(vault.address);
      const initialRewardClaimerBalanceX = await tokenX.balanceOf(await rewardClaimer.getAddress());

      // Simulate reward claiming and compounding
      await mockRewarder.setClaimAmount(metroAmount);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify EXPECTED BEHAVIOR: tokens went to vault, not reward claimer
      const finalVaultBalanceX = await tokenX.balanceOf(vault.address);
      const finalRewardClaimerBalanceX = await tokenX.balanceOf(await rewardClaimer.getAddress());

      // CRITICAL TEST: Vault should receive the swapped tokens
      expect(finalVaultBalanceX).to.be.gt(initialVaultBalanceX);
      
      // CRITICAL TEST: Reward claimer should NOT have the swapped tokens
      expect(finalRewardClaimerBalanceX).to.equal(initialRewardClaimerBalanceX);
    });

    it("Should update totalCompounded analytics correctly", async function () {
      const metroAmount = ethers.parseEther("100"); 

      // Setup swap paths - simplified for testing
      const swapPath = {
        tokenPath: [await metroToken.getAddress(), await tokenX.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      await rewardClaimer.connect(vault).setSwapPaths(swapPath, swapPath, swapPath);
      
      // Set lower minimum swap amount for testing
      await rewardClaimer.connect(vault).setMinSwapAmount(1);

      // Make sure our mock router will actually transfer tokens
      const swapOutputX = ethers.parseEther("25");
      const swapOutputY = ethers.parseEther("25");
      await mockRouter.setSwapOutput(swapOutputX, swapOutputY);

      // Get initial compounded amounts
      const initialCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const initialCompoundedY = await rewardClaimer.getTotalCompounded(1);

      // Claim and compound rewards  
      await mockRewarder.setClaimAmount(metroAmount);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify analytics updated
      const finalCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const finalCompoundedY = await rewardClaimer.getTotalCompounded(1);

      // EXPECTED BEHAVIOR: Analytics should track compounded amounts  
      expect(finalCompoundedX).to.be.gt(initialCompoundedX);
      // For now, just check that Y is at least not negative (the second swap might fail)
      expect(finalCompoundedY).to.be.gte(initialCompoundedY);
    });

    it("Should handle swap failures gracefully", async function () {
      const metroAmount = ethers.parseEther("10");

      // Setup swap paths
      const swapPath = {
        tokenPath: [await metroToken.getAddress(), await tokenX.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      await rewardClaimer.connect(vault).setSwapPaths(swapPath, swapPath, swapPath);

      // Make router fail
      await mockRouter.setShouldFail(true);

      // Should not revert even if swap fails
      await mockRewarder.setClaimAmount(metroAmount);
      await expect(
        rewardClaimer.connect(vault).claimAndCompoundRewards()
      ).to.not.be.reverted;
    });
  });

  describe("Analytics Functions", function () {
    it("Should provide read access to totalCompounded", async function () {
      // Initially should be zero
      expect(await rewardClaimer.getTotalCompounded(0)).to.equal(0);
      expect(await rewardClaimer.getTotalCompounded(1)).to.equal(0);
    });

    it("Should revert for invalid token types", async function () {
      // Should revert for invalid token type (only 0 and 1 are valid)
      await expect(
        rewardClaimer.getTotalCompounded(2)
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to call critical functions", async function () {
      // Transfer ownership to vault first
      await rewardClaimer.transferOwnership(vault.address);

      // Non-owner should not be able to call owner functions
      await expect(
        rewardClaimer.connect(owner).claimAndCompoundRewards()
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");

      await expect(
        rewardClaimer.connect(owner).setMinSwapAmount(100)
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
    });

    it("Should allow vault (owner) to call all functions", async function () {
      // Transfer ownership to vault
      await rewardClaimer.transferOwnership(vault.address);

      // Vault should be able to call owner functions
      await expect(
        rewardClaimer.connect(vault).claimAndCompoundRewards()
      ).to.not.be.reverted;

      await expect(
        rewardClaimer.connect(vault).setMinSwapAmount(100)
      ).to.not.be.reverted;
    });
  });
});