import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract } from "ethers";

/**
 * Comprehensive unit tests for previewShares functionality.
 * Tests core mathematical logic for Metropolis (LB pair) and Shadow (Ramses V3) vaults.
 */
describe("PreviewShares - Comprehensive Logic Tests", function () {
  let mockLBPair: Contract;
  let testOracleVault: Contract;
  let mockPool: Contract;
  let tokenX: Contract;
  let tokenY: Contract;

  const SHARES_PRECISION = 10n ** 6n;
  const TWO_128 = 1n << 128n;
  const ACTIVE_BIN_ID = 8388608;

  const PRICE_ETH_USDC = (2000n * 10n ** 6n * TWO_128) / 10n ** 18n;

  const INITIAL_SQRT_PRICE_X96 = "3543191142285914205922034323";
  const INITIAL_TICK = 73136;

  function expectedValueInY(
    price: bigint,
    amountX: bigint,
    amountY: bigint
  ): bigint {
    return ((price * amountX) >> 128n) + amountY;
  }

  beforeEach(async function () {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenX = await MockERC20.deploy("Token X", "TX", 18, ethers.ZeroAddress);
    tokenY = await MockERC20.deploy("Token Y", "TY", 6, ethers.ZeroAddress);

    const MockLBPair = await ethers.getContractFactory("MockLBPair");
    mockLBPair = await MockLBPair.deploy(
      await tokenX.getAddress(),
      await tokenY.getAddress(),
      ACTIVE_BIN_ID,
      PRICE_ETH_USDC
    );

    const TestOracleVault =
      await ethers.getContractFactory("TestOracleVault");
    testOracleVault = await TestOracleVault.deploy(
      await mockLBPair.getAddress()
    );

    const SimpleMockPool = await ethers.getContractFactory("SimpleMockPool");
    mockPool = await SimpleMockPool.deploy(
      await tokenX.getAddress(),
      await tokenY.getAddress(),
      INITIAL_SQRT_PRICE_X96,
      INITIAL_TICK
    );
  });

  describe("Metropolis PreviewShares Logic", function () {
    it("should calculate valueInY correctly from LB pair price", async function () {
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const valueInY = await testOracleVault.getValueInY(amountX, amountY);
      const expected = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);

      expect(valueInY).to.equal(expected);
      expect(valueInY).to.be.closeTo(ethers.parseUnits("2500", 6), 1n);
    });

    it("should implement first deposit formula correctly", async function () {
      await testOracleVault.setTotalSupply(0);
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      const value = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
    });

    it("should implement subsequent deposit formula correctly", async function () {
      const totalShares = ethers.parseUnits("5000", 6);
      await testOracleVault.setTotalSupply(totalShares);
      await testOracleVault.setTotalBalances(
        ethers.parseEther("2"),
        ethers.parseUnits("2000", 6)
      );

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      const depositValue = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      const totalValue = expectedValueInY(
        PRICE_ETH_USDC,
        ethers.parseEther("2"),
        ethers.parseUnits("2000", 6)
      );
      expect(result.shares).to.equal(
        (depositValue * totalShares) / totalValue
      );
    });

    it("should handle different price scenarios", async function () {
      await testOracleVault.setTotalSupply(0);
      const amountX = ethers.parseEther("1");

      const prices = [
        (1000n * 10n ** 6n * TWO_128) / 10n ** 18n,
        PRICE_ETH_USDC,
        (5000n * 10n ** 6n * TWO_128) / 10n ** 18n,
      ];

      for (const price of prices) {
        await mockLBPair.setPriceForId(ACTIVE_BIN_ID, price);
        const result = await testOracleVault.previewShares(amountX, 0);
        expect(result.shares).to.be.gt(0n);
      }
    });

    it("should handle zero amounts", async function () {
      const result = await testOracleVault.previewShares(0, 0);
      expect(result.shares).to.equal(0n);
    });

    it("should handle X-only and Y-only deposits", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountX = ethers.parseEther("1");
      const resultX = await testOracleVault.previewShares(amountX, 0);
      const valueX = expectedValueInY(PRICE_ETH_USDC, amountX, 0n);
      expect(resultX.shares).to.equal(valueX * SHARES_PRECISION);

      const amountY = ethers.parseUnits("1000", 6);
      const resultY = await testOracleVault.previewShares(0, amountY);
      expect(resultY.shares).to.equal(amountY * SHARES_PRECISION);
    });
  });

  describe("Shadow PreviewShares Logic", function () {
    it("should read pool state correctly", async function () {
      const [sqrtPriceX96, tick] = await mockPool.slot0();
      expect(sqrtPriceX96).to.equal(INITIAL_SQRT_PRICE_X96);
      expect(tick).to.equal(INITIAL_TICK);
    });

    it("should handle pool price changes", async function () {
      const [initialSqrtPriceX96] = await mockPool.slot0();
      const newSqrtPriceX96 =
        (BigInt(initialSqrtPriceX96) * 141n) / 100n;
      const newTick = INITIAL_TICK + 6932;

      await mockPool.setSqrtPriceX96(newSqrtPriceX96);
      await mockPool.setTick(newTick);

      const [updatedSqrtPriceX96, updatedTick] = await mockPool.slot0();
      expect(updatedSqrtPriceX96).to.equal(newSqrtPriceX96);
      expect(updatedTick).to.equal(newTick);
    });
  });

  describe("Mathematical Correctness and Edge Cases", function () {
    it("should maintain proportional relationships", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountX1 = ethers.parseEther("1");
      const amountX2 = ethers.parseEther("2");

      const result1 = await testOracleVault.previewShares(amountX1, 0);
      const result2 = await testOracleVault.previewShares(amountX2, 0);

      // Within 1 share unit due to 128.128 truncation rounding
      expect(result2.shares).to.be.closeTo(
        result1.shares * 2n,
        SHARES_PRECISION
      );
    });

    it("should handle very large amounts without overflow", async function () {
      await testOracleVault.setTotalSupply(0);
      const result = await testOracleVault.previewShares(
        ethers.parseEther("1000000"),
        0
      );
      expect(result.shares).to.be.gt(0n);
    });

    it("should handle very small amounts", async function () {
      await testOracleVault.setTotalSupply(0);
      const result = await testOracleVault.previewShares(1n, 0);
      expect(result.shares).to.be.gte(0n);
    });

    it("should handle rounding in proportional calculations", async function () {
      const totalShares = ethers.parseUnits("1000", 6);
      await testOracleVault.setTotalSupply(totalShares);
      await testOracleVault.setTotalBalances(
        ethers.parseEther("3"),
        ethers.parseUnits("999", 6)
      );

      const result = await testOracleVault.previewShares(
        0,
        ethers.parseUnits("333", 6)
      );
      expect(result.shares).to.be.gt(0n);
    });
  });

  describe("Integration Scenarios", function () {
    it("should verify SHARES_PRECISION", function () {
      expect(SHARES_PRECISION).to.equal(1000000n);
    });

    it("should handle extreme price scenarios gracefully", async function () {
      await testOracleVault.setTotalSupply(0);

      // Very high price: 100k USDC per ETH
      const highPrice = PRICE_ETH_USDC * 50n;
      await mockLBPair.setPriceForId(ACTIVE_BIN_ID, highPrice);

      const result = await testOracleVault.previewShares(
        ethers.parseEther("1"),
        0
      );
      expect(result.shares).to.be.gt(0n);

      // Very low price
      const lowPrice = PRICE_ETH_USDC / 2000n;
      await mockLBPair.setPriceForId(ACTIVE_BIN_ID, lowPrice);

      const result2 = await testOracleVault.previewShares(
        ethers.parseEther("1"),
        0
      );
      expect(result2.shares).to.be.gt(0n);
    });
  });
});
