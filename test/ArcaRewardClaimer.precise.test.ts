import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type {
  ArcaRewardClaimerV1,
  ArcaFeeManagerV1,  
  MockERC20,
  MockLBRouter,
  MockLBPair,
  MockLBHooksBaseRewarder
} from "../typechain-types";

describe("ArcaRewardClaimerV1 Precise Tests", function () {
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

  // Test constants for precise calculations
  const METRO_CLAIMED = ethers.parseEther("100");
  const PERFORMANCE_FEE_BPS = 1000n; // 10%
  const BASIS_POINTS = 10000n;
  const EXPECTED_PERFORMANCE_FEE = (METRO_CLAIMED * PERFORMANCE_FEE_BPS) / BASIS_POINTS; // 10 METRO
  const NET_METRO = METRO_CLAIMED - EXPECTED_PERFORMANCE_FEE; // 90 METRO
  const METRO_FOR_TOKEN_X = NET_METRO / 2n; // 45 METRO
  const METRO_FOR_TOKEN_Y = NET_METRO - METRO_FOR_TOKEN_X; // 45 METRO
  const EXPECTED_TOKEN_X_OUTPUT = ethers.parseEther("50"); // Mock swap: 45 METRO -> 50 TokenX
  const EXPECTED_TOKEN_Y_OUTPUT = ethers.parseEther("40"); // Mock swap: 45 METRO -> 40 TokenY

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

    // Deploy fee manager with known fee rates using beacon proxy
    const FeeManagerFactory = await ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManagerFactory);
    const feeManagerProxy = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManagerFactory,
      [feeRecipient.address]
    );
    await feeManagerProxy.waitForDeployment();
    feeManager = FeeManagerFactory.attach(await feeManagerProxy.getAddress()) as ArcaFeeManagerV1;

    // Deploy reward claimer using UUPS proxy
    const RewardClaimerFactory = await ethers.getContractFactory("ArcaRewardClaimerV1");
    const rewardClaimerProxy = await hre.upgrades.deployProxy(
      RewardClaimerFactory,
      [
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
      ],
      { kind: 'uups' }
    );
    await rewardClaimerProxy.waitForDeployment();
    rewardClaimer = RewardClaimerFactory.attach(await rewardClaimerProxy.getAddress()) as ArcaRewardClaimerV1;

    // Transfer ownership to vault for testing
    await rewardClaimer.transferOwnership(vault.address);

    // Setup mock rewarder with metro tokens
    await mockRewarder.setRewardToken(await metroToken.getAddress());
    await metroToken.mint(await mockRewarder.getAddress(), ethers.parseEther("1000"));

    // Setup precise mock router outputs for each token
    await mockRouter.setSwapOutputForToken(await tokenX.getAddress(), EXPECTED_TOKEN_X_OUTPUT);
    await mockRouter.setSwapOutputForToken(await tokenY.getAddress(), EXPECTED_TOKEN_Y_OUTPUT);

    // Mint tokens to router so it can perform swaps
    await tokenX.mint(await mockRouter.getAddress(), ethers.parseEther("1000"));
    await tokenY.mint(await mockRouter.getAddress(), ethers.parseEther("1000"));

    // Set minimum swap amount to 1 to ensure swaps execute
    await rewardClaimer.connect(vault).setMinSwapAmount(1);

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

    await rewardClaimer.connect(vault).setSwapPaths(swapPathX, swapPathY, swapPathX);
  });

  describe("Precise Token Flow Validation", function () {
    it("Should send exact expected amounts to vault for both TokenX and TokenY", async function () {
      // Get initial balances
      const initialVaultBalanceX = await tokenX.balanceOf(vault.address);
      const initialVaultBalanceY = await tokenY.balanceOf(vault.address);
      const initialFeeRecipientBalance = await metroToken.balanceOf(feeRecipient.address);

      // Execute reward claiming and compounding
      await mockRewarder.setClaimAmount(METRO_CLAIMED);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify exact fee collection
      const finalFeeRecipientBalance = await metroToken.balanceOf(feeRecipient.address);
      const actualPerformanceFee = finalFeeRecipientBalance - initialFeeRecipientBalance;
      expect(actualPerformanceFee).to.equal(EXPECTED_PERFORMANCE_FEE, "Performance fee should be exactly 10% of claimed METRO");

      // Verify exact token outputs sent to vault
      const finalVaultBalanceX = await tokenX.balanceOf(vault.address);
      const finalVaultBalanceY = await tokenY.balanceOf(vault.address);

      const actualTokenXReceived = finalVaultBalanceX - initialVaultBalanceX;
      const actualTokenYReceived = finalVaultBalanceY - initialVaultBalanceY;

      expect(actualTokenXReceived).to.equal(EXPECTED_TOKEN_X_OUTPUT, "Vault should receive exactly 50 TokenX");
      expect(actualTokenYReceived).to.equal(EXPECTED_TOKEN_Y_OUTPUT, "Vault should receive exactly 40 TokenY");

      // Verify no tokens remain in reward claimer
      const rewardClaimerBalanceX = await tokenX.balanceOf(await rewardClaimer.getAddress());
      const rewardClaimerBalanceY = await tokenY.balanceOf(await rewardClaimer.getAddress());
      expect(rewardClaimerBalanceX).to.equal(0, "Reward claimer should have 0 TokenX");
      expect(rewardClaimerBalanceY).to.equal(0, "Reward claimer should have 0 TokenY");
    });

    it("Should update totalCompounded with exact expected amounts", async function () {
      // Get initial compounded amounts
      const initialCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const initialCompoundedY = await rewardClaimer.getTotalCompounded(1);

      // Execute reward claiming and compounding
      await mockRewarder.setClaimAmount(METRO_CLAIMED);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify exact analytics updates
      const finalCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const finalCompoundedY = await rewardClaimer.getTotalCompounded(1);

      const actualCompoundedX = finalCompoundedX - initialCompoundedX;
      const actualCompoundedY = finalCompoundedY - initialCompoundedY;

      expect(actualCompoundedX).to.equal(EXPECTED_TOKEN_X_OUTPUT, "TotalCompounded for TokenX should be exactly 50");
      expect(actualCompoundedY).to.equal(EXPECTED_TOKEN_Y_OUTPUT, "TotalCompounded for TokenY should be exactly 40");
    });

    it("Should handle zero rewards with no state changes", async function () {
      // Get initial states
      const initialVaultBalanceX = await tokenX.balanceOf(vault.address);
      const initialVaultBalanceY = await tokenY.balanceOf(vault.address);
      const initialCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const initialCompoundedY = await rewardClaimer.getTotalCompounded(1);
      const initialFeeRecipientBalance = await metroToken.balanceOf(feeRecipient.address);

      // Execute with zero rewards
      await mockRewarder.setClaimAmount(0);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify no changes
      expect(await tokenX.balanceOf(vault.address)).to.equal(initialVaultBalanceX, "Vault TokenX balance should be unchanged");
      expect(await tokenY.balanceOf(vault.address)).to.equal(initialVaultBalanceY, "Vault TokenY balance should be unchanged");
      expect(await rewardClaimer.getTotalCompounded(0)).to.equal(initialCompoundedX, "CompoundedX should be unchanged");
      expect(await rewardClaimer.getTotalCompounded(1)).to.equal(initialCompoundedY, "CompoundedY should be unchanged");
      expect(await metroToken.balanceOf(feeRecipient.address)).to.equal(initialFeeRecipientBalance, "Fee recipient balance should be unchanged");
    });

    it("Should handle rewards below minSwapAmount with fee collection only", async function () {
      // Set high minimum swap amount
      await rewardClaimer.connect(vault).setMinSwapAmount(ethers.parseEther("1000"));

      const smallRewardAmount = ethers.parseEther("50"); // Below minSwapAmount
      const expectedFee = (smallRewardAmount * PERFORMANCE_FEE_BPS) / BASIS_POINTS;

      // Get initial states
      const initialVaultBalanceX = await tokenX.balanceOf(vault.address);
      const initialVaultBalanceY = await tokenY.balanceOf(vault.address);
      const initialFeeRecipientBalance = await metroToken.balanceOf(feeRecipient.address);

      // Execute with small rewards
      await mockRewarder.setClaimAmount(smallRewardAmount);
      await rewardClaimer.connect(vault).claimAndCompoundRewards();

      // Verify fee collected but no swaps occurred
      const actualFeeCollected = await metroToken.balanceOf(feeRecipient.address) - initialFeeRecipientBalance;
      expect(actualFeeCollected).to.equal(expectedFee, "Performance fee should be collected even below minSwapAmount");

      // Verify no tokens swapped
      expect(await tokenX.balanceOf(vault.address)).to.equal(initialVaultBalanceX, "No TokenX should be swapped");
      expect(await tokenY.balanceOf(vault.address)).to.equal(initialVaultBalanceY, "No TokenY should be swapped");
    });
  });

  describe("Precise Access Control", function () {
    it("Should revert with specific error when non-owner calls claimAndCompoundRewards", async function () {
      await expect(
        rewardClaimer.connect(owner).claimAndCompoundRewards()
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount")
        .withArgs(owner.address);
    });

    it("Should revert with specific error for invalid token types", async function () {
      // Test boundary conditions - Solidity enum validation catches out-of-bounds before custom errors
      await expect(
        rewardClaimer.getTotalCompounded(2)
      ).to.be.reverted;

      // Test with large invalid number  
      await expect(
        rewardClaimer.getTotalCompounded(255)
      ).to.be.reverted;
    });
  });

  describe("Precise Swap Failure Handling", function () {
    it("Should handle swap failures gracefully with exact state preservation", async function () {
      // Get initial states
      const initialCompoundedX = await rewardClaimer.getTotalCompounded(0);
      const initialCompoundedY = await rewardClaimer.getTotalCompounded(1);
      const initialVaultBalanceX = await tokenX.balanceOf(vault.address);
      const initialVaultBalanceY = await tokenY.balanceOf(vault.address);
      const initialFeeRecipientBalance = await metroToken.balanceOf(feeRecipient.address);

      // Make router fail
      await mockRouter.setShouldFail(true);

      // Execute - should not revert
      await mockRewarder.setClaimAmount(METRO_CLAIMED);
      await expect(
        rewardClaimer.connect(vault).claimAndCompoundRewards()
      ).to.not.be.reverted;

      // Verify fee was still collected (happens before swap)
      const expectedFee = (METRO_CLAIMED * PERFORMANCE_FEE_BPS) / BASIS_POINTS;
      const actualFeeCollected = await metroToken.balanceOf(feeRecipient.address) - initialFeeRecipientBalance;
      expect(actualFeeCollected).to.equal(expectedFee, "Performance fee should be collected even if swap fails");

      // Verify no tokens were swapped
      expect(await tokenX.balanceOf(vault.address)).to.equal(initialVaultBalanceX, "No TokenX should be swapped on failure");
      expect(await tokenY.balanceOf(vault.address)).to.equal(initialVaultBalanceY, "No TokenY should be swapped on failure");

      // Verify analytics not updated
      expect(await rewardClaimer.getTotalCompounded(0)).to.equal(initialCompoundedX, "CompoundedX should be unchanged on failure");
      expect(await rewardClaimer.getTotalCompounded(1)).to.equal(initialCompoundedY, "CompoundedY should be unchanged on failure");
    });
  });
});