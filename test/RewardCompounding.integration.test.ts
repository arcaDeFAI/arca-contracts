import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type {
  ArcaTestnetV1,
  ArcaRewardClaimerV1,
  ArcaQueueHandlerV1,
  ArcaFeeManagerV1,
  MockERC20,
  MockLBRouter,
  MockLBPair,
  MockLBHooksBaseRewarder
} from "../typechain-types";

describe("Reward Compounding Integration Tests", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
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

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const BIN_STEP = 25;
  const MIN_AMOUNTS = [ethers.parseEther("0.001"), ethers.parseEther("0.001")];

  beforeEach(async function () {
    [owner, user1, user2, feeRecipient] = await ethers.getSigners();

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
        await tokenX.getAddress(), // Using tokenX as native token for simplicity
        await mockPair.getAddress(),
        await mockPair.getAddress(), // Using same pair for AMM
        await mockPair.getAddress(), // Using same pair for USD
        await mockRouter.getAddress(),
        5, // idSlippage
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
        BIN_STEP,
        MIN_AMOUNTS[0],
        MIN_AMOUNTS[1],
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

    // Transfer ownership of modules to vault (like production deployment)
    await rewardClaimer.transferOwnership(await vault.getAddress());
    await queueHandler.transferOwnership(await vault.getAddress());
    await feeManager.transferOwnership(await vault.getAddress());

    // Setup initial token balances
    await tokenX.mint(user1.address, INITIAL_SUPPLY);
    await tokenY.mint(user1.address, INITIAL_SUPPLY);
    await tokenX.mint(user2.address, INITIAL_SUPPLY);
    await tokenY.mint(user2.address, INITIAL_SUPPLY);
    
    // Mint METRO tokens to rewarder for testing
    await metroToken.mint(await mockRewarder.getAddress(), ethers.parseEther("10000"));

    // Setup approvals
    await tokenX.connect(user1).approve(await vault.getAddress(), INITIAL_SUPPLY);
    await tokenY.connect(user1).approve(await vault.getAddress(), INITIAL_SUPPLY);
    await tokenX.connect(user2).approve(await vault.getAddress(), INITIAL_SUPPLY);
    await tokenY.connect(user2).approve(await vault.getAddress(), INITIAL_SUPPLY);
  });

  describe("Critical Integration Test: Full Reward Compounding Flow", function () {
    it("Should transfer ownership of reward claimer to vault during initialization", async function () {
      // EXPECTED BEHAVIOR: Vault should own the reward claimer
      expect(await rewardClaimer.owner()).to.equal(await vault.getAddress());
    });

    it("Should properly compound METRO rewards into vault balance increasing share values", async function () {
      const depositAmount = ethers.parseEther("100");
      const metroRewardAmount = ethers.parseEther("10");

      // Step 1: Users deposit tokens
      await vault.connect(user1).depositToken(depositAmount, 0); // TokenX
      await vault.connect(user2).depositToken(depositAmount, 1); // TokenY

      // Process deposits through rebalance
      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: await vault.getAddress(),
        refundTo: await vault.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: false
      };

      await vault.connect(owner).rebalance(rebalanceParams);

      // Verify initial shares minted
      const [user1SharesX, user1SharesY] = await vault.getUserShares(user1.address);
      const [user2SharesX, user2SharesY] = await vault.getUserShares(user2.address);
      
      expect(user1SharesX).to.be.gt(0);
      expect(user2SharesY).to.be.gt(0);

      // Get initial vault token balances
      const initialVaultBalanceX = await vault.tokenBalance(0);
      const initialVaultBalanceY = await vault.tokenBalance(1);

      // Get initial share prices
      const initialPricePerShareX = await vault.getPricePerFullShare(0);
      const initialPricePerShareY = await vault.getPricePerFullShare(1);

      // Step 2: Setup mock rewarder to give METRO rewards
      await mockRewarder.setRewardToken(await metroToken.getAddress());
      await mockRewarder.setClaimAmount(metroRewardAmount);

      // Setup mock router to swap METRO to TokenX/TokenY  
      const swappedTokenXAmount = ethers.parseEther("5"); // Simulated swap output
      const swappedTokenYAmount = ethers.parseEther("5"); // Simulated swap output

      // Configure swap outputs for specific tokens (modern method)
      await mockRouter.setSwapOutputForToken(await tokenX.getAddress(), swappedTokenXAmount);
      await mockRouter.setSwapOutputForToken(await tokenY.getAddress(), swappedTokenYAmount);

      // Mint tokens to router so it can perform swaps
      await tokenX.mint(await mockRouter.getAddress(), ethers.parseEther("1000"));
      await tokenY.mint(await mockRouter.getAddress(), ethers.parseEther("1000"));

      // Setup swap paths (CRITICAL: required for reward claimer to function)
      const swapPathX = {
        tokenPath: [await metroToken.getAddress(), await tokenX.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      const swapPathY = {
        tokenPath: [await metroToken.getAddress(), await tokenY.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      // Set minimum swap amount to ensure swaps execute
      await vault.setMinSwapAmount(1);
      
      // Configure swap paths through vault (which owns the reward claimer)
      await vault.setSwapPaths(swapPathX, swapPathY, swapPathX);

      // Step 3: Claim and compound rewards
      await vault.connect(owner).rebalance(rebalanceParams);

      // Step 4: Verify EXPECTED BEHAVIOR - tokens should be in vault, not reward claimer
      const finalVaultBalanceX = await vault.tokenBalance(0);
      const finalVaultBalanceY = await vault.tokenBalance(1);
      
      // Calculate exact expected values:
      // Initial deposit: 100 ether - 0.5% fee = 99.5 ether
      // Plus compounded rewards: +5 ether each = 104.5 ether total
      const expectedFinalBalanceX = ethers.parseEther("104.5");
      const expectedFinalBalanceY = ethers.parseEther("104.5");
      
      // CRITICAL TEST: Vault balance should increase by exact amount (tokens were sent there)
      expect(finalVaultBalanceX).to.equal(expectedFinalBalanceX);
      expect(finalVaultBalanceY).to.equal(expectedFinalBalanceY);

      // CRITICAL TEST: Reward claimer should NOT have the swapped tokens
      const rewardClaimerBalanceX = await tokenX.balanceOf(await rewardClaimer.getAddress());
      const rewardClaimerBalanceY = await tokenY.balanceOf(await rewardClaimer.getAddress());
      expect(rewardClaimerBalanceX).to.equal(0);
      expect(rewardClaimerBalanceY).to.equal(0);

      // Step 5: Verify share prices increased due to compounding
      const finalPricePerShareX = await vault.getPricePerFullShare(0);
      const finalPricePerShareY = await vault.getPricePerFullShare(1);

      // EXPECTED BEHAVIOR: Share prices should increase after compounding
      expect(finalPricePerShareX).to.be.gt(initialPricePerShareX);
      expect(finalPricePerShareY).to.be.gt(initialPricePerShareY);

      // Step 6: Verify analytics tracking works
      const totalCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const totalCompoundedY = await rewardClaimer.getTotalCompounded(1);
      
      expect(totalCompoundedX).to.be.gt(0);
      expect(totalCompoundedY).to.be.gt(0);
    });

    it("Should ensure multiple users benefit proportionally from compounding", async function () {
      const user1Deposit = ethers.parseEther("100");
      const user2Deposit = ethers.parseEther("200"); // 2x larger deposit
      const metroRewardAmount = ethers.parseEther("10");

      // Users deposit different amounts
      await vault.connect(user1).depositToken(user1Deposit, 0);
      await vault.connect(user2).depositToken(user2Deposit, 0);

      // Process deposits
      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: await vault.getAddress(),
        refundTo: await vault.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: false
      };

      await vault.connect(owner).rebalance(rebalanceParams);

      // Get initial share values
      const [user1SharesX,] = await vault.getUserShares(user1.address);
      const [user2SharesX,] = await vault.getUserShares(user2.address);
      const initialPricePerShare = await vault.getPricePerFullShare(0);

      // Calculate initial user values
      const user1InitialValue = (user1SharesX * initialPricePerShare) / ethers.parseEther("1");
      const user2InitialValue = (user2SharesX * initialPricePerShare) / ethers.parseEther("1");

      // Setup and execute reward compounding
      await mockRewarder.setRewardToken(await metroToken.getAddress());
      await mockRewarder.setClaimAmount(metroRewardAmount);
      
      // Configure swap to benefit TokenX only (testing proportional benefit)
      await mockRouter.setSwapOutputForToken(await tokenX.getAddress(), ethers.parseEther("10"));
      await mockRouter.setSwapOutputForToken(await tokenY.getAddress(), 0);
      
      // Mint tokens to router so it can perform swaps
      await tokenX.mint(await mockRouter.getAddress(), ethers.parseEther("1000"));
      
      // Setup swap paths
      const swapPathX = {
        tokenPath: [await metroToken.getAddress(), await tokenX.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      const swapPathY = {
        tokenPath: [await metroToken.getAddress(), await tokenY.getAddress()],
        pairBinSteps: [25],
        versions: [1],
        pairs: [await mockPair.getAddress()]
      };

      await vault.setMinSwapAmount(1);
      await vault.setSwapPaths(swapPathX, swapPathY, swapPathX);

      await vault.connect(owner).rebalance(rebalanceParams);

      // Get final share values
      const finalPricePerShare = await vault.getPricePerFullShare(0);
      const user1FinalValue = (user1SharesX * finalPricePerShare) / ethers.parseEther("1");
      const user2FinalValue = (user2SharesX * finalPricePerShare) / ethers.parseEther("1");

      // EXPECTED BEHAVIOR: Both users benefit proportionally
      const user1Gain = user1FinalValue - user1InitialValue;
      const user2Gain = user2FinalValue - user2InitialValue;

      // User2 should gain approximately 2x more (they deposited 2x more)
      expect(user2Gain).to.be.approximately(user1Gain * 2n, ethers.parseEther("0.1"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero rewards gracefully", async function () {
      const depositAmount = ethers.parseEther("100");

      // User deposits
      await vault.connect(user1).depositToken(depositAmount, 0);

      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: await vault.getAddress(),
        refundTo: await vault.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: false
      };

      // Process with zero rewards
      await mockRewarder.setClaimAmount(0);
      
      // Should not revert
      await expect(vault.connect(owner).rebalance(rebalanceParams)).to.not.be.reverted;
    });

    it("Should handle swap failures gracefully", async function () {
      const depositAmount = ethers.parseEther("100");
      const metroRewardAmount = ethers.parseEther("10");

      await vault.connect(user1).depositToken(depositAmount, 0);

      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: await vault.getAddress(),
        refundTo: await vault.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: false
      };

      await vault.connect(owner).rebalance(rebalanceParams);

      // Setup rewards but make swap fail
      await mockRewarder.setClaimAmount(metroRewardAmount);
      await mockRouter.setShouldFail(true);
      await metroToken.mint(await rewardClaimer.getAddress(), metroRewardAmount);

      // Should not revert even if swap fails
      await expect(vault.connect(owner).rebalance(rebalanceParams)).to.not.be.reverted;
    });
  });
});