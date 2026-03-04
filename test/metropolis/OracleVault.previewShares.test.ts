import { expect } from "chai";
import { ethers } from "hardhat";
import type { MockLBPair } from "../../typechain-types/test/mocks/MockLBPair";
import type { TestOracleVault } from "../../typechain-types/test/mocks/TestOracleVault";

describe("Metropolis OracleVault - previewShares with LB Pair Pricing", function () {
  let mockLBPair: MockLBPair;
  let testOracleVault: TestOracleVault;

  const SHARES_PRECISION = 10n ** 6n;
  const TWO_128 = 1n << 128n;
  const ACTIVE_BIN_ID = 8388608;

  /**
   * Compute 128.128 price for "priceYperX" Y tokens per X token.
   * Uses numerator/denominator to support fractional prices without losing precision.
   */
  function computePrice128x128(
    numerator: bigint,
    denominator: bigint,
    decimalsX: bigint,
    decimalsY: bigint
  ): bigint {
    return (
      (numerator * 10n ** decimalsY * TWO_128) /
      (denominator * 10n ** decimalsX)
    );
  }

  /**
   * Mirror the on-chain getValueInY: (price * amountX) >> 128 + amountY.
   * Uses mulShiftRoundDown semantics (truncating division).
   */
  function expectedValueInY(
    price: bigint,
    amountX: bigint,
    amountY: bigint
  ): bigint {
    const amountXInY = (price * amountX) >> 128n;
    return amountXInY + amountY;
  }

  // ETH/USDC at 2000 USDC per ETH (decimalsX=18, decimalsY=6)
  const PRICE_ETH_USDC = computePrice128x128(2000n, 1n, 18n, 6n);

  beforeEach(async function () {
    const MockLBPair = await ethers.getContractFactory("MockLBPair");
    mockLBPair = (await MockLBPair.deploy(
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ACTIVE_BIN_ID,
      PRICE_ETH_USDC
    )) as unknown as MockLBPair;

    const TestOracleVault =
      await ethers.getContractFactory("TestOracleVault");
    testOracleVault = (await TestOracleVault.deploy(
      await mockLBPair.getAddress()
    )) as unknown as TestOracleVault;
  });

  describe("LB Pair Price Integration", function () {
    it("should read spot price from the LB pair", async function () {
      const price = await testOracleVault.getSpotPrice();
      expect(price).to.equal(PRICE_ETH_USDC);
    });

    it("should update when active bin changes", async function () {
      const newBinId = ACTIVE_BIN_ID + 10;
      const newPrice = PRICE_ETH_USDC + 1000n;

      await mockLBPair.setActiveId(newBinId);
      await mockLBPair.setPriceForId(newBinId, newPrice);

      const price = await testOracleVault.getSpotPrice();
      expect(price).to.equal(newPrice);
    });
  });

  describe("getValueInY with 128.128 Prices", function () {
    it("should convert ETH to USDC value correctly (18/6 decimals)", async function () {
      const amountX = ethers.parseEther("1");
      const amountY = 0n;

      const valueInY = await testOracleVault.getValueInY(amountX, amountY);
      const expected = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);

      // Result should be ~2000 USDC (within 1 wei of rounding)
      expect(valueInY).to.equal(expected);
      // Also verify it's very close to the ideal value
      const idealValue = ethers.parseUnits("2000", 6);
      expect(valueInY).to.be.closeTo(idealValue, 1n);
    });

    it("should handle Y-only deposits", async function () {
      const amountY = ethers.parseUnits("500", 6);
      const valueInY = await testOracleVault.getValueInY(0n, amountY);
      expect(valueInY).to.equal(amountY);
    });

    it("should combine X and Y values", async function () {
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const valueInY = await testOracleVault.getValueInY(amountX, amountY);
      const expected = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);

      expect(valueInY).to.equal(expected);
      // ~2500 USDC within 1 wei rounding
      expect(valueInY).to.be.closeTo(ethers.parseUnits("2500", 6), 1n);
    });
  });

  describe("previewShares - First Deposit", function () {
    it("should return 0 for zero amounts", async function () {
      const result = await testOracleVault.previewShares(0, 0);
      expect(result.shares).to.equal(0n);
      expect(result.effectiveX).to.equal(0n);
      expect(result.effectiveY).to.equal(0n);
    });

    it("should calculate first deposit shares correctly", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      // shares = valueInY * SHARES_PRECISION
      const value = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      const expectedShares = value * SHARES_PRECISION;

      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle X-only first deposit", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountX = ethers.parseEther("1");
      const result = await testOracleVault.previewShares(amountX, 0);

      const value = expectedValueInY(PRICE_ETH_USDC, amountX, 0n);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
    });

    it("should handle Y-only first deposit", async function () {
      await testOracleVault.setTotalSupply(0);

      const amountY = ethers.parseUnits("1000", 6);
      const result = await testOracleVault.previewShares(0, amountY);

      expect(result.shares).to.equal(amountY * SHARES_PRECISION);
    });
  });

  describe("previewShares - Subsequent Deposits", function () {
    it("should calculate proportional shares", async function () {
      const totalShares = ethers.parseUnits("5000", 6);
      const totalBalanceX = ethers.parseEther("2");
      const totalBalanceY = ethers.parseUnits("2000", 6);

      await testOracleVault.setTotalSupply(totalShares);
      await testOracleVault.setTotalBalances(totalBalanceX, totalBalanceY);

      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);

      const result = await testOracleVault.previewShares(amountX, amountY);

      // Compute expected shares using exact same rounding as contract
      const depositValue = expectedValueInY(PRICE_ETH_USDC, amountX, amountY);
      const totalValue = expectedValueInY(
        PRICE_ETH_USDC,
        totalBalanceX,
        totalBalanceY
      );
      const expectedShares = (depositValue * totalShares) / totalValue;

      expect(result.shares).to.equal(expectedShares);
    });
  });

  describe("Multi-Decimal Token Pairs", function () {
    it("should work for S/USDC pair (18/6 decimals) at 0.5 USDC per S", async function () {
      const priceSUsdc = computePrice128x128(1n, 2n, 18n, 6n); // 0.5
      await mockLBPair.setPriceForId(ACTIVE_BIN_ID, priceSUsdc);
      await testOracleVault.setTotalSupply(0);

      // 10 S at 0.5 USDC/S = 5 USDC
      const amountX = ethers.parseEther("10");
      const result = await testOracleVault.previewShares(amountX, 0);

      const value = expectedValueInY(priceSUsdc, amountX, 0n);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
      // ~5 USDC = 5e6, within rounding
      expect(value).to.be.closeTo(ethers.parseUnits("5", 6), 1n);
    });

    it("should work for S/WETH pair (18/18 decimals) at 0.00025 WETH per S", async function () {
      const priceSWeth = computePrice128x128(1n, 4000n, 18n, 18n); // 1/4000
      await mockLBPair.setPriceForId(ACTIVE_BIN_ID, priceSWeth);
      await testOracleVault.setTotalSupply(0);

      // 4000 S at 0.00025 WETH/S = 1 WETH
      const amountX = ethers.parseEther("4000");
      const result = await testOracleVault.previewShares(amountX, 0);

      const value = expectedValueInY(priceSWeth, amountX, 0n);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
      // ~1 WETH = 1e18, within rounding
      expect(value).to.be.closeTo(ethers.parseEther("1"), 10n ** 6n); // within 1e6 wei (tiny fraction)
    });

    it("should work for USDC/WETH pair (6/18 decimals) at 0.0005 WETH per USDC", async function () {
      const priceUsdcWeth = computePrice128x128(1n, 2000n, 6n, 18n); // 1/2000
      await mockLBPair.setPriceForId(ACTIVE_BIN_ID, priceUsdcWeth);
      await testOracleVault.setTotalSupply(0);

      // 2000 USDC at 0.0005 WETH/USDC = 1 WETH
      const amountX = ethers.parseUnits("2000", 6);
      const result = await testOracleVault.previewShares(amountX, 0);

      const value = expectedValueInY(priceUsdcWeth, amountX, 0n);
      expect(result.shares).to.equal(value * SHARES_PRECISION);
      // ~1 WETH = 1e18
      expect(value).to.be.closeTo(ethers.parseEther("1"), 10n ** 6n);
    });
  });

  describe("Edge Cases", function () {
    it("should handle very small deposits", async function () {
      await testOracleVault.setTotalSupply(0);
      const result = await testOracleVault.previewShares(1n, 0);
      expect(result.shares).to.be.gte(0n);
    });

    it("should handle very large deposits without overflow", async function () {
      await testOracleVault.setTotalSupply(0);
      const result = await testOracleVault.previewShares(
        ethers.parseEther("1000000"),
        ethers.parseUnits("1000000000", 6)
      );
      expect(result.shares).to.be.gt(0n);
    });
  });
});
