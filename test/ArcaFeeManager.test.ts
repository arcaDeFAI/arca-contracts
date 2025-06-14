import { expect } from "chai";
import hre from "hardhat";
import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ArcaFeeManager", function () {
  async function deployFeeManagerFixture() {
    const [owner, feeRecipient, otherAccount] = await hre.ethers.getSigners();
    const feeManager = await hre.ethers.deployContract("ArcaFeeManagerV1", [feeRecipient.address]);
    return { feeManager, owner, feeRecipient, otherAccount };
  }

  describe("Deployment", function () {
    it("Should have correct fee recipient and owner", async function () {
      const { feeManager, owner, feeRecipient } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);
      expect(await feeManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct default fee values", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.getDepositFee()).to.equal(50);
      expect(await feeManager.getWithdrawFee()).to.equal(50);
      expect(await feeManager.getPerformanceFee()).to.equal(1000);
    });

    it("Should have correct BASIS_POINTS constant", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.BASIS_POINTS()).to.equal(10000);
    });

    it("Should revert when deploying with zero address as fee recipient", async function () {
      await expect(
        hre.ethers.deployContract("ArcaFeeManagerV1", [hre.ethers.ZeroAddress])
      ).to.be.revertedWith("Invalid fee recipient");
    });
  });

  describe("Fee Management", function () {
    describe("setFees - Valid Updates", function () {
      it("Should update all fees within valid ranges", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await feeManager.setFees(100, 200, 1500);
        
        expect(await feeManager.getDepositFee()).to.equal(100);
        expect(await feeManager.getWithdrawFee()).to.equal(200);
        expect(await feeManager.getPerformanceFee()).to.equal(1500);
      });

      it("Should emit FeesUpdated event with correct parameters", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(feeManager.setFees(100, 200, 1500))
          .to.emit(feeManager, "FeesUpdated")
          .withArgs(100, 200, 1500);
      });

      it("Should allow setting fees to zero", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await feeManager.setFees(0, 0, 0);
        
        expect(await feeManager.getDepositFee()).to.equal(0);
        expect(await feeManager.getWithdrawFee()).to.equal(0);
        expect(await feeManager.getPerformanceFee()).to.equal(0);
      });

      it("Should allow setting fees to maximum allowed values", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await feeManager.setFees(500, 500, 2000);
        
        expect(await feeManager.getDepositFee()).to.equal(500);
        expect(await feeManager.getWithdrawFee()).to.equal(500);
        expect(await feeManager.getPerformanceFee()).to.equal(2000);
      });

      it("Should emit event even when setting same values", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(feeManager.setFees(50, 50, 1000))
          .to.emit(feeManager, "FeesUpdated")
          .withArgs(50, 50, 1000);
      });
    });

    describe("setFees - Access Control", function () {
      it("Should revert when non-owner tries to set fees", async function () {
        const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.connect(otherAccount).setFees(100, 100, 1000)
        ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set fees", async function () {
        const { feeManager, owner } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.connect(owner).setFees(100, 100, 1000)
        ).to.not.be.reverted;
      });
    });

    describe("setFees - Boundary Validation", function () {
      it("Should revert when deposit fee exceeds 500 (5%)", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.setFees(501, 50, 1000)
        ).to.be.revertedWith("Deposit fee too high");
      });

      it("Should revert when withdraw fee exceeds 500 (5%)", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.setFees(50, 501, 1000)
        ).to.be.revertedWith("Withdraw fee too high");
      });

      it("Should revert when performance fee exceeds 2000 (20%)", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.setFees(50, 50, 2001)
        ).to.be.revertedWith("Performance fee too high");
      });

      it("Should accept fees at exact maximum values", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.setFees(500, 500, 2000)
        ).to.not.be.reverted;
      });
    });
  });

  describe("Fee Recipient Management", function () {
    describe("setFeeRecipient - Valid Updates", function () {
      it("Should update fee recipient to new valid address", async function () {
        const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
        
        await feeManager.setFeeRecipient(otherAccount.address);
        
        expect(await feeManager.getFeeRecipient()).to.equal(otherAccount.address);
      });

      it("Should emit FeeRecipientUpdated event with correct address", async function () {
        const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
        
        await expect(feeManager.setFeeRecipient(otherAccount.address))
          .to.emit(feeManager, "FeeRecipientUpdated")
          .withArgs(otherAccount.address);
      });
    });

    describe("setFeeRecipient - Access Control", function () {
      it("Should revert when non-owner tries to set fee recipient", async function () {
        const { feeManager, feeRecipient, otherAccount } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.connect(otherAccount).setFeeRecipient(feeRecipient.address)
        ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set fee recipient", async function () {
        const { feeManager, owner, otherAccount } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.connect(owner).setFeeRecipient(otherAccount.address)
        ).to.not.be.reverted;
      });
    });

    describe("setFeeRecipient - Validation", function () {
      it("Should revert when setting fee recipient to zero address", async function () {
        const { feeManager } = await loadFixture(deployFeeManagerFixture);
        
        await expect(
          feeManager.setFeeRecipient(hre.ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid fee recipient");
      });
    });
  });

  describe("View Functions", function () {
    it("Should return correct values via all getter functions", async function () {
      const { feeManager, feeRecipient } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.getDepositFee()).to.equal(50);
      expect(await feeManager.getWithdrawFee()).to.equal(50);
      expect(await feeManager.getPerformanceFee()).to.equal(1000);
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should return updated values after fee changes", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      await feeManager.setFees(150, 250, 1750);
      
      expect(await feeManager.getDepositFee()).to.equal(150);
      expect(await feeManager.getWithdrawFee()).to.equal(250);
      expect(await feeManager.getPerformanceFee()).to.equal(1750);
    });

    it("Should return updated fee recipient after change", async function () {
      const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      await feeManager.setFeeRecipient(otherAccount.address);
      
      expect(await feeManager.getFeeRecipient()).to.equal(otherAccount.address);
    });
  });

  describe("Integration & Edge Cases", function () {
    it("Should handle multiple fee updates in sequence", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      await feeManager.setFees(100, 100, 1200);
      expect(await feeManager.getDepositFee()).to.equal(100);
      
      await feeManager.setFees(200, 200, 1400);
      expect(await feeManager.getDepositFee()).to.equal(200);
      expect(await feeManager.getWithdrawFee()).to.equal(200);
      
      await feeManager.setFees(0, 0, 0);
      expect(await feeManager.getDepositFee()).to.equal(0);
      expect(await feeManager.getWithdrawFee()).to.equal(0);
      expect(await feeManager.getPerformanceFee()).to.equal(0);
    });

    it("Should handle multiple fee recipient changes", async function () {
      const { feeManager, feeRecipient, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);
      
      await feeManager.setFeeRecipient(otherAccount.address);
      expect(await feeManager.getFeeRecipient()).to.equal(otherAccount.address);
      
      await feeManager.setFeeRecipient(feeRecipient.address);
      expect(await feeManager.getFeeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should maintain state consistency across operations", async function () {
      const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      // Change fees and recipient
      await feeManager.setFees(300, 400, 1800);
      await feeManager.setFeeRecipient(otherAccount.address);
      
      // Verify all state is correct
      expect(await feeManager.getDepositFee()).to.equal(300);
      expect(await feeManager.getWithdrawFee()).to.equal(400);
      expect(await feeManager.getPerformanceFee()).to.equal(1800);
      expect(await feeManager.getFeeRecipient()).to.equal(otherAccount.address);
    });
  });

  describe("Ownership Transfer", function () {
    it("Should allow new owner to manage fees after ownership transfer", async function () {
      const { feeManager, owner, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      // Transfer ownership
      await feeManager.connect(owner).transferOwnership(otherAccount.address);
      
      // New owner should be able to set fees
      await expect(
        feeManager.connect(otherAccount).setFees(200, 200, 1500)
      ).to.not.be.reverted;
      
      expect(await feeManager.getDepositFee()).to.equal(200);
    });

    it("Should prevent old owner from managing fees after transfer", async function () {
      const { feeManager, owner, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      // Transfer ownership
      await feeManager.connect(owner).transferOwnership(otherAccount.address);
      
      // Old owner should not be able to set fees
      await expect(
        feeManager.connect(owner).setFees(200, 200, 1500)
      ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow new owner to manage fee recipient after ownership transfer", async function () {
      const { feeManager, owner, feeRecipient, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      // Transfer ownership
      await feeManager.connect(owner).transferOwnership(otherAccount.address);
      
      // New owner should be able to set fee recipient
      await expect(
        feeManager.connect(otherAccount).setFeeRecipient(feeRecipient.address)
      ).to.not.be.reverted;
    });
  });

  describe("Gas Optimization", function () {
    it("Should measure gas costs for fee updates", async function () {
      const { feeManager } = await loadFixture(deployFeeManagerFixture);
      
      const tx = await feeManager.setFees(100, 200, 1500);
      const receipt = await tx.wait();
      
      console.log(`Gas used for setFees: ${receipt?.gasUsed}`);
      expect(receipt?.gasUsed).to.be.lessThan(100000); // Reasonable gas limit
    });

    it("Should measure gas costs for recipient updates", async function () {
      const { feeManager, otherAccount } = await loadFixture(deployFeeManagerFixture);
      
      const tx = await feeManager.setFeeRecipient(otherAccount.address);
      const receipt = await tx.wait();
      
      console.log(`Gas used for setFeeRecipient: ${receipt?.gasUsed}`);
      expect(receipt?.gasUsed).to.be.lessThan(50000); // Reasonable gas limit
    });
  });
});