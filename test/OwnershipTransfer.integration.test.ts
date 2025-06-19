import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ArcaTestnetV1,
  ArcaRewardClaimerV1,
  ArcaQueueHandlerV1,
  ArcaFeeManagerV1,
  MockERC20,
  MockLBRouter,
  MockLBPair,
  MockLBHooksBaseRewarder
} from "../typechain-types";

describe("Ownership Transfer Integration Test", function () {
  let owner: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  let vault: ArcaTestnetV1;
  let rewardClaimer: ArcaRewardClaimerV1;
  let queueHandler: ArcaQueueHandlerV1;
  let feeManager: ArcaFeeManagerV1;
  
  let tokenX: MockERC20;
  let tokenY: MockERC20;
  let metroToken: MockERC20;
  let mockRouter: MockLBRouter;
  let mockPair: MockLBPair;
  let mockRewarder: MockLBHooksBaseRewarder;

  beforeEach(async function () {
    [owner, feeRecipient] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    tokenX = await MockERC20Factory.deploy("TokenX", "TX", 18);
    tokenY = await MockERC20Factory.deploy("TokenY", "TY", 18);
    metroToken = await MockERC20Factory.deploy("METRO", "METRO", 18);

    // Deploy mock external contracts
    const MockLBRouterFactory = await ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouterFactory.deploy();

    const MockLBPairFactory = await ethers.getContractFactory("MockLBPair");
    mockPair = await MockLBPairFactory.deploy();

    const MockRewarderFactory = await ethers.getContractFactory("MockLBHooksBaseRewarder");
    mockRewarder = await MockRewarderFactory.deploy();

    // Deploy fee manager
    const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1");
    feeManager = await FeeManagerFactory.deploy(feeRecipient.address);

    // Deploy queue handler
    const QueueHandlerFactory = await ethers.getContractFactory("ArcaQueueHandlerV1");
    queueHandler = await QueueHandlerFactory.deploy();

    // Deploy reward claimer
    const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1");
    rewardClaimer = await RewardClaimerFactory.deploy(
      await mockRewarder.getAddress(),
      await metroToken.getAddress(),
      await feeManager.getAddress(),
      await tokenX.getAddress(),
      await mockPair.getAddress(),
      await mockPair.getAddress(),
      await mockPair.getAddress(),
      await mockRouter.getAddress(),
      5,
      await tokenX.getAddress(),
      await tokenY.getAddress()
    );

    // Deploy main vault
    const VaultFactory = await ethers.getContractFactory("ArcaTestnetV1");
    vault = await VaultFactory.deploy();
  });

  describe("Manual Ownership Transfer Test", function () {
    it("Should successfully transfer ownership step by step", async function () {
      // Step 1: Verify initial ownership
      expect(await rewardClaimer.owner()).to.equal(owner.address);

      // Step 2: Initialize vault (without automatic ownership transfer for now)
      await vault.initialize(
        await tokenX.getAddress(),
        await tokenY.getAddress(),
        25, // binStep
        ethers.parseEther("0.001"),
        ethers.parseEther("0.001"),
        "Arca Vault Token",
        "AVT",
        await mockRouter.getAddress(),
        await mockPair.getAddress(),
        await mockPair.getAddress(),
        await rewardClaimer.getAddress(),
        await queueHandler.getAddress(),
        await feeManager.getAddress()
      );

      // Step 3: Manually transfer ownership to vault (as deployer would do)
      await rewardClaimer.transferOwnership(await vault.getAddress());

      // Step 4: Verify ownership was transferred to vault
      expect(await rewardClaimer.owner()).to.equal(await vault.getAddress());
    });

    it("Should ensure vault can call reward claimer functions after ownership transfer", async function () {
      // Initialize vault
      await vault.initialize(
        await tokenX.getAddress(),
        await tokenY.getAddress(),
        25,
        ethers.parseEther("0.001"),
        ethers.parseEther("0.001"),
        "Arca Vault Token",
        "AVT",
        await mockRouter.getAddress(),
        await mockPair.getAddress(),
        await mockPair.getAddress(),
        await rewardClaimer.getAddress(),
        await queueHandler.getAddress(),
        await feeManager.getAddress()
      );

      // Transfer ownership to vault
      await rewardClaimer.transferOwnership(await vault.getAddress());

      // Vault should be able to call reward claimer functions
      await expect(
        vault.setMinSwapAmount(100)
      ).to.not.be.reverted;

      // Non-vault should not be able to call reward claimer functions directly
      await expect(
        rewardClaimer.setMinSwapAmount(100)
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
    });
  });
});