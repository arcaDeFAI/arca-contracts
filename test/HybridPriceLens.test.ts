import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { HybridPriceLens, MockERC20, MockLBPair } from "../typechain-types";

describe("HybridPriceLens", function () {
  let hybridPriceLens: HybridPriceLens;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  
  let mockWS: MockERC20;  // 18 decimals native token
  let mockUSDC: MockERC20;  // 6 decimals stablecoin
  let mockWETH: MockERC20;  // 18 decimals
  let mockLBPair: MockLBPair;
  
  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockWS = await MockERC20Factory.deploy("Wrapped Sonic", "wS", 18, owner.address);
    mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC", 6, owner.address);
    mockWETH = await MockERC20Factory.deploy("Wrapped Ether", "WETH", 18, owner.address);
    
    // Deploy mock LB pair
    const MockLBPairFactory = await ethers.getContractFactory("MockLBPair");
    mockLBPair = await MockLBPairFactory.deploy();
    
    // Deploy HybridPriceLens
    const HybridPriceLensFactory = await ethers.getContractFactory("HybridPriceLens");
    hybridPriceLens = await HybridPriceLensFactory.deploy(await mockWS.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct wnative address", async function () {
      expect(await hybridPriceLens.wnative()).to.equal(await mockWS.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await hybridPriceLens.owner()).to.equal(owner.address);
    });
  });

  describe("Native Token Price", function () {
    it("Should return 1e18 for native token price", async function () {
      const price = await hybridPriceLens.getTokenPriceNative(await mockWS.getAddress());
      expect(price).to.equal(ethers.parseEther("1"));
    });
  });

  describe("LB Pair Price Calculation", function () {
    beforeEach(async function () {
      // Set up mock LB pair with wS (tokenX) and USDC (tokenY)
      await mockLBPair.setTokens(await mockWS.getAddress(), await mockUSDC.getAddress());
      
      // Set reference token
      await hybridPriceLens.setReferenceToken(await mockUSDC.getAddress(), true);
    });

    describe("USDC as TokenY (6 decimals)", function () {
      beforeEach(async function () {
        // Configure USDC price feed: USDC is tokenY, wS is tokenX
        await hybridPriceLens.setLBPairRoute(
          await mockUSDC.getAddress(),
          await mockLBPair.getAddress(),
          ethers.ZeroAddress, // direct to native
          false // USDC is tokenY
        );
      });

      it("Should calculate correct price when 1 USDC = 1 wS", async function () {
        // For USDC (6 decimals, tokenY): binPrice = (10^6 << 128) / targetPrice
        const targetPrice = ethers.parseEther("1"); // 1 wS per USDC
        const binPrice = (10n**6n << 128n) / targetPrice; // Formula for decimal-aware USDC
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.closeTo(targetPrice, ethers.parseEther("0.01")); // 1% tolerance
      });

      it("Should calculate correct price when 1 USDC = 0.5 wS", async function () {
        // For USDC (6 decimals, tokenY): binPrice = (10^6 << 128) / targetPrice
        const expectedPrice = ethers.parseEther("0.5");
        const binPrice = (10n**6n << 128n) / expectedPrice; // Formula for decimal-aware USDC
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      });

      it("Should calculate correct price when 1 USDC = 2 wS", async function () {
        // For USDC (6 decimals, tokenY): binPrice = (10^6 << 128) / targetPrice
        const expectedPrice = ethers.parseEther("2");
        const binPrice = (10n**6n << 128n) / expectedPrice; // Formula for decimal-aware USDC
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      });
    });

    describe("WETH as TokenX (18 decimals)", function () {
      beforeEach(async function () {
        // Set up pair with WETH (tokenX) and wS (tokenY)
        await mockLBPair.setTokens(await mockWETH.getAddress(), await mockWS.getAddress());
        
        // Configure WETH price feed: WETH is tokenX, wS is tokenY
        await hybridPriceLens.setLBPairRoute(
          await mockWETH.getAddress(),
          await mockLBPair.getAddress(),
          ethers.ZeroAddress, // direct to native
          true // WETH is tokenX
        );
      });

      it("Should calculate correct price when 1 WETH = 3000 wS", async function () {
        // For WETH (18 decimals, tokenX): binPrice = (targetPrice << 128) / 10^18
        const expectedPrice = ethers.parseEther("3000");
        const binPrice = (expectedPrice << 128n) / 10n**18n; // Formula for same-decimal tokenX
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockWETH.getAddress());
        expect(price).to.be.closeTo(expectedPrice, ethers.parseEther("30")); // 1% tolerance
      });
    });

    describe("Edge Cases", function () {
      beforeEach(async function () {
        await hybridPriceLens.setLBPairRoute(
          await mockUSDC.getAddress(),
          await mockLBPair.getAddress(),
          ethers.ZeroAddress,
          false
        );
      });

      it("Should handle very small prices", async function () {
        // 0.000001 wS per USDC using decimal-aware formula
        const targetPrice = ethers.parseEther("0.000001");
        const binPrice = (10n**6n << 128n) / targetPrice; // Formula for USDC
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.gte(ethers.parseEther("0.000001")); // Above MIN_PRICE
      });

      it("Should handle very large prices", async function () {
        // 1000 wS per USDC using decimal-aware formula
        const targetPrice = ethers.parseEther("1000");
        const binPrice = (10n**6n << 128n) / targetPrice; // Formula for USDC
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.lte(ethers.parseEther("1000000000000")); // Below MAX_PRICE
      });
    });
  });

  describe("Price Bounds", function () {
    beforeEach(async function () {
      await mockLBPair.setTokens(await mockWS.getAddress(), await mockUSDC.getAddress());
      await hybridPriceLens.setLBPairRoute(
        await mockUSDC.getAddress(),
        await mockLBPair.getAddress(),
        ethers.ZeroAddress,
        false
      );
    });

    it("Should revert for prices below minimum", async function () {
      // Set extremely small price that would be below MIN_PRICE (1e6)
      const tinyPrice = 1n; // Very small bin price
      await mockLBPair.setPrice(8388608, tinyPrice);
      
      await expect(
        hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(hybridPriceLens, "PriceLens__PriceOutOfBounds");
    });

    it("Should revert for prices above maximum", async function () {
      // Set extremely large price that would be above MAX_PRICE (1e36)
      const hugePrice = ethers.parseEther("1000000000000000000") << 128n; 
      await mockLBPair.setPrice(8388608, hugePrice);
      
      await expect(
        hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress())
      ).to.be.revertedWithCustomError(hybridPriceLens, "PriceLens__PriceOutOfBounds");
    });
  });

  describe("Configuration", function () {
    beforeEach(async function () {
      // Set up mock pair for configuration tests
      await mockLBPair.setTokens(await mockWS.getAddress(), await mockUSDC.getAddress());
    });

    it("Should set and get price feed configuration", async function () {
      await hybridPriceLens.setLBPairRoute(
        await mockUSDC.getAddress(),
        await mockLBPair.getAddress(),
        ethers.ZeroAddress,
        false
      );
      
      const feed = await hybridPriceLens.getPriceFeed(await mockUSDC.getAddress());
      expect(feed.lbPair).to.equal(await mockLBPair.getAddress());
      expect(feed.isTokenX).to.be.false;
      expect(feed.useExternal).to.be.false;
    });

    it("Should only allow owner to configure routes", async function () {
      await expect(
        hybridPriceLens.connect(user).setLBPairRoute(
          await mockUSDC.getAddress(),
          await mockLBPair.getAddress(),
          ethers.ZeroAddress,
          false
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Real-world Scenario: Sonic Mainnet USDC", function () {
    it("Should handle 6-decimal USDC vs 18-decimal wS correctly", async function () {
      // Simulate realistic Sonic mainnet scenario
      await mockLBPair.setTokens(await mockWS.getAddress(), await mockUSDC.getAddress());
      
      await hybridPriceLens.setReferenceToken(await mockUSDC.getAddress(), true);
      await hybridPriceLens.setLBPairRoute(
        await mockUSDC.getAddress(),
        await mockLBPair.getAddress(),
        ethers.ZeroAddress,
        false // USDC is tokenY
      );
      
      // Set a realistic 1:1 price ratio using decimal-aware formula
      const targetPrice = ethers.parseEther("1");
      const binPrice = (10n**6n << 128n) / targetPrice; // Formula for USDC (6 decimals)
      await mockLBPair.setPrice(8388608, binPrice);
      
      const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
      
      // Price should be close to 1 wS per USDC
      expect(price).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.1"));
      expect(Number(ethers.formatEther(price))).to.be.greaterThan(0.1);
      expect(Number(ethers.formatEther(price))).to.be.lessThan(10);
    });
  });
});