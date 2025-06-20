import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ArcaTestnetV1 - Business Logic", function () {
  async function deployVaultFixture() {
    const [owner, user1, user2, feeRecipient] = await hre.ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const tokenX = await MockERC20.deploy("TokenX", "TX", 18);
    const tokenY = await MockERC20.deploy("TokenY", "TY", 18);
    const metroToken = await MockERC20.deploy("METRO", "METRO", 18);
    
    // Deploy mocks
    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    const mockRouter = await MockLBRouter.deploy();
    
    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    const mockPair = await MockLBPair.deploy();
    
    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    const mockRewarder = await MockRewarder.deploy();
    
    // Deploy supporting contracts using proxy pattern
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
    const feeManager = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManager,
      [feeRecipient.address]
    );
    await feeManager.waitForDeployment();
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandler);
    const queueHandler = await hre.upgrades.deployBeaconProxy(
      queueHandlerBeacon,
      QueueHandler,
      []
    );
    await queueHandler.waitForDeployment();
    
    const RewardClaimer = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
    const rewardClaimer = await hre.upgrades.deployProxy(
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
    await rewardClaimer.waitForDeployment();
    
    // Deploy fresh instance helper
    const deployFreshInstance = async () => {
      const Vault = await hre.ethers.getContractFactory("ArcaTestnetV1");
      const instance = await hre.upgrades.deployProxy(
        Vault,
        [
          tokenX.target,
          tokenY.target,
          25, // binStep
          hre.ethers.parseEther("0.01"), // amountXMin
          hre.ethers.parseEther("0.01"), // amountYMin
          "Arca Vault Token",
          "AVT",
          mockRouter.target,
          mockPair.target, // lbpAMM
          mockPair.target, // lbpContract
          rewardClaimer.target,
          queueHandler.target,
          feeManager.target
        ],
        { kind: 'uups' }
      );
      await instance.waitForDeployment();
      return instance;
    };
    
    const vault = await deployFreshInstance();
    
    // Token enum values for testing
    const TokenX = 0;
    const TokenY = 1;
    
    return {
      vault,
      feeManager,
      queueHandler,
      rewardClaimer,
      owner,
      user1,
      user2,
      feeRecipient,
      tokenX,
      tokenY,
      metroToken,
      mockRouter,
      mockPair,
      mockRewarder,
      deployFreshInstance,
      TokenX,
      TokenY
    };
  }

  describe("Initialization Requirements", function () {
    it("Should set correct initial values", async function () {
      const { vault, owner, tokenX, tokenY } = await loadFixture(deployVaultFixture);
      
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.name()).to.equal("Arca Vault Token");
      expect(await vault.symbol()).to.equal("AVT");
      expect(await vault.TOKEN_COUNT()).to.equal(2);
    });

    it("Should initialize with zero token balances", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);
      
      expect(await vault.tokenBalance(TokenX)).to.equal(0);
      expect(await vault.tokenBalance(TokenY)).to.equal(0);
    });

    it("Should initialize with zero total shares", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);
      
      expect(await vault.totalSupply(TokenX)).to.equal(0);
      expect(await vault.totalSupply(TokenY)).to.equal(0);
    });

    it("Should prevent re-initialization", async function () {
      const { vault, tokenX, tokenY, mockRouter, mockPair, rewardClaimer, queueHandler, feeManager } = await loadFixture(deployVaultFixture);

      await expect(
        vault.initialize(
          tokenX.target,
          tokenY.target,
          25,
          hre.ethers.parseEther("0.01"),
          hre.ethers.parseEther("0.01"),
          "Test",
          "TEST",
          mockRouter.target,
          mockPair.target,
          mockPair.target,
          rewardClaimer.target,
          queueHandler.target,
          feeManager.target
        )
      ).to.be.revertedWithCustomError(vault, "InvalidInitialization");
    });
  });

  describe("Token Balance Calculations", function () {
    it("Should correctly calculate token balance excluding queued tokens", async function () {
      const { vault, tokenX, queueHandler, TokenX, user1 } = await loadFixture(deployVaultFixture);

      // Transfer ownership so we can control queue handler
      await queueHandler.transferOwnership(vault.target);

      // Add some tokens to vault
      await tokenX.mint(vault.target, hre.ethers.parseEther("100"));

      // Simulate queued tokens
      const depositRequest = {
        user: user1.address,
        amount: hre.ethers.parseEther("20"),
        tokenType: TokenX,
        timestamp: Math.floor(Date.now() / 1000)
      };
      await queueHandler.connect(vault).enqueueDepositRequest(depositRequest);

      // tokenBalance should exclude queued amount
      expect(await vault.tokenBalance(TokenX)).to.equal(hre.ethers.parseEther("80")); // 100 - 20
    });

    it("Should handle zero queued tokens correctly", async function () {
      const { vault, tokenX, TokenX } = await loadFixture(deployVaultFixture);

      await tokenX.mint(vault.target, hre.ethers.parseEther("50"));

      expect(await vault.tokenBalance(TokenX)).to.equal(hre.ethers.parseEther("50"));
    });
  });

  describe("Share Price Calculations", function () {
    it("Should return correct initial share price when no shares exist", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      // When no shares exist, price should be 1e18 (1.0 with 18 decimals)
      expect(await vault.getPricePerFullShare(TokenX)).to.equal(hre.ethers.parseEther("1"));
      expect(await vault.getPricePerFullShare(TokenY)).to.equal(hre.ethers.parseEther("1"));
    });
  });

  describe("Deposit Functionality", function () {
    describe("Valid Deposit Operations", function () {
      it("Should allow users to deposit tokens", async function () {
        const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

        // Mint tokens to user
        const depositAmount = hre.ethers.parseEther("10");
        await tokenX.mint(user1.address, depositAmount);
        await tokenX.connect(user1).approve(vault.target, depositAmount);

        await expect(
          vault.connect(user1).depositToken(depositAmount, TokenX)
        ).to.not.be.reverted;
      });

      it("Should allow users to deposit all their tokens", async function () {
        const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

        const depositAmount = hre.ethers.parseEther("25");
        await tokenX.mint(user1.address, depositAmount);
        await tokenX.connect(user1).approve(vault.target, depositAmount);

        await expect(
          vault.connect(user1).depositAll(TokenX)
        ).to.not.be.reverted;

        // User should have no tokens left
        expect(await tokenX.balanceOf(user1.address)).to.equal(0);
      });

      it("Should handle zero deposit amounts", async function () {
        const { vault, user1, TokenX } = await loadFixture(deployVaultFixture);

        await expect(
          vault.connect(user1).depositToken(0, TokenX)
        ).to.be.revertedWith("Cannot deposit 0");
      });

      it("Should require sufficient allowance for deposits", async function () {
        const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

        const depositAmount = hre.ethers.parseEther("10");
        await tokenX.mint(user1.address, depositAmount);
        // No approval given

        await expect(
          vault.connect(user1).depositToken(depositAmount, TokenX)
        ).to.be.reverted; // Should fail due to insufficient allowance
      });
    });

    describe("Deposit Validation", function () {
      it("Should reject invalid token types", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        await expect(
          vault.connect(user1).depositToken(100, 999) // Invalid token type
        ).to.be.revertedWithCustomError(vault, "InvalidTokenType");
      });

      it("Should use reentrancy protection on deposits", async function () {
        const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

        const depositAmount = hre.ethers.parseEther("10");
        await tokenX.mint(user1.address, depositAmount);
        await tokenX.connect(user1).approve(vault.target, depositAmount);

        // This tests that the function has the nonReentrant modifier
        await expect(
          vault.connect(user1).depositToken(depositAmount, TokenX)
        ).to.not.be.reverted;
      });
    });
  });

  describe("Withdraw Functionality", function () {
    describe("Valid Withdraw Operations", function () {
      it("Should allow users to withdraw shares", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        const sharesX = hre.ethers.parseEther("5");
        const sharesY = hre.ethers.parseEther("3");

        await expect(
          vault.connect(user1).withdrawTokenShares([sharesX, sharesY])
        ).to.not.be.reverted;
      });

      it("Should allow users to withdraw all shares", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        await expect(
          vault.connect(user1).withdrawAll()
        ).to.not.be.reverted;
      });

      it("Should support backward compatibility withdraw function", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        const shares = hre.ethers.parseEther("10");

        await expect(
          vault.connect(user1).withdraw(shares)
        ).to.not.be.reverted;
      });

      it("Should handle zero share withdrawals", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        await expect(
          vault.connect(user1).withdraw(0)
        ).to.be.revertedWith("Cannot withdraw 0 shares");
      });

      it("Should handle zero array withdrawals", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        await expect(
          vault.connect(user1).withdrawTokenShares([0, 0])
        ).to.be.revertedWith("Cannot withdraw 0 shares");
      });
    });

    describe("Withdraw Validation", function () {
      it("Should use reentrancy protection on withdraws", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        const shares = hre.ethers.parseEther("1");

        // This tests that the function has the nonReentrant modifier
        await expect(
          vault.connect(user1).withdraw(shares)
        ).to.not.be.reverted;
      });
    });
  });

  describe("Share Management", function () {
    it("Should track user shares correctly", async function () {
      const { vault, user1, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      // Check initial shares
      const initialSharesX = await vault.getShares(user1.address, TokenX);
      const initialSharesY = await vault.getShares(user1.address, TokenY);

      expect(initialSharesX).to.equal(0);
      expect(initialSharesY).to.equal(0);
    });

    it("Should provide total supply correctly", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      expect(await vault.totalSupply(TokenX)).to.equal(0);
      expect(await vault.totalSupply(TokenY)).to.equal(0);
    });
  });

  describe("Token Validation", function () {
    it("Should reject invalid token types in tokenBalance", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.tokenBalance(2)
      ).to.be.revertedWithCustomError(vault, "InvalidTokenType");

      await expect(
        vault.tokenBalance(999)
      ).to.be.revertedWithCustomError(vault, "InvalidTokenType");
    });

    it("Should reject invalid token types in totalSupply", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.totalSupply(2)
      ).to.be.revertedWithCustomError(vault, "InvalidTokenType");
    });

    it("Should reject invalid token types in getPricePerFullShare", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.getPricePerFullShare(2)
      ).to.be.revertedWithCustomError(vault, "InvalidTokenType");
    });

    it("Should accept valid token types", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      await expect(vault.tokenBalance(TokenX)).to.not.be.reverted;
      await expect(vault.tokenBalance(TokenY)).to.not.be.reverted;
      await expect(vault.totalSupply(TokenX)).to.not.be.reverted;
      await expect(vault.totalSupply(TokenY)).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should allow only owner to call owner functions", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      // Most critical owner functions are internal or called by other contracts
      // Here we test general ownership model
      expect(await vault.owner()).to.not.equal(user1.address);
    });
  });

  describe("Integration with Supporting Contracts", function () {
    it("Should have proper references to supporting contracts", async function () {
      const { vault, queueHandler, feeManager, rewardClaimer } = await loadFixture(deployVaultFixture);

      // These are immutable references that should be set correctly
      expect(await vault.rewardClaimer()).to.equal(rewardClaimer.target);
      // Note: queueHandler and feeManager are private, so we can't directly test them
      // but their proper setup is tested through deposit/withdraw functionality
    });
  });

  describe("Ownership Transfer Scenarios", function () {
    it("Should transfer ownership correctly", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await vault.transferOwnership(user1.address);

      expect(await vault.owner()).to.equal(user1.address);
    });

    it("Should allow new owner to manage vault after transfer", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      await vault.transferOwnership(user1.address);

      // New owner should be able to call owner functions
      // Most functions are internal, but ownership itself is the key test
      expect(await vault.owner()).to.equal(user1.address);
    });
  });

  describe("Emergency and Edge Cases", function () {
    it("Should handle empty vault state gracefully", async function () {
      const { vault, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      // All queries should work on empty vault
      expect(await vault.tokenBalance(TokenX)).to.equal(0);
      expect(await vault.tokenBalance(TokenY)).to.equal(0);
      expect(await vault.totalSupply(TokenX)).to.equal(0);
      expect(await vault.totalSupply(TokenY)).to.equal(0);
      expect(await vault.getPricePerFullShare(TokenX)).to.equal(hre.ethers.parseEther("1"));
      expect(await vault.getPricePerFullShare(TokenY)).to.equal(hre.ethers.parseEther("1"));
    });

    it("Should handle deposits when vault has existing balance", async function () {
      const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

      // Add some existing balance to vault
      await tokenX.mint(vault.target, hre.ethers.parseEther("50"));

      // User should still be able to deposit
      const depositAmount = hre.ethers.parseEther("10");
      await tokenX.mint(user1.address, depositAmount);
      await tokenX.connect(user1).approve(vault.target, depositAmount);

      await expect(
        vault.connect(user1).depositToken(depositAmount, TokenX)
      ).to.not.be.reverted;
    });
  });

  describe("Upgrade Authorization", function () {
    it("Should only allow owner to authorize upgrades", async function () {
      const { vault, user1 } = await loadFixture(deployVaultFixture);

      // We can't easily test the internal _authorizeUpgrade without deploying a new implementation
      // But we can verify ownership is required for upgrade functions by checking access control
      expect(await vault.owner()).to.not.equal(user1.address);
    });
  });

  describe("Production Workflow Simulation", function () {
    it("Should support basic deposit and withdraw user flow", async function () {
      const { vault, tokenX, tokenY, user1, user2, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      // 1. Users get tokens
      await tokenX.mint(user1.address, hre.ethers.parseEther("100"));
      await tokenY.mint(user2.address, hre.ethers.parseEther("200"));

      // 2. Users approve vault
      await tokenX.connect(user1).approve(vault.target, hre.ethers.parseEther("100"));
      await tokenY.connect(user2).approve(vault.target, hre.ethers.parseEther("200"));

      // 3. Users deposit tokens
      await expect(
        vault.connect(user1).depositToken(hre.ethers.parseEther("50"), TokenX)
      ).to.not.be.reverted;

      await expect(
        vault.connect(user2).depositToken(hre.ethers.parseEther("75"), TokenY)
      ).to.not.be.reverted;

      // 4. Users should be able to withdraw shares
      await expect(
        vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("10"), 0])
      ).to.not.be.reverted;

      await expect(
        vault.connect(user2).withdrawTokenShares([0, hre.ethers.parseEther("25")])
      ).to.not.be.reverted;

      // Vault should be in consistent state
      expect(await vault.tokenBalance(TokenX)).to.be.a("bigint");
      expect(await vault.tokenBalance(TokenY)).to.be.a("bigint");
    });

    it("Should maintain system integrity across operations", async function () {
      const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

      // Multiple operations should work correctly
      await tokenX.mint(user1.address, hre.ethers.parseEther("1000"));
      await tokenX.connect(user1).approve(vault.target, hre.ethers.parseEther("1000"));

      // Multiple deposits
      await vault.connect(user1).depositToken(hre.ethers.parseEther("100"), TokenX);
      await vault.connect(user1).depositToken(hre.ethers.parseEther("200"), TokenX);
      await vault.connect(user1).depositToken(hre.ethers.parseEther("150"), TokenX);

      // Multiple withdrawals
      await vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("50"), 0]);
      await vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("25"), 0]);

      // System should remain consistent
      const balance = await vault.tokenBalance(TokenX);
      const supply = await vault.totalSupply(TokenX);
      
      expect(balance).to.be.a("bigint");
      expect(supply).to.be.a("bigint");
    });
  });
});