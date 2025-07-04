import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import type { Contract } from "ethers";
import type {
  ArcaVaultRegistry,
  MockERC20,
  ArcaTestnetV1,
  ArcaRewardClaimerV1,
  ArcaQueueHandlerV1,
  ArcaFeeManagerV1,
  MockLBRouter,
  MockLBPair,
  MockLBHooksBaseRewarder
} from "../typechain-types";

describe("Arbitrary Token Pairs Integration Testing", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  
  let registry: ArcaVaultRegistry;
  
  // Mock infrastructure
  let mockRouter: MockLBRouter;
  let mockPair: MockLBPair;
  let mockRewarder: MockLBHooksBaseRewarder;
  let metroToken: MockERC20;
  
  // Supporting contract beacons
  let feeManagerBeacon: Contract;
  let queueHandlerBeacon: Contract;

  interface TokenPairConfig {
    tokenX: {
      name: string;
      symbol: string;
      decimals: number;
    };
    tokenY: {
      name: string;
      symbol: string;
      decimals: number;
    };
    vaultName: string;
    vaultSymbol: string;
  }

  interface DeployedTokenPair {
    tokenX: MockERC20;
    tokenY: MockERC20;
    vault: ArcaTestnetV1;
    rewardClaimer: ArcaRewardClaimerV1;
    queueHandler: ArcaQueueHandlerV1;
    feeManager: ArcaFeeManagerV1;
    config: TokenPairConfig;
  }

  async function deployArbitraryTokenEcosystem() {
    [owner, user1, user2, feeRecipient] = await hre.ethers.getSigners();
    
    // Deploy registry
    const Registry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
    
    // Deploy mock infrastructure
    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouter.deploy();
    
    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    mockPair = await MockLBPair.deploy();
    
    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    mockRewarder = await MockRewarder.deploy();
    
    // Deploy METRO token
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    metroToken = await MockERC20.deploy("METRO", "METRO", 18, owner.address);
    
    // Deploy beacons for supporting contracts
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandler);
    
    // Define diverse token pair configurations
    const tokenPairConfigs: TokenPairConfig[] = [
      // Standard stablecoins with different decimals
      {
        tokenX: { name: "USD Coin", symbol: "USDC", decimals: 6 },
        tokenY: { name: "Tether USD", symbol: "USDT", decimals: 6 },
        vaultName: "USDC/USDT Stable Vault",
        vaultSymbol: "ARCA-USDC-USDT"
      },
      // High-decimal vs low-decimal token
      {
        tokenX: { name: "High Precision Token", symbol: "HPT", decimals: 24 },
        tokenY: { name: "Low Precision Token", symbol: "LPT", decimals: 2 },
        vaultName: "HPT/LPT Precision Vault",
        vaultSymbol: "ARCA-HPT-LPT"
      },
      // Custom protocol tokens
      {
        tokenX: { name: "DeFi Protocol A", symbol: "DEFIA", decimals: 18 },
        tokenY: { name: "DeFi Protocol B", symbol: "DEFIB", decimals: 18 },
        vaultName: "DeFi Protocols Vault",
        vaultSymbol: "ARCA-DEFI-AB"
      },
      // Gaming and metaverse tokens
      {
        tokenX: { name: "Gaming Token", symbol: "GAME", decimals: 18 },
        tokenY: { name: "Metaverse Land", symbol: "LAND", decimals: 12 },
        vaultName: "Gaming/Metaverse Vault",
        vaultSymbol: "ARCA-GAME-LAND"
      },
      // Unusual decimal combinations
      {
        tokenX: { name: "Weird Token X", symbol: "WEIRDX", decimals: 8 },
        tokenY: { name: "Weird Token Y", symbol: "WEIRDY", decimals: 15 },
        vaultName: "Experimental Vault",
        vaultSymbol: "ARCA-WEIRD-XY"
      },
      // Real-world asset tokens
      {
        tokenX: { name: "Tokenized Gold", symbol: "TGOLD", decimals: 8 },
        tokenY: { name: "Tokenized Silver", symbol: "TSILVER", decimals: 6 },
        vaultName: "Precious Metals Vault",
        vaultSymbol: "ARCA-GOLD-SILVER"
      }
    ];
    
    // Deploy all token pairs and their vaults
    const deployedPairs: DeployedTokenPair[] = [];
    
    for (let i = 0; i < tokenPairConfigs.length; i++) {
      const config = tokenPairConfigs[i];
      const pair = await deployTokenPairVault(config, i + 1);
      deployedPairs.push(pair);
    }
    
    return {
      registry,
      deployedPairs,
      infrastructure: { mockRouter, mockPair, mockRewarder, metroToken },
      accounts: { owner, user1, user2, feeRecipient }
    };
  }

  async function deployTokenPairVault(
    config: TokenPairConfig, 
    deploymentId: number
  ): Promise<DeployedTokenPair> {
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    
    // Deploy the two tokens with specified configurations
    const tokenX = await MockERC20.deploy(
      config.tokenX.name,
      config.tokenX.symbol,
      config.tokenX.decimals,
      owner.address
    );
    await tokenX.waitForDeployment();
    
    const tokenY = await MockERC20.deploy(
      config.tokenY.name,
      config.tokenY.symbol,
      config.tokenY.decimals,
      owner.address
    );
    await tokenY.waitForDeployment();
    
    // Deploy supporting contracts
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManager = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManager,
      [feeRecipient.address]
    );
    await feeManager.waitForDeployment();
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandler = await hre.upgrades.deployBeaconProxy(
      queueHandlerBeacon,
      QueueHandler,
      []
    );
    await queueHandler.waitForDeployment();
    
    const RewardClaimer = await hre.ethers.getContractFactory("ArcaRewardClaimerV1");
    const rewardClaimer = await hre.upgrades.deployProxy(
      RewardClaimer,
      [
        mockRewarder.target,
        metroToken.target,
        feeManager.target,
        tokenX.target, // native token
        mockPair.target,
        mockPair.target, // lpAMM
        mockPair.target, // lbpContractUSD
        mockRouter.target,
        5, // idSlippage
        tokenX.target,
        tokenY.target
      ],
      { kind: 'uups' }
    );
    await rewardClaimer.waitForDeployment();
    
    // Deploy vault with dynamic min amounts based on token decimals
    const decimalsX = config.tokenX.decimals;
    const decimalsY = config.tokenY.decimals;
    
    const amountXMin = hre.ethers.parseUnits("1", Math.max(0, decimalsX - 2)); // 0.01 tokens
    const amountYMin = hre.ethers.parseUnits("1", Math.max(0, decimalsY - 2)); // 0.01 tokens
    
    const Vault = await hre.ethers.getContractFactory("ArcaTestnetV1");
    const vault = await hre.upgrades.deployProxy(
      Vault,
      [
        tokenX.target,
        tokenY.target,
        25, // binStep
        amountXMin,
        amountYMin,
        mockRouter.target,
        mockPair.target, // lbpAMM
        mockPair.target, // lbpContract
        rewardClaimer.target,
        queueHandler.target,
        feeManager.target
      ],
      { kind: 'uups' }
    );
    await vault.waitForDeployment();
    
    // Transfer ownership of supporting contracts to vault (like production deployment)
    await queueHandler.transferOwnership(vault.target);
    await feeManager.transferOwnership(vault.target);
    await rewardClaimer.transferOwnership(vault.target);
    
    // Register vault with registry
    await registry.registerVault(
      vault.target,
      rewardClaimer.target,
      queueHandler.target,
      feeManager.target,
      tokenX.target,
      tokenY.target,
      config.vaultName,
      config.vaultSymbol,
      deploymentId,
      false // isProxy
    );
    
    return {
      tokenX: tokenX as MockERC20,
      tokenY: tokenY as MockERC20,
      vault: vault as ArcaTestnetV1,
      rewardClaimer: rewardClaimer as ArcaRewardClaimerV1,
      queueHandler: queueHandler as ArcaQueueHandlerV1,
      feeManager: feeManager as ArcaFeeManagerV1,
      config
    };
  }

  describe("Token Flexibility and Compatibility", function () {
    it("should support tokens with different decimal configurations", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Verify all vaults are registered
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(6);
      
      // Test each token pair configuration
      for (const pair of deployedPairs) {
        const vaultInfo = await registry.vaultInfo(pair.vault.target);
        
        // Verify vault registration
        expect(vaultInfo.vault).to.equal(pair.vault.target);
        expect(vaultInfo.name).to.equal(pair.config.vaultName);
        expect(vaultInfo.symbol).to.equal(pair.config.vaultSymbol);
        expect(vaultInfo.tokenX).to.equal(pair.tokenX.target);
        expect(vaultInfo.tokenY).to.equal(pair.tokenY.target);
        
        // Verify token properties
        expect(await pair.tokenX.name()).to.equal(pair.config.tokenX.name);
        expect(await pair.tokenX.symbol()).to.equal(pair.config.tokenX.symbol);
        expect(await pair.tokenX.decimals()).to.equal(pair.config.tokenX.decimals);
        
        expect(await pair.tokenY.name()).to.equal(pair.config.tokenY.name);
        expect(await pair.tokenY.symbol()).to.equal(pair.config.tokenY.symbol);
        expect(await pair.tokenY.decimals()).to.equal(pair.config.tokenY.decimals);
      }
    });

    it("should handle extreme decimal differences", async function () {
      const { deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Find the high precision (24 decimals) vs low precision (2 decimals) pair
      const extremePair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "HPT" && pair.config.tokenY.symbol === "LPT"
      );
      
      expect(extremePair).to.not.be.undefined;
      expect(await extremePair!.tokenX.decimals()).to.equal(24);
      expect(await extremePair!.tokenY.decimals()).to.equal(2);
      
      // Verify vault handles these tokens correctly
      const TokenX = 0;
      const TokenY = 1;
      
      // Mock some token amounts for deposit testing
      const highPrecisionAmount = hre.ethers.parseUnits("1000", 24); // 1000 HPT
      const lowPrecisionAmount = hre.ethers.parseUnits("50", 2); // 50 LPT
      
      // Mint tokens to user for testing
      await extremePair!.tokenX.mint(user1.address, highPrecisionAmount);
      await extremePair!.tokenY.mint(user1.address, lowPrecisionAmount);
      
      // Verify balances
      expect(await extremePair!.tokenX.balanceOf(user1.address)).to.equal(highPrecisionAmount);
      expect(await extremePair!.tokenY.balanceOf(user1.address)).to.equal(lowPrecisionAmount);
    });

    it("should support custom protocol and gaming tokens", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Find gaming/metaverse pair
      const gamingPair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "GAME"
      );
      
      // Find DeFi protocols pair
      const defiPair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "DEFIA"
      );
      
      expect(gamingPair).to.not.be.undefined;
      expect(defiPair).to.not.be.undefined;
      
      // Verify both are discoverable via registry
      const gameVaults = await registry.getVaultsByTokenPair(
        gamingPair!.tokenX.target,
        gamingPair!.tokenY.target
      );
      expect(gameVaults).to.have.length(1);
      
      const defiVaults = await registry.getVaultsByTokenPair(
        defiPair!.tokenX.target,
        defiPair!.tokenY.target
      );
      expect(defiVaults).to.have.length(1);
      
      // Verify metadata is correctly stored
      const gameVaultInfo = await registry.vaultInfo(gamingPair!.vault.target);
      expect(gameVaultInfo.name).to.equal("Gaming/Metaverse Vault");
      
      const defiVaultInfo = await registry.vaultInfo(defiPair!.vault.target);
      expect(defiVaultInfo.name).to.equal("DeFi Protocols Vault");
    });

    it("should handle real-world asset tokenization scenarios", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Find precious metals pair
      const metalsPair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "TGOLD"
      );
      
      expect(metalsPair).to.not.be.undefined;
      
      // Verify tokenized assets have appropriate decimals
      expect(await metalsPair!.tokenX.decimals()).to.equal(8); // Gold (like Bitcoin)
      expect(await metalsPair!.tokenY.decimals()).to.equal(6); // Silver (like USDC)
      
      // Verify vault registration
      const metalVaults = await registry.getVaultsByTokenPair(
        metalsPair!.tokenX.target,
        metalsPair!.tokenY.target
      );
      expect(metalVaults).to.have.length(1);
      
      const vaultInfo = await registry.vaultInfo(metalsPair!.vault.target);
      expect(vaultInfo.name).to.equal("Precious Metals Vault");
    });
  });

  describe("Registry Token Pair Management", function () {
    it("should correctly hash and store diverse token pairs", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Test that each token pair hash is unique
      const tokenPairHashes = new Set<string>();
      
      for (const pair of deployedPairs) {
        const tokenX = pair.tokenX.target;
        const tokenY = pair.tokenY.target;
        
        // Manually compute the hash the same way the contract does
        const pairHash = hre.ethers.keccak256(
          hre.ethers.solidityPacked(["address", "address"], [tokenX, tokenY])
        );
        
        // Verify no hash collisions
        expect(tokenPairHashes.has(pairHash)).to.equal(false);;
        tokenPairHashes.add(pairHash);
        
        // Verify registry can find vault by token pair
        const vaultsForPair = await registry.getVaultsByTokenPair(tokenX, tokenY);
        expect(vaultsForPair).to.have.length(1);
        expect(vaultsForPair[0]).to.equal(pair.vault.target);
      }
      
      // Verify we have 6 unique hashes
      expect(tokenPairHashes.size).to.equal(6);
    });

    it("should handle token address ordering consistently", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Test both directions of token pair queries
      for (const pair of deployedPairs) {
        const tokenX = pair.tokenX.target;
        const tokenY = pair.tokenY.target;
        
        // Query in original order
        const vaultsXY = await registry.getVaultsByTokenPair(tokenX, tokenY);
        
        // Query in reverse order
        const vaultsYX = await registry.getVaultsByTokenPair(tokenY, tokenX);
        
        // Current implementation stores based on exact order
        // So reverse order should return empty unless there's a reverse vault
        expect(vaultsXY).to.have.length(1);
        expect(vaultsYX).to.have.length(0); // No reverse pair vault deployed
      }
    });
  });

  describe("Vault Operations with Arbitrary Tokens", function () {
    it("should support deposit operations with different decimal tokens", async function () {
      const { deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Test with the 6-decimal stablecoin pair
      const stablePair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "USDC" && pair.config.tokenY.symbol === "USDT"
      );
      
      expect(stablePair).to.not.be.undefined;
      
      // Mint tokens to user
      const usdcAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDC
      const usdtAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDT
      
      await stablePair!.tokenX.mint(user1.address, usdcAmount);
      await stablePair!.tokenY.mint(user1.address, usdtAmount);
      
      // Approve vault for spending
      await stablePair!.tokenX.connect(user1).approve(stablePair!.vault.target, usdcAmount);
      await stablePair!.tokenY.connect(user1).approve(stablePair!.vault.target, usdtAmount);
      
      // Test deposit functionality
      const TokenX = 0;
      const depositAmountX = hre.ethers.parseUnits("100", 6); // 100 USDC
      
      await stablePair!.vault.connect(user1).depositToken(depositAmountX, TokenX);
      
      // Verify deposit was processed - check user's token balance was reduced
      const remainingBalance = await stablePair!.tokenX.balanceOf(user1.address);
      const expectedRemaining = usdcAmount - depositAmountX;
      expect(remainingBalance).to.equal(expectedRemaining);
    });

    it("should handle precision-sensitive operations", async function () {
      const { deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Test with unusual decimal pair (8 and 15 decimals)
      const weirdPair = deployedPairs.find(pair => 
        pair.config.tokenX.symbol === "WEIRDX"
      );
      
      expect(weirdPair).to.not.be.undefined;
      expect(await weirdPair!.tokenX.decimals()).to.equal(8);
      expect(await weirdPair!.tokenY.decimals()).to.equal(15);
      
      // Test small amounts that might cause precision issues
      const smallAmountX = hre.ethers.parseUnits("0.00000001", 8); // 1 satoshi equivalent
      const smallAmountY = hre.ethers.parseUnits("0.000000000000001", 15); // 1 femto unit
      
      // Mint minimal amounts
      await weirdPair!.tokenX.mint(user1.address, smallAmountX);
      await weirdPair!.tokenY.mint(user1.address, smallAmountY);
      
      // Verify balances are correct
      expect(await weirdPair!.tokenX.balanceOf(user1.address)).to.equal(smallAmountX);
      expect(await weirdPair!.tokenY.balanceOf(user1.address)).to.equal(smallAmountY);
    });
  });

  describe("Edge Cases and Stress Testing", function () {
    it("should handle zero-value token queries gracefully", async function () {
      const { registry } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Test with zero addresses
      const zeroResults = await registry.getVaultsByTokenPair(
        hre.ethers.ZeroAddress,
        hre.ethers.ZeroAddress
      );
      expect(zeroResults).to.have.length(0);
      
      // Test with one zero address
      const { deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      const partialZeroResults = await registry.getVaultsByTokenPair(
        deployedPairs[0].tokenX.target,
        hre.ethers.ZeroAddress
      );
      expect(partialZeroResults).to.have.length(0);
    });

    it("should demonstrate scalability with diverse token ecosystem", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Verify ecosystem statistics
      expect(deployedPairs).to.have.length(6);
      
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(6);
      
      // Collect all unique tokens across the ecosystem
      const allTokens = new Set<string>();
      for (const pair of deployedPairs) {
        allTokens.add(pair.tokenX.target.toLowerCase());
        allTokens.add(pair.tokenY.target.toLowerCase());
      }
      
      // Verify we have 12 unique tokens (6 pairs * 2 tokens each)
      expect(allTokens.size).to.equal(12);
      
      // Verify each vault is independently manageable
      for (let i = 0; i < 3; i++) {
        await registry.deactivateVault(deployedPairs[i].vault.target, `Test ${i}`);
      }
      
      const remainingActive = await registry.getActiveVaults();
      expect(remainingActive).to.have.length(3);
      
      // Verify total count unchanged
      const totalCount = await registry.getVaultCount();
      expect(totalCount).to.equal(6);
    });
  });

  describe("Business Requirements Validation", function () {
    it("should prove arbitrary token pair support requirement", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Document: The system supports unlimited token pairs
      const supportedPairTypes = [
        "Stablecoins (USDC/USDT)",
        "High/Low Precision Tokens (24/2 decimals)",
        "DeFi Protocol Tokens",
        "Gaming/Metaverse Tokens",
        "Experimental Token Combinations",
        "Real-World Asset Tokens"
      ];
      
      expect(deployedPairs).to.have.length(supportedPairTypes.length);
      
      // Verify each type is represented
      const vaultNames = deployedPairs.map(pair => pair.config.vaultName);
      expect(vaultNames).to.include.members([
        "USDC/USDT Stable Vault",
        "HPT/LPT Precision Vault",
        "DeFi Protocols Vault",
        "Gaming/Metaverse Vault",
        "Experimental Vault",
        "Precious Metals Vault"
      ]);
      
      // Verify all are discoverable through registry
      for (const pair of deployedPairs) {
        const vaults = await registry.getVaultsByTokenPair(
          pair.tokenX.target,
          pair.tokenY.target
        );
        expect(vaults).to.have.length(1);
        expect(vaults[0]).to.equal(pair.vault.target);
      }
    });

    it("should demonstrate registry-driven discovery pattern", async function () {
      const { registry, deployedPairs } = await loadFixture(deployArbitraryTokenEcosystem);
      
      // Pattern 1: Discover all vaults
      const allVaults = await registry.getActiveVaults();
      expect(allVaults).to.have.length(6);
      
      // Pattern 2: Get detailed info for each vault
      const vaultInfos = [];
      for (const vaultAddress of allVaults) {
        const info = await registry.vaultInfo(vaultAddress);
        vaultInfos.push({
          address: vaultAddress,
          name: info.name,
          symbol: info.symbol,
          tokenX: info.tokenX,
          tokenY: info.tokenY,
          isActive: info.isActive
        });
      }
      
      expect(vaultInfos).to.have.length(6);
      
      // Pattern 3: Filter by specific criteria
      const stableVaults = vaultInfos.filter(info => 
        info.name.includes("Stable") || info.name.includes("USDC")
      );
      expect(stableVaults).to.have.length(1);
      
      // Pattern 4: Dynamic vault selection based on token addresses
      // This simulates how UI would work with user-selected tokens
      const userSelectedTokenX = deployedPairs[2].tokenX.target; // DEFIA
      const userSelectedTokenY = deployedPairs[2].tokenY.target; // DEFIB
      
      const matchingVaults = await registry.getVaultsByTokenPair(
        userSelectedTokenX,
        userSelectedTokenY
      );
      expect(matchingVaults).to.have.length(1);
      
      const matchedVaultInfo = await registry.vaultInfo(matchingVaults[0]);
      expect(matchedVaultInfo.name).to.equal("DeFi Protocols Vault");
    });
  });
});