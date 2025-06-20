import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ArcaQueueHandlerV1 - Business Logic", function () {
  async function deployQueueHandlerFixture() {
    const [owner, user1, user2, vault] = await hre.ethers.getSigners();
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    
    const deployFreshInstance = async () => {
      const beacon = await hre.upgrades.deployBeacon(QueueHandler);
      const instance = await hre.upgrades.deployBeaconProxy(
        beacon,
        QueueHandler,
        []
      );
      await instance.waitForDeployment();
      return instance;
    };
    
    const queueHandler = await deployFreshInstance();
    
    // Token enum values for testing
    const TokenX = 0;
    const TokenY = 1;
    
    // Helper to create deposit requests
    const createDepositRequest = (user: string, amount: number, tokenType: number) => ({
      user,
      amount,
      tokenType,
      timestamp: Math.floor(Date.now() / 1000)
    });
    
    // Helper to create withdraw requests  
    const createWithdrawRequest = (user: string, sharesX: number, sharesY: number) => ({
      user,
      shares: [sharesX, sharesY],
      timestamp: Math.floor(Date.now() / 1000)
    });
    
    return { 
      queueHandler, 
      owner, 
      user1, 
      user2, 
      vault,
      deployFreshInstance,
      TokenX,
      TokenY,
      createDepositRequest,
      createWithdrawRequest
    };
  }

  describe("Initialization Requirements", function () {
    it("Should initialize with empty queues", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);
      
      expect(await queueHandler.getDepositQueueLength()).to.equal(0);
      expect(await queueHandler.getWithdrawQueueLength()).to.equal(0);
      expect(await queueHandler.depositQueueStart()).to.equal(0);
      expect(await queueHandler.withdrawQueueStart()).to.equal(0);
    });

    it("Should initialize with zero queued tokens", async function () {
      const { queueHandler, TokenX, TokenY } = await loadFixture(deployQueueHandlerFixture);
      
      expect(await queueHandler.getQueuedToken(TokenX)).to.equal(0);
      expect(await queueHandler.getQueuedToken(TokenY)).to.equal(0);
    });

    it("Should set correct owner during initialization", async function () {
      const { queueHandler, owner } = await loadFixture(deployQueueHandlerFixture);
      
      expect(await queueHandler.owner()).to.equal(owner.address);
    });

    it("Should have correct token count constant", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);
      
      expect(await queueHandler.TOKEN_COUNT()).to.equal(2);
    });
  });

  describe("Deposit Queue Management", function () {
    describe("Valid Deposit Operations", function () {
      it("Should allow owner to enqueue deposit requests", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const depositRequest = createDepositRequest(user1.address, 1000, TokenX);
        
        await expect(queueHandler.enqueueDepositRequest(depositRequest))
          .to.not.be.reverted;

        expect(await queueHandler.getDepositQueueLength()).to.equal(1);
        expect(await queueHandler.getPendingDepositsCount()).to.equal(1);
      });

      it("Should track queued tokens correctly for TokenX", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const depositRequest = createDepositRequest(user1.address, 1500, TokenX);
        await queueHandler.enqueueDepositRequest(depositRequest);

        expect(await queueHandler.getQueuedToken(TokenX)).to.equal(1500);
        expect(await queueHandler.getQueuedToken(1)).to.equal(0); // TokenY should remain 0
      });

      it("Should track queued tokens correctly for TokenY", async function () {
        const { queueHandler, user1, TokenY, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const depositRequest = createDepositRequest(user1.address, 2000, TokenY);
        await queueHandler.enqueueDepositRequest(depositRequest);

        expect(await queueHandler.getQueuedToken(TokenY)).to.equal(2000);
        expect(await queueHandler.getQueuedToken(0)).to.equal(0); // TokenX should remain 0
      });

      it("Should emit DepositQueued event with correct parameters", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const depositRequest = createDepositRequest(user1.address, 1200, TokenX);
        
        await expect(queueHandler.enqueueDepositRequest(depositRequest))
          .to.emit(queueHandler, "DepositQueued")
          .withArgs(queueHandler.target, 1200, TokenX);
      });

      it("Should handle multiple deposit requests correctly", async function () {
        const { queueHandler, user1, user2, TokenX, TokenY, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const deposit1 = createDepositRequest(user1.address, 1000, TokenX);
        const deposit2 = createDepositRequest(user2.address, 1500, TokenY);
        const deposit3 = createDepositRequest(user1.address, 500, TokenX);

        await queueHandler.enqueueDepositRequest(deposit1);
        await queueHandler.enqueueDepositRequest(deposit2);
        await queueHandler.enqueueDepositRequest(deposit3);

        expect(await queueHandler.getDepositQueueLength()).to.equal(3);
        expect(await queueHandler.getPendingDepositsCount()).to.equal(3);
        expect(await queueHandler.getQueuedToken(TokenX)).to.equal(1500); // 1000 + 500
        expect(await queueHandler.getQueuedToken(TokenY)).to.equal(1500);
      });
    });

    describe("Deposit Queue Processing", function () {
      it("Should return and clear deposit queue correctly", async function () {
        const { queueHandler, user1, user2, TokenX, TokenY, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const deposit1 = createDepositRequest(user1.address, 1000, TokenX);
        const deposit2 = createDepositRequest(user2.address, 1500, TokenY);

        await queueHandler.enqueueDepositRequest(deposit1);
        await queueHandler.enqueueDepositRequest(deposit2);

        const depositSlice = await queueHandler.getDepositQueueTrailingSlice();
        
        expect(depositSlice.length).to.equal(2);
        expect(depositSlice[0].user).to.equal(user1.address);
        expect(depositSlice[0].amount).to.equal(1000);
        expect(depositSlice[0].tokenType).to.equal(TokenX);
        expect(depositSlice[1].user).to.equal(user2.address);
        expect(depositSlice[1].amount).to.equal(1500);
        expect(depositSlice[1].tokenType).to.equal(TokenY);

        // After processing, pending count should be 0
        expect(await queueHandler.getPendingDepositsCount()).to.equal(0);
        expect(await queueHandler.depositQueueStart()).to.equal(2);
      });

      it("Should handle sequential processing correctly", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        // Add first batch
        await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 1000, TokenX));
        await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 2000, TokenX));

        // Process first batch
        const firstSlice = await queueHandler.getDepositQueueTrailingSlice();
        expect(firstSlice.length).to.equal(2);
        expect(await queueHandler.getPendingDepositsCount()).to.equal(0);

        // Add second batch
        await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 3000, TokenX));
        
        // Process second batch
        const secondSlice = await queueHandler.getDepositQueueTrailingSlice();
        expect(secondSlice.length).to.equal(1);
        expect(secondSlice[0].amount).to.equal(3000);
        expect(await queueHandler.getPendingDepositsCount()).to.equal(0);
      });
    });

    describe("Access Control for Deposits", function () {
      it("Should only allow owner to enqueue deposits", async function () {
        const { queueHandler, user1, user2, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        const depositRequest = createDepositRequest(user1.address, 1000, TokenX);
        
        await expect(
          queueHandler.connect(user2).enqueueDepositRequest(depositRequest)
        ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
      });

      it("Should only allow owner to get deposit queue slice", async function () {
        const { queueHandler, user1 } = await loadFixture(deployQueueHandlerFixture);

        await expect(
          queueHandler.connect(user1).getDepositQueueTrailingSlice()
        ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Withdraw Queue Management", function () {
    describe("Valid Withdraw Operations", function () {
      it("Should allow owner to enqueue withdraw requests", async function () {
        const { queueHandler, user1, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

        const withdrawRequest = createWithdrawRequest(user1.address, 500, 750);
        
        await expect(queueHandler.enqueueWithdrawRequest(withdrawRequest))
          .to.not.be.reverted;

        expect(await queueHandler.getWithdrawQueueLength()).to.equal(1);
        expect(await queueHandler.getPendingWithdrawsCount()).to.equal(1);
      });

      it("Should emit WithdrawQueued event with correct parameters", async function () {
        const { queueHandler, user1, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

        const withdrawRequest = createWithdrawRequest(user1.address, 600, 800);
        
        await expect(queueHandler.enqueueWithdrawRequest(withdrawRequest))
          .to.emit(queueHandler, "WithdrawQueued")
          .withArgs(queueHandler.target, 600, 800);
      });

      it("Should handle multiple withdraw requests correctly", async function () {
        const { queueHandler, user1, user2, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

        const withdraw1 = createWithdrawRequest(user1.address, 500, 750);
        const withdraw2 = createWithdrawRequest(user2.address, 300, 450);
        const withdraw3 = createWithdrawRequest(user1.address, 200, 250);

        await queueHandler.enqueueWithdrawRequest(withdraw1);
        await queueHandler.enqueueWithdrawRequest(withdraw2);
        await queueHandler.enqueueWithdrawRequest(withdraw3);

        expect(await queueHandler.getWithdrawQueueLength()).to.equal(3);
        expect(await queueHandler.getPendingWithdrawsCount()).to.equal(3);
      });
    });

    describe("Withdraw Queue Processing", function () {
      it("Should return and clear withdraw queue correctly", async function () {
        const { queueHandler, user1, user2, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

        const withdraw1 = createWithdrawRequest(user1.address, 500, 750);
        const withdraw2 = createWithdrawRequest(user2.address, 300, 450);

        await queueHandler.enqueueWithdrawRequest(withdraw1);
        await queueHandler.enqueueWithdrawRequest(withdraw2);

        const withdrawSlice = await queueHandler.getWithdrawQueueTrailingSlice();
        
        expect(withdrawSlice.length).to.equal(2);
        expect(withdrawSlice[0].user).to.equal(user1.address);
        expect(withdrawSlice[0].shares[0]).to.equal(500);
        expect(withdrawSlice[0].shares[1]).to.equal(750);
        expect(withdrawSlice[1].user).to.equal(user2.address);
        expect(withdrawSlice[1].shares[0]).to.equal(300);
        expect(withdrawSlice[1].shares[1]).to.equal(450);

        // After processing, pending count should be 0
        expect(await queueHandler.getPendingWithdrawsCount()).to.equal(0);
        expect(await queueHandler.withdrawQueueStart()).to.equal(2);
      });
    });

    describe("Access Control for Withdraws", function () {
      it("Should only allow owner to enqueue withdraws", async function () {
        const { queueHandler, user1, user2, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

        const withdrawRequest = createWithdrawRequest(user1.address, 500, 750);
        
        await expect(
          queueHandler.connect(user2).enqueueWithdrawRequest(withdrawRequest)
        ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
      });

      it("Should only allow owner to get withdraw queue slice", async function () {
        const { queueHandler, user1 } = await loadFixture(deployQueueHandlerFixture);

        await expect(
          queueHandler.connect(user1).getWithdrawQueueTrailingSlice()
        ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Token Validation", function () {
    it("Should reject invalid token types in deposits", async function () {
      const { queueHandler, user1, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

      const invalidDepositRequest = createDepositRequest(user1.address, 1000, 999); // Invalid token type
      
      await expect(
        queueHandler.enqueueDepositRequest(invalidDepositRequest)
      ).to.be.revertedWithCustomError(queueHandler, "InvalidTokenType");
    });

    it("Should reject invalid token types in queued token queries", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);

      await expect(
        queueHandler.getQueuedToken(999)
      ).to.be.revertedWithCustomError(queueHandler, "InvalidTokenType");
    });

    it("Should reject invalid token types in token reduction", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);

      await expect(
        queueHandler.reduceQueuedToken(100, 999)
      ).to.be.revertedWithCustomError(queueHandler, "InvalidTokenType");
    });
  });

  describe("Queued Token Management", function () {
    describe("Token Reduction Operations", function () {
      it("Should allow owner to reduce queued tokens", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        // Add tokens to queue
        const depositRequest = createDepositRequest(user1.address, 1000, TokenX);
        await queueHandler.enqueueDepositRequest(depositRequest);

        // Reduce queued tokens
        await queueHandler.reduceQueuedToken(300, TokenX);

        expect(await queueHandler.getQueuedToken(TokenX)).to.equal(700);
      });

      it("Should reject reduction when insufficient tokens in queue", async function () {
        const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        // Add tokens to queue
        const depositRequest = createDepositRequest(user1.address, 500, TokenX);
        await queueHandler.enqueueDepositRequest(depositRequest);

        // Try to reduce more than available
        await expect(
          queueHandler.reduceQueuedToken(600, TokenX)
        ).to.be.revertedWith("Not enough tokens in queue");
      });

      it("Should allow complete token reduction", async function () {
        const { queueHandler, user1, TokenY, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

        // Add tokens to queue
        const depositRequest = createDepositRequest(user1.address, 800, TokenY);
        await queueHandler.enqueueDepositRequest(depositRequest);

        // Reduce all tokens
        await queueHandler.reduceQueuedToken(800, TokenY);

        expect(await queueHandler.getQueuedToken(TokenY)).to.equal(0);
      });

      it("Should only allow owner to reduce queued tokens", async function () {
        const { queueHandler, user1, TokenX } = await loadFixture(deployQueueHandlerFixture);

        await expect(
          queueHandler.connect(user1).reduceQueuedToken(100, TokenX)
        ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Queue State Management", function () {
    it("Should handle mixed operations correctly", async function () {
      const { queueHandler, user1, user2, TokenX, TokenY, createDepositRequest, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

      // Mix deposits and withdraws
      await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 1000, TokenX));
      await queueHandler.enqueueWithdrawRequest(createWithdrawRequest(user2.address, 500, 750));
      await queueHandler.enqueueDepositRequest(createDepositRequest(user2.address, 2000, TokenY));

      expect(await queueHandler.getDepositQueueLength()).to.equal(2);
      expect(await queueHandler.getWithdrawQueueLength()).to.equal(1);
      expect(await queueHandler.getQueuedToken(TokenX)).to.equal(1000);
      expect(await queueHandler.getQueuedToken(TokenY)).to.equal(2000);
    });

    it("Should maintain queue integrity across multiple process cycles", async function () {
      const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

      // First cycle
      await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 1000, TokenX));
      await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 2000, TokenX));
      
      await queueHandler.getDepositQueueTrailingSlice(); // Process first batch
      
      // Second cycle
      await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 3000, TokenX));
      await queueHandler.enqueueDepositRequest(createDepositRequest(user1.address, 4000, TokenX));
      
      expect(await queueHandler.getPendingDepositsCount()).to.equal(2);
      expect(await queueHandler.getDepositQueueLength()).to.equal(4);
      expect(await queueHandler.depositQueueStart()).to.equal(2);
    });

    it("Should prevent re-initialization after deployment", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);

      await expect(
        queueHandler.initialize()
      ).to.be.revertedWithCustomError(queueHandler, "InvalidInitialization");
    });
  });

  describe("Ownership Transfer Scenarios", function () {
    it("Should transfer ownership to vault (production scenario)", async function () {
      const { queueHandler, vault } = await loadFixture(deployQueueHandlerFixture);

      await queueHandler.transferOwnership(vault.address);

      expect(await queueHandler.owner()).to.equal(vault.address);
    });

    it("Should allow new owner to manage queues after transfer", async function () {
      const { queueHandler, vault, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

      await queueHandler.transferOwnership(vault.address);

      const depositRequest = createDepositRequest(user1.address, 1000, TokenX);
      await expect(queueHandler.connect(vault).enqueueDepositRequest(depositRequest))
        .to.not.be.reverted;
    });

    it("Should prevent old owner from managing queues after transfer", async function () {
      const { queueHandler, owner, vault, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

      await queueHandler.transferOwnership(vault.address);

      const depositRequest = createDepositRequest(user1.address, 1000, TokenX);
      await expect(
        queueHandler.connect(owner).enqueueDepositRequest(depositRequest)
      ).to.be.revertedWithCustomError(queueHandler, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases and Error Conditions", function () {
    it("Should handle empty queue processing gracefully", async function () {
      const { queueHandler } = await loadFixture(deployQueueHandlerFixture);

      const depositSlice = await queueHandler.getDepositQueueTrailingSlice();
      const withdrawSlice = await queueHandler.getWithdrawQueueTrailingSlice();

      expect(depositSlice.length).to.equal(0);
      expect(withdrawSlice.length).to.equal(0);
    });

    it("Should handle zero amount deposits", async function () {
      const { queueHandler, user1, TokenX, createDepositRequest } = await loadFixture(deployQueueHandlerFixture);

      const depositRequest = createDepositRequest(user1.address, 0, TokenX);
      
      await expect(queueHandler.enqueueDepositRequest(depositRequest))
        .to.not.be.reverted;

      expect(await queueHandler.getQueuedToken(TokenX)).to.equal(0);
    });

    it("Should handle zero shares withdraws", async function () {
      const { queueHandler, user1, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

      const withdrawRequest = createWithdrawRequest(user1.address, 0, 0);
      
      await expect(queueHandler.enqueueWithdrawRequest(withdrawRequest))
        .to.not.be.reverted;
    });
  });

  describe("Production Workflow Simulation", function () {
    it("Should support complete queue lifecycle", async function () {
      const { queueHandler, vault, user1, user2, TokenX, TokenY, createDepositRequest, createWithdrawRequest } = await loadFixture(deployQueueHandlerFixture);

      // 1. Transfer ownership to vault (like deployment script does)
      await queueHandler.transferOwnership(vault.address);

      // 2. Vault enqueues user deposits
      await queueHandler.connect(vault).enqueueDepositRequest(
        createDepositRequest(user1.address, 1000, TokenX)
      );
      await queueHandler.connect(vault).enqueueDepositRequest(
        createDepositRequest(user2.address, 1500, TokenY)
      );

      // 3. Vault enqueues user withdraws
      await queueHandler.connect(vault).enqueueWithdrawRequest(
        createWithdrawRequest(user1.address, 500, 750)
      );

      // 4. Vault processes queues during rebalance
      const deposits = await queueHandler.connect(vault).getDepositQueueTrailingSlice();
      const withdraws = await queueHandler.connect(vault).getWithdrawQueueTrailingSlice();

      expect(deposits.length).to.equal(2);
      expect(withdraws.length).to.equal(1);

      // 5. Vault reduces queued tokens as it processes them
      await queueHandler.connect(vault).reduceQueuedToken(1000, TokenX);
      await queueHandler.connect(vault).reduceQueuedToken(1500, TokenY);

      expect(await queueHandler.getQueuedToken(TokenX)).to.equal(0);
      expect(await queueHandler.getQueuedToken(TokenY)).to.equal(0);
    });
  });
});