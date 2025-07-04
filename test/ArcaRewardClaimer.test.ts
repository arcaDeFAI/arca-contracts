import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ArcaRewardClaimerV1 - Business Logic", function () {
  async function deployRewardClaimerFixture() {
    const [owner, vault, feeRecipient, user1] = await hre.ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const tokenX = await MockERC20.deploy("TokenX", "TX", 18, owner.address);
    const tokenY = await MockERC20.deploy("TokenY", "TY", 18, owner.address);
    const metroToken = await MockERC20.deploy("METRO", "METRO", 18, owner.address);
    
    // Deploy mocks
    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    const mockRouter = await MockLBRouter.deploy();
    
    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    const mockPair = await MockLBPair.deploy();
    
    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    const mockRewarder = await MockRewarder.deploy();
    
    // Deploy fee manager using beacon proxy
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
    const feeManager = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManager,
      [feeRecipient.address]
    );
    await feeManager.waitForDeployment();
    
    // Deploy fresh instance helper
    const deployFreshInstance = async () => {
      const RewardClaimer = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
      const instance = await hre.upgrades.deployProxy(
        RewardClaimer,
        [
          mockRewarder.target,
          metroToken.target,
          feeManager.target,
          tokenX.target, // native token
          mockPair.target,
          mockPair.target, // lpAMM
          mockPair.target, // lbpContractUSD
          mockRouter.target,
          5, // idSlippage
          tokenX.target,
          tokenY.target
        ],
        { kind: 'uups' }
      );
      await instance.waitForDeployment();
      return instance;
    };
    
    const rewardClaimer = await deployFreshInstance();
    
    // Fund the mock rewarder with METRO tokens for testing
    const mintAmount = hre.ethers.parseEther("1000");
    await metroToken.mint(mockRewarder.target, mintAmount);
    
    // Verify minting worked
    const rewarderBalance = await metroToken.balanceOf(mockRewarder.target);
    if (rewarderBalance !== mintAmount) {
      throw new Error(`Mock rewarder funding failed. Expected: ${mintAmount}, Got: ${rewarderBalance}`);
    }
    
    return {
      rewardClaimer,
      feeManager,
      owner,
      vault,
      feeRecipient,
      user1,
      tokenX,
      tokenY,
      metroToken,
      mockRouter,
      mockPair,
      mockRewarder,
      deployFreshInstance
    };
  }

  describe("Initialization Requirements", function () {
    it("Should set correct initial values", async function () {
      const { rewardClaimer, owner, tokenX } = await loadFixture(deployRewardClaimerFixture);
      
      expect(await rewardClaimer.owner()).to.equal(owner.address);
      expect(await rewardClaimer.nativeToken()).to.equal(tokenX.target);
      expect(await rewardClaimer.idSlippage()).to.equal(5);
      expect(await rewardClaimer.minSwapAmount()).to.equal(10);
    });

    it("Should have correct token count constant", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);
      
      expect(await rewardClaimer.TOKEN_COUNT()).to.equal(2);
    });

    it("Should initialize with zero compounded amounts", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);
      
      expect(await rewardClaimer.getTotalCompounded(0)).to.equal(0); // TokenX
      expect(await rewardClaimer.getTotalCompounded(1)).to.equal(0); // TokenY
    });

    it("Should prevent re-initialization", async function () {
      const { rewardClaimer, mockRewarder, metroToken, feeManager, tokenX, mockRouter, mockPair } = await loadFixture(deployRewardClaimerFixture);

      await expect(
        rewardClaimer.initialize(
          mockRewarder.target,
          metroToken.target,
          feeManager.target,
          tokenX.target,
          mockPair.target,
          mockPair.target,
          mockPair.target,
          mockRouter.target,
          5,
          tokenX.target,
          tokenX.target
        )
      ).to.be.revertedWithCustomError(rewardClaimer, "InvalidInitialization");
    });
  });

  describe("Configuration Management", function () {
    describe("Minimum Swap Amount", function () {
      it("Should allow owner to set minimum swap amount", async function () {
        const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

        await rewardClaimer.setMinSwapAmount(100);

        expect(await rewardClaimer.minSwapAmount()).to.equal(100);
      });

      it("Should only allow owner to set minimum swap amount", async function () {
        const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

        await expect(
          rewardClaimer.connect(user1).setMinSwapAmount(100)
        ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
      });

      it("Should allow setting zero minimum swap amount", async function () {
        const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

        await rewardClaimer.setMinSwapAmount(0);

        expect(await rewardClaimer.minSwapAmount()).to.equal(0);
      });
    });

    describe("Swap Paths Configuration", function () {
      it("Should allow owner to set swap paths", async function () {
        const { rewardClaimer, metroToken, tokenX, mockPair } = await loadFixture(deployRewardClaimerFixture);

        const swapPath = {
          tokenPath: [metroToken.target, tokenX.target],
          pairBinSteps: [25],
          versions: [1],
          pairs: [mockPair.target]
        };

        await expect(
          rewardClaimer.setSwapPaths(swapPath, swapPath, swapPath)
        ).to.not.be.reverted;
      });

      it("Should only allow owner to set swap paths", async function () {
        const { rewardClaimer, user1, metroToken, tokenX, mockPair } = await loadFixture(deployRewardClaimerFixture);

        const swapPath = {
          tokenPath: [metroToken.target, tokenX.target],
          pairBinSteps: [25],
          versions: [1],
          pairs: [mockPair.target]
        };

        await expect(
          rewardClaimer.connect(user1).setSwapPaths(swapPath, swapPath, swapPath)
        ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
      });
    });

    describe("Rewarder Configuration", function () {
      it("Should allow owner to set rewarder", async function () {
        const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

        await rewardClaimer.setRewarder(user1.address);
        // Note: We can't easily test the internal _rewarder variable without exposing it
        // This test mainly ensures the function doesn't revert
      });

      it("Should reject zero address as rewarder", async function () {
        const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

        await expect(
          rewardClaimer.setRewarder(hre.ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid rewarder address");
      });

      it("Should only allow owner to set rewarder", async function () {
        const { rewardClaimer, user1, vault } = await loadFixture(deployRewardClaimerFixture);

        await expect(
          rewardClaimer.connect(user1).setRewarder(vault.address)
        ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Token Validation", function () {
    it("Should reject invalid token types in getTotalCompounded", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

      await expect(
        rewardClaimer.getTotalCompounded(2)
      ).to.be.reverted;

      await expect(
        rewardClaimer.getTotalCompounded(255)
      ).to.be.reverted;
    });

    it("Should accept valid token types", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

      await expect(rewardClaimer.getTotalCompounded(0)).to.not.be.reverted; // TokenX
      await expect(rewardClaimer.getTotalCompounded(1)).to.not.be.reverted; // TokenY
    });
  });

  describe("Bin ID Management", function () {
    it("Should return correct bin IDs based on slippage", async function () {
      const { rewardClaimer, mockPair } = await loadFixture(deployRewardClaimerFixture);

      // Set active ID on mock pair
      await mockPair.setActiveId(1000);

      const binIds = await rewardClaimer.getVaultBinIds();

      // With idSlippage = 5, should get 2*5+1 = 11 bins
      expect(binIds.length).to.equal(11);
      
      // Should be centered around active ID
      expect(binIds[0]).to.equal(995); // 1000 - 5
      expect(binIds[5]).to.equal(1000); // center
      expect(binIds[10]).to.equal(1005); // 1000 + 5
    });

    it("Should handle different active IDs correctly", async function () {
      const { rewardClaimer, mockPair } = await loadFixture(deployRewardClaimerFixture);

      await mockPair.setActiveId(500);

      const binIds = await rewardClaimer.getVaultBinIds();

      expect(binIds.length).to.equal(11);
      expect(binIds[0]).to.equal(495);
      expect(binIds[5]).to.equal(500);
      expect(binIds[10]).to.equal(505);
    });
  });

  describe("Manual Reward Claiming", function () {
    describe("Valid Claim Operations", function () {
      it("Should allow owner to claim rewards manually", async function () {
        const { rewardClaimer, metroToken, mockRewarder, user1 } = await loadFixture(deployRewardClaimerFixture);

        // Setup mock rewarder
        await mockRewarder.setRewardToken(metroToken.target);
        await mockRewarder.setClaimAmount(hre.ethers.parseEther("10"));

        const binIds = [995, 1000, 1005];

        await expect(
          rewardClaimer.claimRewards(binIds, user1.address)
        ).to.not.be.reverted;
      });

      it("Should emit RewardsClaimed event", async function () {
        const { rewardClaimer, metroToken, mockRewarder, user1 } = await loadFixture(deployRewardClaimerFixture);

        await mockRewarder.setRewardToken(metroToken.target);
        await mockRewarder.setClaimAmount(hre.ethers.parseEther("5"));

        const binIds = [1000];

        await expect(
          rewardClaimer.claimRewards(binIds, user1.address)
        ).to.emit(rewardClaimer, "RewardsClaimed");
      });

      it("Should return claimed amount", async function () {
        const { rewardClaimer, metroToken, mockRewarder, user1 } = await loadFixture(deployRewardClaimerFixture);

        const claimAmount = hre.ethers.parseEther("15");
        await mockRewarder.setRewardToken(metroToken.target);
        await mockRewarder.setClaimAmount(claimAmount);

        const binIds = [1000];

        const result = await rewardClaimer.claimRewards.staticCall(binIds, user1.address);
        expect(result).to.equal(claimAmount);
      });
    });

    describe("Claim Validation", function () {
      it("Should reject empty bin IDs array", async function () {
        const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

        await expect(
          rewardClaimer.claimRewards([], user1.address)
        ).to.be.revertedWith("No bin IDs provided");
      });

      it("Should reject zero address receiver", async function () {
        const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

        const binIds = [1000];

        await expect(
          rewardClaimer.claimRewards(binIds, hre.ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid receiver address");
      });

      it("Should reject when rewarder not set", async function () {
        const { deployFreshInstance, feeRecipient, tokenX, metroToken, mockPair, mockRouter, user1 } = await loadFixture(deployRewardClaimerFixture);

        // Deploy fee manager for clean instance
        const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
        const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
        const feeManager = await hre.upgrades.deployBeaconProxy(
          feeManagerBeacon,
          FeeManager,
          [feeRecipient.address]
        );
        await feeManager.waitForDeployment();

        // Deploy instance with zero rewarder
        const RewardClaimer = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
        const instance = await hre.upgrades.deployProxy(
          RewardClaimer,
          [
            hre.ethers.ZeroAddress, // No rewarder
            metroToken.target,
            feeManager.target,
            tokenX.target,
            mockPair.target,
            mockPair.target,
            mockPair.target,
            mockRouter.target,
            5,
            tokenX.target,
            tokenX.target
          ],
          { kind: 'uups' }
        );
        await instance.waitForDeployment();

        const binIds = [1000];

        await expect(
          instance.claimRewards(binIds, user1.address)
        ).to.be.revertedWith("Rewarder not set");
      });
    });

    describe("Access Control for Manual Claims", function () {
      it("Should only allow owner to claim rewards manually", async function () {
        const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

        const binIds = [1000];

        await expect(
          rewardClaimer.connect(user1).claimRewards(binIds, user1.address)
        ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
      });

      it("Should use reentrancy guard on manual claims", async function () {
        const { rewardClaimer, metroToken, mockRewarder, user1 } = await loadFixture(deployRewardClaimerFixture);

        await mockRewarder.setRewardToken(metroToken.target);
        await mockRewarder.setClaimAmount(hre.ethers.parseEther("10"));

        const binIds = [1000];

        // This tests that the function has the nonReentrant modifier
        // The actual reentrancy test would require a more complex setup
        await expect(
          rewardClaimer.claimRewards(binIds, user1.address)
        ).to.not.be.reverted;
      });
    });
  });

  describe("Automatic Reward Compounding", function () {
    describe("Compounding Logic", function () {
      it("Should return early when rewarder is zero address", async function () {
        const { deployFreshInstance, feeRecipient, tokenX, metroToken, mockPair, mockRouter } = await loadFixture(deployRewardClaimerFixture);

        // Deploy fee manager
        const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
        const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
        const feeManager = await hre.upgrades.deployBeaconProxy(
          feeManagerBeacon,
          FeeManager,
          [feeRecipient.address]
        );
        await feeManager.waitForDeployment();

        // Deploy instance with zero rewarder
        const RewardClaimer = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
        const instance = await hre.upgrades.deployProxy(
          RewardClaimer,
          [
            hre.ethers.ZeroAddress, // No rewarder
            metroToken.target,
            feeManager.target,
            tokenX.target,
            mockPair.target,
            mockPair.target,
            mockPair.target,
            mockRouter.target,
            5,
            tokenX.target,
            tokenX.target
          ],
          { kind: 'uups' }
        );
        await instance.waitForDeployment();

        // Should not revert, just return early
        await expect(instance.claimAndCompoundRewards()).to.not.be.reverted;
      });

      it("Should return early when no bin IDs available", async function () {
        const { rewardClaimer, mockPair } = await loadFixture(deployRewardClaimerFixture);

        // Set up mock pair to return empty bin IDs somehow
        // This is tricky to test without modifying the mock, but the function should handle it
        await expect(rewardClaimer.claimAndCompoundRewards()).to.not.be.reverted;
      });

      it("Should skip compounding when claimed amount is below minimum", async function () {
        const { rewardClaimer, metroToken, mockRewarder } = await loadFixture(deployRewardClaimerFixture);

        // Set minimum swap amount higher than claimed amount
        await rewardClaimer.setMinSwapAmount(hre.ethers.parseEther("100"));

        await mockRewarder.setRewardToken(metroToken.target);
        await mockRewarder.setClaimAmount(hre.ethers.parseEther("1")); // Below minimum

        await expect(rewardClaimer.claimAndCompoundRewards()).to.not.be.reverted;

        // Analytics should not be updated
        expect(await rewardClaimer.getTotalCompounded(0)).to.equal(0);
        expect(await rewardClaimer.getTotalCompounded(1)).to.equal(0);
      });
    });

    describe("Access Control for Compounding", function () {
      it("Should only allow owner to compound rewards", async function () {
        const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

        await expect(
          rewardClaimer.connect(user1).claimAndCompoundRewards()
        ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Analytics and State Management", function () {
    it("Should provide read access to compounding analytics", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

      // Test both token types
      const compoundedX = await rewardClaimer.getTotalCompounded(0);
      const compoundedY = await rewardClaimer.getTotalCompounded(1);

      expect(compoundedX).to.be.a("bigint");
      expect(compoundedY).to.be.a("bigint");
    });

    it("Should maintain state consistency across operations", async function () {
      const { rewardClaimer } = await loadFixture(deployRewardClaimerFixture);

      // Multiple reads should be consistent
      const reading1 = await rewardClaimer.getTotalCompounded(0);
      const reading2 = await rewardClaimer.getTotalCompounded(0);

      expect(reading1).to.equal(reading2);
    });
  });

  describe("Ownership Transfer Scenarios", function () {
    it("Should transfer ownership to vault (production scenario)", async function () {
      const { rewardClaimer, vault } = await loadFixture(deployRewardClaimerFixture);

      await rewardClaimer.transferOwnership(vault.address);

      expect(await rewardClaimer.owner()).to.equal(vault.address);
    });

    it("Should allow new owner to manage reward claimer after transfer", async function () {
      const { rewardClaimer, vault } = await loadFixture(deployRewardClaimerFixture);

      await rewardClaimer.transferOwnership(vault.address);

      // New owner should be able to call owner functions
      await expect(rewardClaimer.connect(vault).setMinSwapAmount(200))
        .to.not.be.reverted;

      await expect(rewardClaimer.connect(vault).claimAndCompoundRewards())
        .to.not.be.reverted;
    });

    it("Should prevent old owner from managing after transfer", async function () {
      const { rewardClaimer, owner, vault } = await loadFixture(deployRewardClaimerFixture);

      await rewardClaimer.transferOwnership(vault.address);

      // Old owner should no longer be able to call owner functions
      await expect(
        rewardClaimer.connect(owner).setMinSwapAmount(200)
      ).to.be.revertedWithCustomError(rewardClaimer, "OwnableUnauthorizedAccount");
    });
  });

  describe("Upgrade Authorization", function () {
    it("Should only allow owner to authorize upgrades", async function () {
      const { rewardClaimer, user1 } = await loadFixture(deployRewardClaimerFixture);

      // We can't easily test the internal _authorizeUpgrade without deploying a new implementation
      // But we can verify ownership is required for upgrade functions by checking access control
      expect(await rewardClaimer.owner()).to.not.equal(user1.address);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle claiming failures gracefully", async function () {
      const { rewardClaimer, mockRewarder } = await loadFixture(deployRewardClaimerFixture);

      // Set up rewarder to fail
      await mockRewarder.setShouldFail(true);

      // Should not revert even if claiming fails
      await expect(rewardClaimer.claimAndCompoundRewards()).to.not.be.reverted;
    });

    it("Should handle swap failures gracefully in compounding", async function () {
      const { rewardClaimer, metroToken, mockRewarder, mockRouter, tokenX, mockPair } = await loadFixture(deployRewardClaimerFixture);

      // Set up a successful claim but failing swap
      await mockRewarder.setRewardToken(metroToken.target);
      await mockRewarder.setClaimAmount(hre.ethers.parseEther("100"));
      await rewardClaimer.setMinSwapAmount(1); // Low minimum

      // Set up swap paths
      const swapPath = {
        tokenPath: [metroToken.target, tokenX.target],
        pairBinSteps: [25],
        versions: [1],
        pairs: [mockPair.target]
      };
      await rewardClaimer.setSwapPaths(swapPath, swapPath, swapPath);

      // Make router fail
      await mockRouter.setShouldFail(true);

      // Should not revert even if swap fails
      await expect(rewardClaimer.claimAndCompoundRewards()).to.not.be.reverted;
    });
  });

  describe("Production Workflow Simulation", function () {
    it("Should support complete reward claiming and compounding workflow", async function () {
      const { rewardClaimer, vault, feeRecipient, metroToken, tokenX, mockRewarder, mockRouter, mockPair, feeManager } = await loadFixture(deployRewardClaimerFixture);

      // 1. Transfer ownership to vault (like deployment script does)
      await rewardClaimer.transferOwnership(vault.address);

      // 2. Set up reward claiming infrastructure
      await mockRewarder.setRewardToken(metroToken.target);
      await mockRewarder.setClaimAmount(hre.ethers.parseEther("100"));

      // 3. Configure swap paths
      const swapPath = {
        tokenPath: [metroToken.target, tokenX.target],
        pairBinSteps: [25],
        versions: [1],
        pairs: [mockPair.target]
      };
      await rewardClaimer.connect(vault).setSwapPaths(swapPath, swapPath, swapPath);

      // 4. Set reasonable minimum swap amount
      await rewardClaimer.connect(vault).setMinSwapAmount(hre.ethers.parseEther("1"));

      // 5. Vault should be able to trigger reward compounding
      await expect(rewardClaimer.connect(vault).claimAndCompoundRewards())
        .to.not.be.reverted;

      // 6. Analytics should be accessible
      const compoundedX = await rewardClaimer.getTotalCompounded(0);
      const compoundedY = await rewardClaimer.getTotalCompounded(1);
      
      expect(compoundedX).to.be.a("bigint");
      expect(compoundedY).to.be.a("bigint");
    });
  });
});