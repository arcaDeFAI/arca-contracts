import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ArcaFeeManagerV1 - Business Logic", function () {
  // Deploy using OpenZeppelin proxy pattern for accurate testing
  async function deployFeeManagerFixture() {
    const [owner, feeRecipient, otherAccount, vault] = await hre.ethers.getSigners();
    
    // Get contract factory
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    
    // Deploy fresh instance using beacon proxy pattern (as per deployment strategy)
    const deployFreshInstance = async (recipient: string) => {
      const beacon = await hre.upgrades.deployBeacon(FeeManager);
      const instance = await hre.upgrades.deployBeaconProxy(
        beacon,
        FeeManager,
        [recipient]
      );
      await instance.waitForDeployment();
      return instance;
    };
    
    const feeManager = await deployFreshInstance(feeRecipient.address);
    
    return { 
      feeManager, 
      owner, 
      feeRecipient, 
      otherAccount, 
      vault,
      deployFreshInstance 
    };
  }

  describe("Initialization Requirements", function () {
    it("Should set correct default fee values on initialization", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      // Core business requirement: Default fees
      expect(await feeManager.getDepositFee()).to.equal(50);    // 0.5%
      expect(await feeManager.getWithdrawFee()).to.equal(50);   // 0.5%
      expect(await feeManager.getPerformanceFee()).to.equal(1000); // 10%
    });

    it("Should set fee recipient and owner correctly", async function () {
      const { feeManager, feeRecipient, owner } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);
      expect(await feeManager.owner()).to.equal(owner.address);
    });

    it("Should have correct basis points constant", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.BASIS_POINTS()).to.equal(10000);
    });

    it("Should reject zero address during initialization", async function () {
      const { deployFreshInstance } = await loadFixture(deployFeeManagerFixture);
      
      await expect(
        deployFreshInstance(hre.ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee recipient");
    });
  });

  describe("Fee Management Business Rules", function () {
    describe("Valid Fee Operations", function () {
      it("Should allow setting valid fees within limits", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await feeManager.setFees(100, 200, 1500); // 1%, 2%, 15%

        expect(await feeManager.getDepositFee()).to.equal(100);
        expect(await feeManager.getWithdrawFee()).to.equal(200);
        expect(await feeManager.getPerformanceFee()).to.equal(1500);
      });

      it("Should allow zero fees", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await feeManager.setFees(0, 0, 0);

        expect(await feeManager.getDepositFee()).to.equal(0);
        expect(await feeManager.getWithdrawFee()).to.equal(0);
        expect(await feeManager.getPerformanceFee()).to.equal(0);
      });

      it("Should allow maximum allowed fees", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        // Test business rule: 5% max for deposit/withdraw, 20% max for performance
        await feeManager.setFees(500, 500, 2000);

        expect(await feeManager.getDepositFee()).to.equal(500);
        expect(await feeManager.getWithdrawFee()).to.equal(500);
        expect(await feeManager.getPerformanceFee()).to.equal(2000);
      });

      it("Should emit FeesUpdated event with correct values", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await expect(feeManager.setFees(75, 125, 1200))
          .to.emit(feeManager, "FeesUpdated")
          .withArgs(75, 125, 1200);
      });
    });

    describe("Fee Limit Enforcement", function () {
      it("Should reject deposit fee above 5%", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await expect(feeManager.setFees(501, 50, 1000))
          .to.be.revertedWith("Deposit fee too high");
      });

      it("Should reject withdraw fee above 5%", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await expect(feeManager.setFees(50, 501, 1000))
          .to.be.revertedWith("Withdraw fee too high");
      });

      it("Should reject performance fee above 20%", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await expect(feeManager.setFees(50, 50, 2001))
          .to.be.revertedWith("Performance fee too high");
      });
    });

    describe("Access Control", function () {
      it("Should only allow owner to set fees", async function () {
        const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);

        await expect(
          feeManager.connect(otherAccount).setFees(100, 100, 1500)
        ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set fees", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);

        await expect(feeManager.setFees(100, 100, 1500))
          .to.not.be.reverted;
      });
    });
  });

  describe("Fee Recipient Management", function () {
    it("Should allow owner to update fee recipient", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      await feeManager.setFeeRecipient(vault.address);

      expect(await feeManager.getFeeRecipient()).to.equal(vault.address);
    });

    it("Should emit FeeRecipientUpdated event", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      await expect(feeManager.setFeeRecipient(vault.address))
        .to.emit(feeManager, "FeeRecipientUpdated")
        .withArgs(vault.address);
    });

    it("Should reject zero address as fee recipient", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);

      await expect(feeManager.setFeeRecipient(hre.ethers.ZeroAddress))
        .to.be.revertedWith("Invalid fee recipient");
    });

    it("Should only allow owner to change fee recipient", async function () {
      const { feeManager, otherAccount, vault } = await loadFixture(deployFeeManagerFixture);

      await expect(
        feeManager.connect(otherAccount).setFeeRecipient(vault.address)
      ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Ownership Transfer Scenarios", function () {
    it("Should transfer ownership to vault (production scenario)", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      await feeManager.transferOwnership(vault.address);

      expect(await feeManager.owner()).to.equal(vault.address);
    });

    it("Should allow new owner to manage fees after transfer", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      await feeManager.transferOwnership(vault.address);

      // New owner should be able to set fees
      await expect(feeManager.connect(vault).setFees(200, 300, 1500))
        .to.not.be.reverted;
    });

    it("Should prevent old owner from managing fees after transfer", async function () {
      const { feeManager, owner, vault } = await loadFixture(deployFeeManagerFixture);

      await feeManager.transferOwnership(vault.address);

      // Old owner should no longer be able to set fees
      await expect(
        feeManager.connect(owner).setFees(200, 300, 1500)
      ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow new owner to change fee recipient", async function () {
      const { feeManager, owner, vault } = await loadFixture(deployFeeManagerFixture);

      await feeManager.transferOwnership(vault.address);

      await expect(feeManager.connect(vault).setFeeRecipient(owner.address))
        .to.not.be.reverted;
    });
  });

  describe("State Management", function () {
    it("Should handle sequential fee updates correctly", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);

      // Multiple updates should work correctly
      await feeManager.setFees(100, 150, 1200);
      await feeManager.setFees(200, 250, 1400);
      await feeManager.setFees(300, 350, 1600);

      expect(await feeManager.getDepositFee()).to.equal(300);
      expect(await feeManager.getWithdrawFee()).to.equal(350);
      expect(await feeManager.getPerformanceFee()).to.equal(1600);
    });

    it("Should maintain consistent state across mixed operations", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      // Mix fee updates and recipient changes
      await feeManager.setFees(200, 300, 1500);
      await feeManager.setFeeRecipient(vault.address);
      await feeManager.setFees(100, 150, 1200);

      // Verify final state
      expect(await feeManager.getDepositFee()).to.equal(100);
      expect(await feeManager.getWithdrawFee()).to.equal(150);
      expect(await feeManager.getPerformanceFee()).to.equal(1200);
      expect(await feeManager.getFeeRecipient()).to.equal(vault.address);
    });

    it("Should prevent re-initialization after deployment", async function () {
      const { feeManager, feeRecipient } = await loadFixture(deployFeeManagerFixture);

      // Should not be able to initialize again
      await expect(
        feeManager.initialize(feeRecipient.address)
      ).to.be.revertedWithCustomError(feeManager, "InvalidInitialization");
    });
  });

  describe("Production Workflow Simulation", function () {
    it("Should support complete deployment and ownership transfer workflow", async function () {
      const { deployFreshInstance, vault, feeRecipient } = await loadFixture(deployFeeManagerFixture);

      // 1. Deploy and initialize (like deployment script does)
      const feeManager = await deployFreshInstance(feeRecipient.address);

      // 2. Verify initial state
      expect(await feeManager.getDepositFee()).to.equal(50);
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);

      // 3. Transfer ownership to vault (like deployment script does)
      await feeManager.transferOwnership(vault.address);

      // 4. Vault should now control fee management
      await expect(feeManager.connect(vault).setFees(100, 150, 1200))
        .to.not.be.reverted;

      // 5. Vault should be able to change fee recipient
      await expect(feeManager.connect(vault).setFeeRecipient(vault.address))
        .to.not.be.reverted;

      // Verify final state matches expectations
      expect(await feeManager.owner()).to.equal(vault.address);
      expect(await feeManager.getFeeRecipient()).to.equal(vault.address);
      expect(await feeManager.getDepositFee()).to.equal(100);
    });
  });

  describe("Gas Efficiency", function () {
    it("Should use reasonable gas for fee updates", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);

      const tx = await feeManager.setFees(150, 250, 1500);
      const receipt = await tx.wait();
      
      console.log(`        Gas used for setFees: ${receipt?.gasUsed}`);
      expect(receipt?.gasUsed).to.be.lessThan(80000);
    });

    it("Should use reasonable gas for recipient updates", async function () {
      const { feeManager, vault } = await loadFixture(deployFeeManagerFixture);

      const tx = await feeManager.setFeeRecipient(vault.address);
      const receipt = await tx.wait();
      
      console.log(`        Gas used for setFeeRecipient: ${receipt?.gasUsed}`);
      expect(receipt?.gasUsed).to.be.lessThan(60000);
    });
  });
});