import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { HybridPriceLens, MockERC20, MockLBPair } from "../typechain-types";

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
        // Mock bin price for 1:1 ratio
        // For 1 USDC = 1 wS, with USDC as tokenY (6 decimals) and wS as tokenX (18 decimals)
        // binPrice = tokenX/tokenY = wS/USDC
        // We want: price = USDC/wS = 1
        // Since USDC is tokenY, we invert: (10^18 << 128) / binPrice
        // So: 1 = (10^18 << 128) / binPrice
        // Therefore: binPrice = 10^18 << 128 = 10^18 * 2^128
        
        const targetPrice = ethers.parseEther("1"); // 1 wS per USDC
        const binPrice = (ethers.parseEther("1") << 128n); // 1 wS/USDC in 128.128 format
        await mockLBPair.setPrice(8388608, binPrice); // activeId, binPrice
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.closeTo(targetPrice, ethers.parseEther("0.01")); // 1% tolerance
      });

      it("Should calculate correct price when 1 USDC = 0.5 wS", async function () {
        // For 0.5 wS per USDC
        // binPrice = wS/USDC = 0.5 in 128.128 format
        const binPrice = (ethers.parseEther("0.5") << 128n);
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        const expectedPrice = ethers.parseEther("0.5");
        expect(price).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      });

      it("Should calculate correct price when 1 USDC = 2 wS", async function () {
        // For 2 wS per USDC
        const binPrice = (ethers.parseEther("2") << 128n);
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        const expectedPrice = ethers.parseEther("2");
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
        // binPrice = tokenX/tokenY = WETH/wS = 1/3000 in 128.128 format
        const binPrice = (ethers.parseEther("1") << 128n) / 3000n;
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockWETH.getAddress());
        const expectedPrice = ethers.parseEther("3000");
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
        // 0.000001 wS per USDC
        const binPrice = (ethers.parseEther("0.000001") << 128n);
        await mockLBPair.setPrice(8388608, binPrice);
        
        const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
        expect(price).to.be.gte(ethers.parseEther("0.000001")); // Above MIN_PRICE
      });

      it("Should handle very large prices", async function () {
        // 1000 wS per USDC
        const binPrice = (ethers.parseEther("1000") << 128n);
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
      ).to.be.revertedWith("PriceLens__InvalidPrice");
    });

    it("Should revert for prices above maximum", async function () {
      // Set extremely large price that would be above MAX_PRICE (1e36)
      const hugePrice = ethers.parseEther("1000000000000000000") << 128n; 
      await mockLBPair.setPrice(8388608, hugePrice);
      
      await expect(
        hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress())
      ).to.be.revertedWith("PriceLens__InvalidPrice");
    });
  });

  describe("Configuration", function () {
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
      
      // Set a realistic 1:1 price ratio
      // binPrice should represent wS/USDC accounting for decimals
      const binPrice = (ethers.parseEther("1") << 128n);
      await mockLBPair.setPrice(8388608, binPrice);
      
      const price = await hybridPriceLens.getTokenPriceNative(await mockUSDC.getAddress());
      
      // Price should be close to 1 wS per USDC
      expect(price).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.1"));
      expect(Number(ethers.formatEther(price))).to.be.greaterThan(0.1);
      expect(Number(ethers.formatEther(price))).to.be.lessThan(10);
    });
  });
});