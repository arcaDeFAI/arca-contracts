import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
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

    // Deploy fee manager using beacon proxy
    const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManagerFactory);
    const feeManagerProxy = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManagerFactory,
      [feeRecipient.address]
    );
    await feeManagerProxy.waitForDeployment();
    feeManager = FeeManagerFactory.attach(await feeManagerProxy.getAddress()) as ArcaFeeManagerV1;

    // Deploy queue handler using beacon proxy
    const QueueHandlerFactory = await ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandlerFactory);
    const queueHandlerProxy = await hre.upgrades.deployBeaconProxy(
      queueHandlerBeacon,
      QueueHandlerFactory,
      []
    );
    await queueHandlerProxy.waitForDeployment();
    queueHandler = QueueHandlerFactory.attach(await queueHandlerProxy.getAddress()) as ArcaQueueHandlerV1;

    // Deploy reward claimer using UUPS proxy
    const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1");
    const rewardClaimerProxy = await hre.upgrades.deployProxy(
      RewardClaimerFactory,
      [
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
      ],
      { kind: 'uups' }
    );
    await rewardClaimerProxy.waitForDeployment();
    rewardClaimer = RewardClaimerFactory.attach(await rewardClaimerProxy.getAddress()) as ArcaRewardClaimerV1;

    // Deploy main vault using UUPS proxy
    const VaultFactory = await ethers.getContractFactory("ArcaTestnetV1");
    const vaultProxy = await hre.upgrades.deployProxy(
      VaultFactory,
      [
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
      ],
      { kind: 'uups' }
    );
    await vaultProxy.waitForDeployment();
    vault = VaultFactory.attach(await vaultProxy.getAddress()) as ArcaTestnetV1;
  });

  describe("Manual Ownership Transfer Test", function () {
    it("Should successfully transfer ownership step by step", async function () {
      // Step 1: Verify initial ownership
      expect(await rewardClaimer.owner()).to.equal(owner.address);

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