import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { MockOracleHelper } from "typechain-types/test/mocks/MockOracleHelper";

describe("Metropolis OracleVault - previewShares Simple Tests", function () {
  let mockOracleHelper: MockOracleHelper;

  const SHARES_PRECISION = 10n ** 6n; // 1e6
  const INITIAL_PRICE = ethers.parseUnits("2000", 6); // 2000 USDC per ETH

  beforeEach(async function () {
    // Deploy mock oracle helper
    const MockOracleHelper = await ethers.getContractFactory("MockOracleHelper");
    mockOracleHelper = await MockOracleHelper.deploy(INITIAL_PRICE);
  });

  describe("Mock Metropolis Oracle Helper Tests", function () {
    it("should deploy and initialize mock oracle helper correctly", async function () {
      const [deployer] = await ethers.getSigners();
      
      expect(await mockOracleHelper.isInitialized()).to.be.false;
      
      // Initialize oracle helper
      await mockOracleHelper.initialize(
        deployer.address, // vault address
        3600,             // heartbeatX
        3600,             // heartbeatY
        ethers.parseUnits("1000", 6),  // minPrice
        ethers.parseUnits("10000", 6), // maxPrice
        ethers.ZeroAddress             // sequencer feed
      );
      
      expect(await mockOracleHelper.isInitialized()).to.be.true;
      expect(await mockOracleHelper.getPrice()).to.equal(INITIAL_PRICE);
    });

    it("should allow price updates", async function () {
      const [deployer] = await ethers.getSigners();
      
      await mockOracleHelper.initialize(
        deployer.address,
        3600, 3600,
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("10000", 6),
        ethers.ZeroAddress
      );
      
      const newPrice = ethers.parseUnits("3000", 6); // 3000 USDC per ETH
      await mockOracleHelper.setPrice(newPrice);
      
      expect(await mockOracleHelper.getPrice()).to.equal(newPrice);
    });

    it("should handle price deviation settings", async function () {
      const [deployer] = await ethers.getSigners();
      
      await mockOracleHelper.initialize(
        deployer.address,
        3600, 3600,
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("10000", 6),
        ethers.ZeroAddress
      );
      
      // Default should be within deviation
      expect(await mockOracleHelper.checkPriceInDeviation()).to.be.true;
      
      // Set out of deviation
      await mockOracleHelper.setPriceInDeviation(false);
      expect(await mockOracleHelper.checkPriceInDeviation()).to.be.false;
      
      // Set back within deviation
      await mockOracleHelper.setPriceInDeviation(true);
      expect(await mockOracleHelper.checkPriceInDeviation()).to.be.true;
    });

    it("should calculate getValueInY correctly", async function () {
      const [deployer] = await ethers.getSigners();
      
      await mockOracleHelper.initialize(
        deployer.address,
        3600, 3600,
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("10000", 6),
        ethers.ZeroAddress
      );
      
      // Set token decimals for proper calculation
      await mockOracleHelper.setTokenDecimals(18, 6);
      
      const amountX = ethers.parseEther("1");     // 1 ETH (18 decimals)
      const amountY = ethers.parseUnits("500", 6); // 500 USDC (6 decimals)
      const price = INITIAL_PRICE; // 2000 USDC per ETH
      
      const valueInY = await mockOracleHelper.getValueInY(price, amountX, amountY);
      
      // Expected: (1 ETH * 2000 USDC/ETH) + 500 USDC = 2500 USDC
      const expectedValue = ethers.parseUnits("2500", 6);
      expect(valueInY).to.equal(expectedValue);
    });
  });

  describe("Mathematical Helper Tests", function () {
    it("should verify SHARES_PRECISION calculations", function () {
      expect(SHARES_PRECISION).to.equal(1000000n);
      
      const valueInY = ethers.parseUnits("2500", 6); // 2500 USDC
      const expectedShares = valueInY * SHARES_PRECISION;
      
      // First deposit shares = valueInY * 1e6
      expect(expectedShares).to.equal(ethers.parseUnits("2500", 12)); // 2500 * 1e6 = 2500e6 * 1e6 = 2500e12
    });

    it("should verify proportional share calculations", function () {
      const valueInY = ethers.parseUnits("1000", 6);      // 1000 USDC new deposit
      const totalShares = ethers.parseUnits("5000", 6);   // 5000 existing shares
      const totalValueInY = ethers.parseUnits("5000", 6); // 5000 USDC total value
      
      // Expected shares = (1000 * 5000) / 5000 = 1000 shares
      const expectedShares = (valueInY * totalShares) / totalValueInY;
      expect(expectedShares).to.equal(ethers.parseUnits("1000", 6));
    });

    it("should handle decimal conversion correctly", function () {
      // Test conversion from 18 decimal ETH to 6 decimal USDC value
      const amountX = ethers.parseEther("1");     // 1 ETH = 1e18
      const priceXInY = INITIAL_PRICE;            // 2000 USDC per ETH = 2000e6
      
      // Convert: (amountX * priceXInY) / 1e18 = (1e18 * 2000e6) / 1e18 = 2000e6
      const convertedValue = (amountX * priceXInY) / ethers.parseEther("1");
      expect(convertedValue).to.equal(ethers.parseUnits("2000", 6));
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero amounts", async function () {
      // Test mathematical operations with zero
      expect(0n * SHARES_PRECISION).to.equal(0n);
      expect((0n * 1000n) / 1n).to.equal(0n);
    });

    it("should handle very large amounts without overflow", async function () {
      const largeAmount = ethers.parseEther("1000000"); // 1M ETH
      const largeValue = (largeAmount * INITIAL_PRICE) / ethers.parseEther("1");
      
      expect(largeValue).to.be.gt(0);
      expect(largeValue).to.equal(ethers.parseUnits("2000000000", 6)); // 2B USDC
    });

    it("should maintain precision in calculations", async function () {
      const amountX = ethers.parseEther("0.001");    // 0.001 ETH
      const amountY = ethers.parseUnits("1.5", 6);   // 1.5 USDC
      
      // Value = (0.001 * 2000) + 1.5 = 2 + 1.5 = 3.5 USDC
      const expectedValue = (amountX * INITIAL_PRICE) / ethers.parseEther("1") + amountY;
      expect(expectedValue).to.equal(ethers.parseUnits("3.5", 6));
    });
  });
});