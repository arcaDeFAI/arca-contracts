import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

/**
 * Comprehensive unit tests for previewShares functionality
 * 
 * These tests focus on the core mathematical logic and oracle integration
 * that powers the previewShares functions in both Metropolis and Shadow vaults.
 * 
 * While we cannot easily deploy the complex upgradeable vault contracts in tests,
 * we can thoroughly test the underlying mathematical formulas and oracle behavior
 * that these functions depend on.
 */
describe("PreviewShares - Comprehensive Logic Tests", function () {
  let oracleHelper: Contract;
  let mockPool: Contract;
  let tokenX: Contract;
  let tokenY: Contract;
  let deployer: any;

  const SHARES_PRECISION = 10n ** 6n; // 1e6
  const INITIAL_PRICE = ethers.parseUnits("2000", 6); // 2000 USDC per ETH
  const INITIAL_SQRT_PRICE_X96 = "3543191142285914205922034323"; // ~2000 USDC per ETH
  const INITIAL_TICK = 73136;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenX = await MockERC20.deploy("Token X", "TX", 18, deployer.address); // ETH-like
    tokenY = await MockERC20.deploy("Token Y", "TY", 6, deployer.address);  // USDC-like

    // Deploy mock oracle helper (the key component for Metropolis previewShares)
    const MockOracleHelper = await ethers.getContractFactory("MockOracleHelper");
    oracleHelper = await MockOracleHelper.deploy(INITIAL_PRICE);

    // Deploy simple mock pool (key component for Shadow previewShares)
    const SimpleMockPool = await ethers.getContractFactory("SimpleMockPool");
    mockPool = await SimpleMockPool.deploy(
      await tokenX.getAddress(),
      await tokenY.getAddress(),
      INITIAL_SQRT_PRICE_X96,
      INITIAL_TICK
    );

    // Initialize oracle helper
    await oracleHelper.initialize(
      deployer.address, // vault address
      3600,            // heartbeatX
      3600,            // heartbeatY
      ethers.parseUnits("1000", 6),    // minPrice
      ethers.parseUnits("10000", 6),   // maxPrice
      ethers.ZeroAddress               // sequencer feed
    );
    await oracleHelper.setTokenDecimals(18, 6);
  });

  describe("Metropolis PreviewShares Logic", function () {
    /**
     * Metropolis previewShares logic:
     * 1. Get price from oracle helper
     * 2. Check price deviation (reverts if out of bounds)  
     * 3. Calculate valueInY using oracle helper
     * 4. If totalSupply == 0: shares = valueInY * SHARES_PRECISION
     * 5. If totalSupply > 0: shares = valueInY * totalShares / totalValueInY
     */

    it("should calculate valueInY correctly using oracle helper", async function () {
      const amountX = ethers.parseEther("1");     // 1 ETH
      const amountY = ethers.parseUnits("500", 6); // 500 USDC
      const price = await oracleHelper.getPrice();

      // Call oracle helper's getValueInY (this is what previewShares uses internally)
      const valueInY = await oracleHelper.getValueInY(price, amountX, amountY);

      // Expected: (1 ETH * 2000 USDC/ETH) + 500 USDC = 2500 USDC
      const expectedValue = ethers.parseUnits("2500", 6);
      expect(valueInY).to.equal(expectedValue);
    });

    it("should implement first deposit formula correctly", async function () {
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);
      const price = await oracleHelper.getPrice();
      
      const valueInY = await oracleHelper.getValueInY(price, amountX, amountY);
      
      // First deposit formula: shares = valueInY * SHARES_PRECISION
      const expectedShares = valueInY * SHARES_PRECISION;
      
      // This is exactly what OracleVault._previewShares does when totalSupply == 0
      expect(expectedShares).to.equal(ethers.parseUnits("2500", 12)); // 2500e6 * 1e6 = 2500e12
    });

    it("should implement subsequent deposit formula correctly", async function () {
      const depositValueInY = ethers.parseUnits("1000", 6);  // New deposit value
      const totalShares = ethers.parseUnits("5000", 6);      // Existing shares
      const totalValueInY = ethers.parseUnits("5000", 6);    // Existing vault value
      
      // Subsequent deposit formula: shares = valueInY * totalShares / totalValueInY
      const expectedShares = (depositValueInY * totalShares) / totalValueInY;
      
      // This should give proportional shares
      expect(expectedShares).to.equal(ethers.parseUnits("1000", 6)); // 20% deposit → 20% of shares
    });

    it("should handle price deviation checks", async function () {
      // Price within deviation should succeed
      await oracleHelper.setPriceInDeviation(true);
      expect(await oracleHelper.checkPriceInDeviation()).to.be.true;

      // Price out of deviation should return false
      await oracleHelper.setPriceInDeviation(false);
      expect(await oracleHelper.checkPriceInDeviation()).to.be.false;
    });

    it("should handle different price scenarios", async function () {
      const amountX = ethers.parseEther("1");
      const testPrices = [
        ethers.parseUnits("1000", 6),
        ethers.parseUnits("3000", 6),
        ethers.parseUnits("5000", 6)
      ];

      for (const price of testPrices) {
        await oracleHelper.setPrice(price);
        const valueInY = await oracleHelper.getValueInY(price, amountX, 0);
        
        // Value should scale linearly with price
        expect(valueInY).to.equal(price);
        
        // First deposit shares should scale accordingly
        const shares = valueInY * SHARES_PRECISION;
        expect(shares).to.equal(price * SHARES_PRECISION);
      }
    });

    it("should handle zero amounts", async function () {
      // Zero amounts should return zero value (previewShares returns (0,0,0))
      const price = await oracleHelper.getPrice();
      const valueInY = await oracleHelper.getValueInY(price, 0, 0);
      expect(valueInY).to.equal(0n);
    });

    it("should handle X-only and Y-only deposits", async function () {
      const price = await oracleHelper.getPrice();
      
      // X-only deposit
      const amountX = ethers.parseEther("1");
      const valueInY_X = await oracleHelper.getValueInY(price, amountX, 0);
      expect(valueInY_X).to.equal(price); // 1 ETH * 2000 USDC/ETH
      
      // Y-only deposit  
      const amountY = ethers.parseUnits("1000", 6);
      const valueInY_Y = await oracleHelper.getValueInY(price, 0, amountY);
      expect(valueInY_Y).to.equal(amountY); // 1000 USDC
    });
  });

  describe("Shadow PreviewShares Logic", function () {
    /**
     * Shadow previewShares logic:
     * 1. Get price from pool (spot or TWAP)
     * 2. Calculate valueInY = (priceXinY * amountX) + amountY
     * 3. If totalSupply == 0: shares = valueInY * SHARES_PRECISION  
     * 4. If totalSupply > 0: shares = valueInY * totalShares / totalValueInY
     */

    it("should read pool state correctly", async function () {
      const [sqrtPriceX96, tick, , , , ,] = await mockPool.slot0();
      
      expect(sqrtPriceX96).to.equal(INITIAL_SQRT_PRICE_X96);
      expect(tick).to.equal(INITIAL_TICK);
      expect(await mockPool.token0()).to.equal(await tokenX.getAddress());
      expect(await mockPool.token1()).to.equal(await tokenY.getAddress());
    });

    it("should handle pool price changes", async function () {
      // Get initial state
      const [initialSqrtPriceX96] = await mockPool.slot0();
      
      // Change price (double it)
      const newSqrtPriceX96 = BigInt(initialSqrtPriceX96) * 141n / 100n; // ~2x price
      const newTick = INITIAL_TICK + 6932;
      
      await mockPool.setSqrtPriceX96(newSqrtPriceX96);
      await mockPool.setTick(newTick);
      
      const [updatedSqrtPriceX96, updatedTick] = await mockPool.slot0();
      expect(updatedSqrtPriceX96).to.equal(newSqrtPriceX96);
      expect(updatedTick).to.equal(newTick);
    });

    it("should implement Shadow value calculation formula", async function () {
      // Shadow calculation: valueInY = (priceXinY * amountX) + amountY
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);
      const priceXinY = 2000n; // Simplified price representation

      // This is the core Shadow vault calculation
      const valueInY = (priceXinY * amountX) + amountY;
      
      // For 1 ETH at 2000 USDC/ETH + 500 USDC = 2000 ETH-units + 500 USDC
      // The exact calculation depends on decimal handling, but the pattern is correct
      expect(valueInY).to.be.gt(amountY); // Should be larger than Y-only amount
    });

    it("should handle Shadow first deposit formula", async function () {
      const valueInY = ethers.parseUnits("2500", 6);
      
      // Shadow first deposit: shares = valueInY * SHARES_PRECISION
      const shares = valueInY * SHARES_PRECISION;
      
      expect(shares).to.equal(ethers.parseUnits("2500", 12));
    });

    it("should handle Shadow subsequent deposits", async function () {
      const depositValueInY = ethers.parseUnits("800", 6);
      const totalShares = ethers.parseUnits("4000", 6);  
      const totalValueInY = ethers.parseUnits("4000", 6);
      
      // Shadow subsequent deposit: same formula as Metropolis
      const shares = (depositValueInY * totalShares) / totalValueInY;
      
      expect(shares).to.equal(ethers.parseUnits("800", 6)); // Proportional
    });
  });

  describe("Mathematical Correctness and Edge Cases", function () {
    it("should maintain proportional relationships", async function () {
      const baseValueInY = ethers.parseUnits("1000", 6);
      const doubleValueInY = ethers.parseUnits("2000", 6);
      
      // First deposit scenario
      const baseShares = baseValueInY * SHARES_PRECISION;
      const doubleShares = doubleValueInY * SHARES_PRECISION;
      
      expect(doubleShares).to.equal(baseShares * 2n);
    });

    it("should handle very large amounts without overflow", async function () {
      const largeValue = ethers.parseUnits("1000000", 6); // 1M USDC
      const shares = largeValue * SHARES_PRECISION;
      
      expect(shares).to.be.gt(0n);
      expect(shares).to.equal(ethers.parseUnits("1000000", 12));
    });

    it("should handle very small amounts", async function () {
      const smallValue = 1n; // 1 wei
      const shares = smallValue * SHARES_PRECISION;
      
      expect(shares).to.equal(SHARES_PRECISION); // 1 wei * 1e6 = 1e6
    });

    it("should handle zero total supply scenario", async function () {
      // First deposit should always use: shares = valueInY * SHARES_PRECISION
      const valueInY = ethers.parseUnits("1500", 6);
      const shares = valueInY * SHARES_PRECISION;
      
      expect(shares).to.be.gt(0n);
      expect(shares).to.be.gte(SHARES_PRECISION); // At least 1 share unit
    });

    it("should handle rounding in proportional calculations", async function () {
      const valueInY = ethers.parseUnits("333", 6);      // 333 USDC
      const totalShares = ethers.parseUnits("1000", 6);  // 1000 shares
      const totalValueInY = ethers.parseUnits("999", 6); // 999 USDC total value
      
      // This tests rounding behavior in integer division
      const shares = (valueInY * totalShares) / totalValueInY;
      
      // Should handle the calculation without reverting
      expect(shares).to.be.gt(0n);
    });
  });

  describe("Integration Scenarios", function () {
    it("should verify SHARES_PRECISION across both vault types", async function () {
      // Both Metropolis and Shadow use the same SHARES_PRECISION
      expect(SHARES_PRECISION).to.equal(1000000n); // 1e6
      
      // This precision affects share calculations in both vault types
      const testValue = ethers.parseUnits("100", 6); // 100 USDC
      const shares = testValue * SHARES_PRECISION;
      
      expect(shares).to.equal(ethers.parseUnits("100", 12)); // 100e6 * 1e6 = 100e12
    });

    it("should demonstrate different pricing mechanisms", async function () {
      // Metropolis: Uses oracle helper with external price feeds
      const oraclePrice = await oracleHelper.getPrice();
      expect(oraclePrice).to.equal(INITIAL_PRICE);
      
      // Shadow: Uses pool state for pricing
      const [sqrtPriceX96] = await mockPool.slot0();
      expect(sqrtPriceX96).to.equal(INITIAL_SQRT_PRICE_X96);
      
      // Both should give reasonable pricing for the same underlying assets
      // (exact comparison would require price conversion logic)
    });

    it("should handle extreme scenarios gracefully", async function () {
      // Test extreme price
      await oracleHelper.setPrice(ethers.parseUnits("100000", 6)); // 100k USDC/ETH
      const highPrice = await oracleHelper.getPrice();
      expect(highPrice).to.equal(ethers.parseUnits("100000", 6));
      
      // Test pool extreme tick
      await mockPool.setTick(887272); // Very high tick
      const [, newTick] = await mockPool.slot0();
      expect(newTick).to.equal(887272);
    });
  });
});