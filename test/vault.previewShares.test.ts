import { expect } from "chai";
import { ethers } from "hardhat";
import type { Contract } from "ethers";

/**
 * Tests for previewShares function using simplified test contracts
 * 
 * This test suite uses simplified test contracts that expose the core previewShares logic
 * without the complexity of proxy deployments and clone patterns.
 */
describe("Vault previewShares Function Tests", function () {
  let testOracleVault: Contract;
  let testShadowVault: Contract;
  let mockOracleHelper: Contract;
  let mockPool: Contract;
  let deployer: any;

  const SHARES_PRECISION = 10n ** 6n; // 1e6
  const INITIAL_PRICE = ethers.parseUnits("2000", 6); // 2000 USDC per ETH

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy mock oracle helper for Metropolis vaults
    const MockOracleHelper = await ethers.getContractFactory("MockOracleHelper");
    mockOracleHelper = await MockOracleHelper.deploy(INITIAL_PRICE);
    await mockOracleHelper.waitForDeployment();

    // Initialize oracle helper
    await mockOracleHelper.initialize(
      deployer.address, // vault address
      3600,            // heartbeatX
      3600,            // heartbeatY
      ethers.parseUnits("1000", 6),    // minPrice
      ethers.parseUnits("10000", 6),   // maxPrice
      ethers.ZeroAddress               // sequencer feed
    );
    await mockOracleHelper.setTokenDecimals(18, 6);

    // Deploy mock pool for Shadow vaults
    const SimpleMockPool = await ethers.getContractFactory("SimpleMockPool");
    const INITIAL_SQRT_PRICE_X96 = "3543191142285914205922034323"; // ~2000 USDC per ETH
    const INITIAL_TICK = 73136;
    mockPool = await SimpleMockPool.deploy(
      ethers.ZeroAddress, // tokenX (not used in simplified version)
      ethers.ZeroAddress, // tokenY (not used in simplified version)
      INITIAL_SQRT_PRICE_X96,
      INITIAL_TICK
    );
    await mockPool.waitForDeployment();

    // Deploy test contracts that expose previewShares logic
    const TestOracleVault = await ethers.getContractFactory("TestOracleVault");
    testOracleVault = await TestOracleVault.deploy(await mockOracleHelper.getAddress());
    await testOracleVault.waitForDeployment();

    const TestShadowVault = await ethers.getContractFactory("TestShadowVault");
    testShadowVault = await TestShadowVault.deploy(
      await mockPool.getAddress(),
      18, // decimalsX
      6   // decimalsY
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
      // Ensure total supply is 0 for first deposit scenario
      await testOracleVault.setTotalSupply(0);
      
      const amountX = ethers.parseEther("1");     // 1 ETH
      const amountY = ethers.parseUnits("500", 6); // 500 USDC

      const result = await testOracleVault.previewShares(amountX, amountY);
      
      // For first deposit: shares = valueInY * SHARES_PRECISION
      // valueInY = (1 ETH * 2000 USDC/ETH) + 500 USDC = 2500 USDC
      const expectedValueInY = ethers.parseUnits("2500", 6);
      const expectedShares = expectedValueInY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle X-only deposits", async function () {
      await testOracleVault.setTotalSupply(0);
      
      const amountX = ethers.parseEther("1");
      const amountY = 0n;

      const result = await testOracleVault.previewShares(amountX, amountY);
      
      // valueInY = 1 ETH * 2000 USDC/ETH = 2000 USDC
      const expectedValueInY = ethers.parseUnits("2000", 6);
      const expectedShares = expectedValueInY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(0n);
    });

    it("should handle Y-only deposits", async function () {
      await testOracleVault.setTotalSupply(0);
      
      const amountX = 0n;
      const amountY = ethers.parseUnits("1000", 6); // 1000 USDC

      const result = await testOracleVault.previewShares(amountX, amountY);
      
      // valueInY = 1000 USDC
      const expectedShares = amountY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(0n);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle subsequent deposits correctly", async function () {
      // Set up vault state for subsequent deposit scenario
      const totalShares = ethers.parseUnits("5000", 6);      // 5000 shares exist
      const totalBalanceX = ethers.parseEther("2");          // 2 ETH in vault
      const totalBalanceY = ethers.parseUnits("2000", 6);    // 2000 USDC in vault
      
      await testOracleVault.setTotalSupply(totalShares);
      await testOracleVault.setTotalBalances(totalBalanceX, totalBalanceY);
      
      // New deposit: 1 ETH + 500 USDC = 2500 USDC value
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);
      
      const result = await testOracleVault.previewShares(amountX, amountY);
      
      // Total vault value = (2 ETH * 2000) + 2000 USDC = 6000 USDC
      // Deposit value = (1 ETH * 2000) + 500 USDC = 2500 USDC
      // Expected shares = 2500 * 5000 / 6000 = 2083.33... shares
      const expectedShares = (ethers.parseUnits("2500", 6) * totalShares) / ethers.parseUnits("6000", 6);
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
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
      // Ensure total supply is 0 for first deposit scenario
      await testShadowVault.setTotalSupply(0);
      
      const amountX = ethers.parseEther("1");     // 1 ETH
      const amountY = ethers.parseUnits("500", 6); // 500 USDC

      const result = await testShadowVault.previewShares(amountX, amountY);
      
      // Shadow vault calculation: valueInY = (priceXinY * amountX) + amountY
      // priceXinY = 2000e6, amountX = 1e18, amountY = 500e6
      // valueInY = (2000e6 * 1e18) / 1e18 + 500e6 = 2000e6 + 500e6 = 2500e6
      const expectedValueInY = ethers.parseUnits("2500", 6);
      const expectedShares = expectedValueInY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle X-only deposits", async function () {
      await testShadowVault.setTotalSupply(0);
      
      const amountX = ethers.parseEther("1");
      const amountY = 0n;

      const result = await testShadowVault.previewShares(amountX, amountY);
      
      // valueInY = (2000e6 * 1e18) / 1e18 = 2000e6
      const expectedValueInY = ethers.parseUnits("2000", 6);
      const expectedShares = expectedValueInY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(0n);
    });

    it("should handle Y-only deposits", async function () {
      await testShadowVault.setTotalSupply(0);
      
      const amountX = 0n;
      const amountY = ethers.parseUnits("1000", 6); // 1000 USDC

      const result = await testShadowVault.previewShares(amountX, amountY);
      
      // valueInY = 0 + 1000e6 = 1000e6
      const expectedShares = amountY * SHARES_PRECISION;
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(0n);
      expect(result.effectiveY).to.equal(amountY);
    });

    it("should handle subsequent deposits correctly", async function () {
      // Set up vault state for subsequent deposit scenario
      const totalShares = ethers.parseUnits("4000", 6);      // 4000 shares exist
      const totalBalanceX = ethers.parseEther("1.5");        // 1.5 ETH in vault
      const totalBalanceY = ethers.parseUnits("1000", 6);    // 1000 USDC in vault
      
      await testShadowVault.setTotalSupply(totalShares);
      await testShadowVault.setTotalBalances(totalBalanceX, totalBalanceY);
      
      // New deposit: 0.5 ETH + 500 USDC = 1500 USDC value
      const amountX = ethers.parseEther("0.5");
      const amountY = ethers.parseUnits("500", 6);
      
      const result = await testShadowVault.previewShares(amountX, amountY);
      
      // Total vault value = (1.5 ETH * 2000) + 1000 USDC = 4000 USDC
      // Deposit value = (0.5 ETH * 2000) + 500 USDC = 1500 USDC
      // Expected shares = 1500 * 4000 / 4000 = 1500 shares
      const expectedShares = ethers.parseUnits("1500", 6);
      
      expect(result.shares).to.equal(expectedShares);
      expect(result.effectiveX).to.equal(amountX);
      expect(result.effectiveY).to.equal(amountY);
    });
  });

  describe("Comparative Tests", function () {
    it("should demonstrate consistent pricing between vault types", async function () {
      // Set up both vaults for first deposit scenario
      await testOracleVault.setTotalSupply(0);
      await testShadowVault.setTotalSupply(0);
      
      const amountX = ethers.parseEther("1");
      const amountY = ethers.parseUnits("500", 6);
      
      // Both vaults should return the same shares for the same input and price
      const oracleResult = await testOracleVault.previewShares(amountX, amountY);
      const shadowResult = await testShadowVault.previewShares(amountX, amountY);
      
      // Both should return positive shares
      expect(oracleResult.shares).to.be.gt(0n);
      expect(shadowResult.shares).to.be.gt(0n);
      
      // With the same underlying price (2000 USDC/ETH), both should give same result
      expect(oracleResult.shares).to.equal(shadowResult.shares);
      
      // Both should return the same effective amounts
      expect(oracleResult.effectiveX).to.equal(amountX);
      expect(oracleResult.effectiveY).to.equal(amountY);
      expect(shadowResult.effectiveX).to.equal(amountX);
      expect(shadowResult.effectiveY).to.equal(amountY);
      
      // Expected: (1 ETH * 2000 USDC/ETH + 500 USDC) * 1e6 = 2500e12
      const expectedShares = ethers.parseUnits("2500", 12);
      expect(oracleResult.shares).to.equal(expectedShares);
      expect(shadowResult.shares).to.equal(expectedShares);
    });

    it("should handle edge cases consistently", async function () {
      // Test zero amounts
      const zeroOracle = await testOracleVault.previewShares(0, 0);
      const zeroShadow = await testShadowVault.previewShares(0, 0);
      
      expect(zeroOracle.shares).to.equal(0n);
      expect(zeroShadow.shares).to.equal(0n);
      expect(zeroOracle.effectiveX).to.equal(0n);
      expect(zeroShadow.effectiveX).to.equal(0n);
      expect(zeroOracle.effectiveY).to.equal(0n);
      expect(zeroShadow.effectiveY).to.equal(0n);
    });
  });
});