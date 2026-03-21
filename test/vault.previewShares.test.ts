import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract } from "ethers";

/**
 * Tests for previewShares function using simplified test contracts.
 * Metropolis uses LB pair pricing, Shadow uses Ramses V3 pool pricing.
 */
describe("Vault previewShares Function Tests", function () {
  let testOracleVault: Contract;
  let testShadowVault: Contract;
  let mockLBPair: Contract;
  let mockPool: Contract;

  const SHARES_PRECISION = 10n ** 6n;
  const TWO_128 = 1n << 128n;
  const ACTIVE_BIN_ID = 8388608;

  // 128.128 price for 2000 USDC per ETH (18/6 decimal pair)
  // = 2000 * 10^6 * 2^128 / 10^18
  const PRICE_ETH_USDC = (2000n * 10n ** 6n * TWO_128) / 10n ** 18n;

  /** Mirror on-chain getValueInY rounding */
  function expectedValueInY(
    price: bigint,
    amountX: bigint,
    amountY: bigint
  ): bigint {
    return ((price * amountX) >> 128n) + amountY;
  }

  beforeEach(async function () {
    // Deploy mock LB pair for Metropolis vaults
    const MockLBPair = await ethers.getContractFactory("MockLBPair");
    mockLBPair = await MockLBPair.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ACTIVE_BIN_ID,
      PRICE_ETH_USDC
    );
    await mockLBPair.waitForDeployment();

    // Deploy mock pool for Shadow vaults
    const SimpleMockPool = await ethers.getContractFactory("SimpleMockPool");
    const INITIAL_SQRT_PRICE_X96 = "3543191142285914205922034323";
    const INITIAL_TICK = 73136;
    mockPool = await SimpleMockPool.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      INITIAL_SQRT_PRICE_X96,
      INITIAL_TICK
    );
    await mockPool.waitForDeployment();

    // Deploy Metropolis test vault (uses LB pair directly)
    const TestOracleVault =
      await ethers.getContractFactory("TestOracleVault");
    testOracleVault = await TestOracleVault.deploy(
      await mockLBPair.getAddress()
    );
    await testOracleVault.waitForDeployment();

    // Deploy Shadow test vault
    const TestShadowVault =
      await ethers.getContractFactory("TestShadowVault");
    testShadowVault = await TestShadowVault.deploy(
      await mockPool.getAddress(),
      18,
      6
    );
    await testShadowVault.waitForDeployment();
  });

  describe("OracleVault previewShares", function () {
    it("should return (0,0,0) for zero amounts", async function () {
      const result = await testOracleVault.previewShares(0, 0);
      expect(result.shares).to.equal(0n);
      expect(result.effectiveX).to.equal(0n);
      expect(result.effectiveY).to.equal(0n);
    });

    it("should calculate shares correctly for first deposit", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      const value = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle X-only deposits", async function () {
      await testOracleVault.setTotalSupply(0);
      const amountX = ethers.parseEther("1");
      const result = await testOracleVault.previewShares(amountX, 0n);

      const value = expectedValueInY(PRICE_ETH_USDC, amountX, 0n);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
    });

    it("should handle Y-only deposits", async function () {
      await testOracleVault.setTotalSupply(0);
      const amountY = ethers.parseUnits("1000", 6);
      const result = await testOracleVault.previewShares(0n, amountY);
      expect(result.shares).to.equal(amountY * SHARES_PRECISION);
    });

    it("should handle subsequent deposits correctly", async function () {
      const totalShares = ethers.parseUnits("5000", 6);
      const totalBalanceX = ethers.parseEther("2");
      const totalBalanceY = ethers.parseUnits("2000", 6);

      await testOracleVault.setTotalSupply(totalShares);
      await testOracleVault.setTotalBalances(totalBalanceX, totalBalanceY);

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      const depositValue = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      const totalValue = expectedValueInY(
        PRICE_ETH_USDC,
        totalBalanceX,
        totalBalanceY
      );
      const expected = (depositValue * totalShares) / totalValue;
      expect(result.shares).to.equal(expected);
    });
  });

  describe("ShadowVault previewShares", function () {
    it("should return (0,0,0) for zero amounts", async function () {
      const result = await testShadowVault.previewShares(0, 0);
      expect(result.shares).to.equal(0n);
      expect(result.effectiveX).to.equal(0n);
      expect(result.effectiveY).to.equal(0n);
    });

    it("should calculate shares correctly for first deposit", async function () {
      await testShadowVault.setTotalSupply(0);
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testShadowVault.previewShares(amountX, amountY);

      const expectedShares = ethers.parseUnits("2500", 12);
      expect(result.shares).to.equal(expectedShares);
    });

    it("should handle X-only deposits", async function () {
      await testShadowVault.setTotalSupply(0);
      const amountX = ethers.parseEther("1");
      const result = await testShadowVault.previewShares(amountX, 0n);

      const expectedShares = ethers.parseUnits("2000", 12);
      expect(result.shares).to.equal(expectedShares);
    });

    it("should handle Y-only deposits", async function () {
      await testShadowVault.setTotalSupply(0);
      const amountY = ethers.parseUnits("1000", 6);
      const result = await testShadowVault.previewShares(0n, amountY);
      expect(result.shares).to.equal(amountY * SHARES_PRECISION);
    });

    it("should handle subsequent deposits correctly", async function () {
      const totalShares = ethers.parseUnits("4000", 6);
      await testShadowVault.setTotalSupply(totalShares);
      await testShadowVault.setTotalBalances(
        ethers.parseEther("1.5"),
        ethers.parseUnits("1000", 6)
      );

      const amountX = ethers.parseEther("0.5");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testShadowVault.previewShares(amountX, amountY);
      const expectedShares = ethers.parseUnits("1500", 6);
      expect(result.shares).to.equal(expectedShares);
    });
  });

  describe("Comparative Tests", function () {
    it("should produce consistent shares between vault types for same price", async function () {
      await testOracleVault.setTotalSupply(0);
      await testShadowVault.setTotalSupply(0);

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const oracleResult = await testOracleVault.previewShares(
        amountX,
        amountY
      );
      const shadowResult = await testShadowVault.previewShares(
        amountX,
        amountY
      );

      expect(oracleResult.shares).to.be.gt(0n);
      expect(shadowResult.shares).to.be.gt(0n);

      // Both should be very close (within 1 USDC worth of rounding * SHARES_PRECISION)
      const diff =
        oracleResult.shares > shadowResult.shares
          ? oracleResult.shares - shadowResult.shares
          : shadowResult.shares - oracleResult.shares;
      // Within 1e6 shares (1 USDC worth)
      expect(diff).to.be.lte(SHARES_PRECISION);
    });

    it("should handle edge cases consistently", async function () {
      const zeroOracle = await testOracleVault.previewShares(0, 0);
      const zeroShadow = await testShadowVault.previewShares(0, 0);

      expect(zeroOracle.shares).to.equal(0n);
      expect(zeroShadow.shares).to.equal(0n);
    });
  });
});
