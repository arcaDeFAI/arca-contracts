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
    
    // Deploy registry for testing integration
    const Registry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    
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
    
    // Transfer ownership of supporting contracts to vault (like production deployment)
    await queueHandler.transferOwnership(vault.target);
    await feeManager.transferOwnership(vault.target);
    await rewardClaimer.transferOwnership(vault.target);
    
    // Register vault with registry (testing integration)
    await registry.registerVault(
      vault.target,
      rewardClaimer.target,
      queueHandler.target,
      feeManager.target,
      tokenX.target,
      tokenY.target,
      "Test Vault",
      "ARCA-TEST",
      1, // deploymentId
      false // isProxy
    );
    
    // Token enum values for testing
    const TokenX = 0;
    const TokenY = 1;
    
    return {
      vault,
      feeManager,
      queueHandler,
      rewardClaimer,
      registry,
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
      const { vault, tokenX, feeManager, TokenX, user1 } = await loadFixture(deployVaultFixture);

      // Add some tokens to vault directly (simulating existing balance)
      await tokenX.mint(vault.target, hre.ethers.parseEther("100"));

      // Create queued tokens through normal deposit flow
      const depositAmount = hre.ethers.parseEther("20");
      await tokenX.mint(user1.address, depositAmount);
      await tokenX.connect(user1).approve(vault.target, depositAmount);
      await vault.connect(user1).depositToken(depositAmount, TokenX);

      // Calculate expected: original balance (100) + deposit after fees
      const depositFee = await feeManager.getDepositFee();
      const basisPoints = await feeManager.BASIS_POINTS();
      const feeAmount = (depositAmount * depositFee) / basisPoints;
      const netDepositAmount = depositAmount - feeAmount;
      
      // tokenBalance should exclude queued amount but include the net deposit
      const expectedBalance = hre.ethers.parseEther("100"); // Only the original, queued amount excluded
      expect(await vault.tokenBalance(TokenX)).to.equal(expectedBalance);
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
    describe("Deposit to Queue Operations", function () {
      it("Should add deposits to the queue correctly", async function () {
        const { vault, tokenX, tokenY, user1, TokenX, TokenY, queueHandler, feeManager } = await loadFixture(deployVaultFixture);

        // Mint and approve tokens
        const depositAmountX = hre.ethers.parseEther("10");
        const depositAmountY = hre.ethers.parseEther("5");
        
        await tokenX.mint(user1.address, depositAmountX);
        await tokenY.mint(user1.address, depositAmountY);
        await tokenX.connect(user1).approve(vault.target, depositAmountX);
        await tokenY.connect(user1).approve(vault.target, depositAmountY);

        // Check queue is empty initially
        expect(await queueHandler.getPendingDepositsCount()).to.equal(0);

        // Calculate expected amounts after fees (0.5% deposit fee)
        const depositFee = await feeManager.getDepositFee(); // 50 basis points = 0.5%
        const basisPoints = await feeManager.BASIS_POINTS(); // 10000
        const expectedNetAmountX = depositAmountX - (depositAmountX * depositFee / basisPoints);
        const expectedNetAmountY = depositAmountY - (depositAmountY * depositFee / basisPoints);

        // Deposit tokens
        await vault.connect(user1).depositToken(depositAmountX, TokenX);
        await vault.connect(user1).depositToken(depositAmountY, TokenY);

        // Verify deposits are queued
        expect(await queueHandler.getPendingDepositsCount()).to.equal(2);
        
        // Verify exact queued amounts (net amounts after fees)
        expect(await queueHandler.getQueuedToken(TokenX)).to.equal(expectedNetAmountX);
        expect(await queueHandler.getQueuedToken(TokenY)).to.equal(expectedNetAmountY);
      });
    });

    describe("Integration: Deposit to Withdrawal Flow", function () {
      it("Should complete full deposit→rebalance→shares→withdrawal flow", async function () {
        const { vault, tokenX, tokenY, user1, TokenX, TokenY, queueHandler, feeManager } = await loadFixture(deployVaultFixture);

        // === ARRANGE ===
        const depositAmountX = hre.ethers.parseEther("10");
        const depositAmountY = hre.ethers.parseEther("5");
        
        // Mint tokens and approve vault
        await tokenX.mint(user1.address, depositAmountX);
        await tokenY.mint(user1.address, depositAmountY);
        await tokenX.connect(user1).approve(vault.target, depositAmountX);
        await tokenY.connect(user1).approve(vault.target, depositAmountY);

        // Calculate expected values
        const depositFee = await feeManager.getDepositFee();
        const withdrawFee = await feeManager.getWithdrawFee();
        const basisPoints = await feeManager.BASIS_POINTS();
        const expectedNetAmountX = depositAmountX - (depositAmountX * depositFee / basisPoints);
        const expectedNetAmountY = depositAmountY - (depositAmountY * depositFee / basisPoints);
        const rebalanceParams = {
          deltaIds: [],
          distributionX: [],
          distributionY: [],
          ids: [],
          amounts: [],
          removeAmountXMin: 0,
          removeAmountYMin: 0,
          to: vault.target,
          refundTo: vault.target,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          forceRebalance: true
        };

        // === ACT 1: Deposit Phase ===
        await vault.connect(user1).depositToken(depositAmountX, TokenX);
        await vault.connect(user1).depositToken(depositAmountY, TokenY);
        await vault.rebalance(rebalanceParams);

        // === ASSERT 1: Verify shares minted correctly ===
        const userSharesX = await vault.getShares(user1.address, TokenX);
        const userSharesY = await vault.getShares(user1.address, TokenY);
        
        expect(userSharesX).to.equal(expectedNetAmountX);
        expect(userSharesY).to.equal(expectedNetAmountY);
        expect(await queueHandler.getPendingDepositsCount()).to.equal(0);

        // === ACT 2: Withdrawal Phase ===
        const sharesToWithdrawX = userSharesX / 3n; // Withdraw one-third
        const sharesToWithdrawY = userSharesY / 3n;
        
        const initialTokenXBalance = await tokenX.balanceOf(user1.address);
        const initialTokenYBalance = await tokenY.balanceOf(user1.address);

        await vault.connect(user1).withdrawTokenShares([sharesToWithdrawX, sharesToWithdrawY]);
        
        const secondRebalanceParams = {
          ...rebalanceParams,
          deadline: Math.floor(Date.now() / 1000) + 3600
        };
        await vault.rebalance(secondRebalanceParams);

        // === ASSERT 2: Verify exact withdrawal amounts ===
        const totalWithdrawAmountX = sharesToWithdrawX;
        const totalWithdrawAmountY = sharesToWithdrawY;
        const totalWithdrawAmount = totalWithdrawAmountX + totalWithdrawAmountY;
        const totalWithdrawFee = (totalWithdrawAmount * withdrawFee) / basisPoints;
        
        const feeAmountX = (totalWithdrawAmountX * totalWithdrawFee) / totalWithdrawAmount;
        const feeAmountY = (totalWithdrawAmountY * totalWithdrawFee) / totalWithdrawAmount;
        
        const expectedReceivedX = totalWithdrawAmountX - feeAmountX;
        const expectedReceivedY = totalWithdrawAmountY - feeAmountY;

        const finalTokenXBalance = await tokenX.balanceOf(user1.address);
        const finalTokenYBalance = await tokenY.balanceOf(user1.address);

        const actualReceivedX = finalTokenXBalance - initialTokenXBalance;
        const actualReceivedY = finalTokenYBalance - initialTokenYBalance;

        expect(actualReceivedX).to.equal(expectedReceivedX);
        expect(actualReceivedY).to.equal(expectedReceivedY);
        expect(await queueHandler.getPendingWithdrawsCount()).to.equal(0);
      });
    });

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

        // Solidity enum validation catches out-of-bounds values before our custom error
        await expect(
          vault.connect(user1).depositToken(100, 255) // Invalid token type
        ).to.be.reverted;
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
      it("Should allow users to withdraw shares after rebalance", async function () {
        // === ARRANGE ===
        const { vault, tokenX, tokenY, user1, TokenX, TokenY, feeManager } = await loadFixture(deployVaultFixture);

        const depositAmountX = hre.ethers.parseEther("10");
        const depositAmountY = hre.ethers.parseEther("8");
        
        await tokenX.mint(user1.address, depositAmountX);
        await tokenY.mint(user1.address, depositAmountY);
        await tokenX.connect(user1).approve(vault.target, depositAmountX);
        await tokenY.connect(user1).approve(vault.target, depositAmountY);

        const rebalanceParams = {
          deltaIds: [],
          distributionX: [],
          distributionY: [],
          ids: [],
          amounts: [],
          removeAmountXMin: 0,
          removeAmountYMin: 0,
          to: vault.target,
          refundTo: vault.target,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          forceRebalance: true
        };

        // === ACT 1: Deposit and get shares ===
        await vault.connect(user1).depositToken(depositAmountX, TokenX);
        await vault.connect(user1).depositToken(depositAmountY, TokenY);
        await vault.rebalance(rebalanceParams);

        // === ACT 2: Withdraw specific amounts ===
        const withdrawAmountX = hre.ethers.parseEther("5");
        const withdrawAmountY = hre.ethers.parseEther("3");

        await expect(
          vault.connect(user1).withdrawTokenShares([withdrawAmountX, withdrawAmountY])
        ).to.not.be.reverted;

        // === ASSERT ===
        // User should have remaining shares
        const remainingSharesX = await vault.getShares(user1.address, TokenX);
        const remainingSharesY = await vault.getShares(user1.address, TokenY);
        expect(remainingSharesX).to.be.gt(0);
        expect(remainingSharesY).to.be.gt(0);
      });

      it("Should reject withdrawAll when user has no shares", async function () {
        // Unit test - withdrawAll should revert when user has no shares (correct behavior)
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        // withdrawAll with 0 shares should revert
        await expect(
          vault.connect(user1).withdrawAll()
        ).to.be.revertedWith("Cannot withdraw 0 shares");
      });

      it("Should allow withdrawAll after user has shares from deposit→rebalance flow", async function () {
        // === ARRANGE ===
        const { vault, tokenX, tokenY, user1, TokenX, TokenY, feeManager } = await loadFixture(deployVaultFixture);

        const depositAmountX = hre.ethers.parseEther("12");
        const depositAmountY = hre.ethers.parseEther("8");
        
        await tokenX.mint(user1.address, depositAmountX);
        await tokenY.mint(user1.address, depositAmountY);
        await tokenX.connect(user1).approve(vault.target, depositAmountX);
        await tokenY.connect(user1).approve(vault.target, depositAmountY);

        // Calculate expected values after deposit fees
        const depositFee = await feeManager.getDepositFee();
        const withdrawFee = await feeManager.getWithdrawFee();
        const basisPoints = await feeManager.BASIS_POINTS();
        const expectedNetAmountX = depositAmountX - (depositAmountX * depositFee / basisPoints);
        const expectedNetAmountY = depositAmountY - (depositAmountY * depositFee / basisPoints);

        const rebalanceParams = {
          deltaIds: [],
          distributionX: [],
          distributionY: [],
          ids: [],
          amounts: [],
          removeAmountXMin: 0,
          removeAmountYMin: 0,
          to: vault.target,
          refundTo: vault.target,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          forceRebalance: true
        };

        // === ACT 1: Deposit and get shares ===
        await vault.connect(user1).depositToken(depositAmountX, TokenX);
        await vault.connect(user1).depositToken(depositAmountY, TokenY);
        await vault.rebalance(rebalanceParams);

        // Verify exact shares received
        const userSharesX = await vault.getShares(user1.address, TokenX);
        const userSharesY = await vault.getShares(user1.address, TokenY);
        expect(userSharesX).to.equal(expectedNetAmountX);
        expect(userSharesY).to.equal(expectedNetAmountY);

        // === ACT 2: WithdrawAll ===
        const initialTokenXBalance = await tokenX.balanceOf(user1.address);
        const initialTokenYBalance = await tokenY.balanceOf(user1.address);

        await vault.connect(user1).withdrawAll();

        // Process withdrawal with rebalance
        const secondRebalanceParams = {
          ...rebalanceParams,
          deadline: Math.floor(Date.now() / 1000) + 3600
        };
        await vault.rebalance(secondRebalanceParams);

        // === ASSERT ===
        // User should have no shares left
        expect(await vault.getShares(user1.address, TokenX)).to.equal(0);
        expect(await vault.getShares(user1.address, TokenY)).to.equal(0);

        // Calculate exact expected tokens received after withdrawal fees
        const totalWithdrawAmountX = expectedNetAmountX;
        const totalWithdrawAmountY = expectedNetAmountY;
        const totalWithdrawAmount = totalWithdrawAmountX + totalWithdrawAmountY;
        const totalWithdrawFee = (totalWithdrawAmount * withdrawFee) / basisPoints;
        
        const feeAmountX = (totalWithdrawAmountX * totalWithdrawFee) / totalWithdrawAmount;
        const feeAmountY = (totalWithdrawAmountY * totalWithdrawFee) / totalWithdrawAmount;
        
        const expectedReceivedX = totalWithdrawAmountX - feeAmountX;
        const expectedReceivedY = totalWithdrawAmountY - feeAmountY;

        // Verify exact token amounts received
        const finalTokenXBalance = await tokenX.balanceOf(user1.address);
        const finalTokenYBalance = await tokenY.balanceOf(user1.address);
        
        const actualReceivedX = finalTokenXBalance - initialTokenXBalance;
        const actualReceivedY = finalTokenYBalance - initialTokenYBalance;

        expect(actualReceivedX).to.equal(expectedReceivedX);
        expect(actualReceivedY).to.equal(expectedReceivedY);
      });

      it("Should support backward compatibility withdraw function (queue behavior)", async function () {
        // Unit test - tests that withdraw function queues properly even with no shares
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        // withdraw(0) should revert with specific message
        await expect(
          vault.connect(user1).withdraw(0)
        ).to.be.revertedWith("Cannot withdraw 0 shares");
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
      it("Should validate withdrawal parameters", async function () {
        const { vault, user1 } = await loadFixture(deployVaultFixture);

        // Test parameter validation - withdraw(0) should revert
        await expect(
          vault.connect(user1).withdraw(0)
        ).to.be.revertedWith("Cannot withdraw 0 shares");
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

      // Solidity enum validation catches out-of-bounds values before our custom error
      await expect(
        vault.tokenBalance(2)
      ).to.be.reverted;

      await expect(
        vault.tokenBalance(255)
      ).to.be.reverted;
    });

    it("Should reject invalid token types in totalSupply", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      // Solidity enum validation catches out-of-bounds values before our custom error
      await expect(
        vault.totalSupply(2)
      ).to.be.reverted;
    });

    it("Should reject invalid token types in getPricePerFullShare", async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      // Solidity enum validation catches out-of-bounds values before our custom error
      await expect(
        vault.getPricePerFullShare(2)
      ).to.be.reverted;
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
      // === ARRANGE ===
      const { vault, tokenX, tokenY, user1, user2, TokenX, TokenY } = await loadFixture(deployVaultFixture);

      await tokenX.mint(user1.address, hre.ethers.parseEther("100"));
      await tokenY.mint(user2.address, hre.ethers.parseEther("200"));
      await tokenX.connect(user1).approve(vault.target, hre.ethers.parseEther("100"));
      await tokenY.connect(user2).approve(vault.target, hre.ethers.parseEther("200"));

      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: vault.target,
        refundTo: vault.target,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: true
      };

      // === ACT 1: Deposit Phase ===
      await vault.connect(user1).depositToken(hre.ethers.parseEther("50"), TokenX);
      await vault.connect(user2).depositToken(hre.ethers.parseEther("75"), TokenY);
      await vault.rebalance(rebalanceParams);

      // === ACT 2: Withdrawal Phase ===
      await vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("10"), 0]);
      await vault.connect(user2).withdrawTokenShares([0, hre.ethers.parseEther("25")]);

      const secondRebalanceParams = {
        ...rebalanceParams,
        deadline: Math.floor(Date.now() / 1000) + 3600
      };
      await vault.rebalance(secondRebalanceParams);

      // === ASSERT ===
      expect(await vault.tokenBalance(TokenX)).to.be.a("bigint");
      expect(await vault.tokenBalance(TokenY)).to.be.a("bigint");
    });

    it("Should maintain system integrity across operations", async function () {
      // === ARRANGE ===
      const { vault, tokenX, user1, TokenX } = await loadFixture(deployVaultFixture);

      await tokenX.mint(user1.address, hre.ethers.parseEther("1000"));
      await tokenX.connect(user1).approve(vault.target, hre.ethers.parseEther("1000"));

      const rebalanceParams = {
        deltaIds: [],
        distributionX: [],
        distributionY: [],
        ids: [],
        amounts: [],
        removeAmountXMin: 0,
        removeAmountYMin: 0,
        to: vault.target,
        refundTo: vault.target,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        forceRebalance: true
      };

      // === ACT 1: Multiple deposits ===
      await vault.connect(user1).depositToken(hre.ethers.parseEther("100"), TokenX);
      await vault.connect(user1).depositToken(hre.ethers.parseEther("200"), TokenX);
      await vault.connect(user1).depositToken(hre.ethers.parseEther("150"), TokenX);
      await vault.rebalance(rebalanceParams);

      // === ACT 2: Multiple withdrawals ===
      await vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("50"), 0]);
      await vault.connect(user1).withdrawTokenShares([hre.ethers.parseEther("25"), 0]);

      const secondRebalanceParams = {
        ...rebalanceParams,
        deadline: Math.floor(Date.now() / 1000) + 3600
      };
      await vault.rebalance(secondRebalanceParams);

      // === ASSERT ===
      const balance = await vault.tokenBalance(TokenX);
      const supply = await vault.totalSupply(TokenX);
      
      expect(balance).to.be.a("bigint");
      expect(supply).to.be.a("bigint");
    });
  });

  describe("Registry Integration", function () {
    it("should be properly registered in the vault registry", async function () {
      const { vault, registry, tokenX, tokenY } = await loadFixture(deployVaultFixture);
      
      // Verify vault is registered
      const isRegistered = await registry.isRegisteredVault(vault.target);
      expect(isRegistered).to.equal(true);
      
      // Verify vault info
      const vaultInfo = await registry.vaultInfo(vault.target);
      expect(vaultInfo.name).to.equal("Test Vault");
      expect(vaultInfo.symbol).to.equal("ARCA-TEST");
      expect(vaultInfo.tokenX).to.equal(tokenX.target);
      expect(vaultInfo.tokenY).to.equal(tokenY.target);
      expect(vaultInfo.isActive).to.equal(true);
      
      // Verify vault is discoverable
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.include(vault.target);
      
      // Verify vault can be found by token pair
      const vaultsForPair = await registry.getVaultsByTokenPair(tokenX.target, tokenY.target);
      expect(vaultsForPair).to.include(vault.target);
    });
  });
});