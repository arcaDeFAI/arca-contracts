import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
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

describe("ArcaVaultRegistry - Core Registry Testing", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  
  let registry: ArcaVaultRegistry;
  
  // Test tokens for multiple vaults
  let tokenX1: MockERC20, tokenY1: MockERC20; // First vault pair
  let tokenX2: MockERC20, tokenY2: MockERC20; // Second vault pair  
  let tokenX3: MockERC20, tokenY3: MockERC20; // Third vault pair
  let metroToken: MockERC20;
  
  // Mock infrastructure
  let mockRouter: MockLBRouter;
  let mockPair: MockLBPair;
  let mockRewarder: MockLBHooksBaseRewarder;
  
  // Supporting contracts (reused across vaults)
  let feeManagerBeacon: any;
  let queueHandlerBeacon: any;

  async function deployRegistryFixture() {
    [owner, user1, feeRecipient] = await hre.ethers.getSigners();
    
    // Deploy registry
    const Registry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
    
    // Deploy test tokens for multiple vault scenarios
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    
    // Vault 1: ETH/USDT pair
    tokenX1 = await MockERC20.deploy("Ethereum", "ETH", 18);
    tokenY1 = await MockERC20.deploy("Tether", "USDT", 6);
    
    // Vault 2: DAI/USDC pair  
    tokenX2 = await MockERC20.deploy("DAI Stablecoin", "DAI", 18);
    tokenY2 = await MockERC20.deploy("USD Coin", "USDC", 6);
    
    // Vault 3: LINK/WBTC pair
    tokenX3 = await MockERC20.deploy("Chainlink", "LINK", 18);
    tokenY3 = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    
    metroToken = await MockERC20.deploy("METRO", "METRO", 18);
    
    // Deploy mock infrastructure
    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouter.deploy();
    
    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    mockPair = await MockLBPair.deploy();
    
    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    mockRewarder = await MockRewarder.deploy();
    
    // Deploy beacons for supporting contracts (reused across vaults)
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandler);
    
    return {
      registry,
      tokens: {
        vault1: { tokenX: tokenX1, tokenY: tokenY1 },
        vault2: { tokenX: tokenX2, tokenY: tokenY2 },
        vault3: { tokenX: tokenX3, tokenY: tokenY3 },
        metro: metroToken
      },
      infrastructure: { mockRouter, mockPair, mockRewarder },
      beacons: { feeManagerBeacon, queueHandlerBeacon },
      accounts: { owner, user1, feeRecipient }
    };
  }

  async function deploySingleVault(
    tokenX: MockERC20,
    tokenY: MockERC20,
    name: string,
    symbol: string
  ): Promise<{
    vault: ArcaTestnetV1;
    rewardClaimer: ArcaRewardClaimerV1;
    queueHandler: ArcaQueueHandlerV1;
    feeManager: ArcaFeeManagerV1;
  }> {
    // Deploy supporting contracts for this vault
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
    
    // Deploy vault with correct parameters
    const Vault = await hre.ethers.getContractFactory("ArcaTestnetV1");
    const vault = await hre.upgrades.deployProxy(
      Vault,
      [
        tokenX.target,
        tokenY.target,
        25, // binStep
        hre.ethers.parseEther("0.01"), // amountXMin
        hre.ethers.parseEther("0.01"), // amountYMin
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
    
    return {
      vault: vault as ArcaTestnetV1,
      rewardClaimer: rewardClaimer as ArcaRewardClaimerV1,
      queueHandler: queueHandler as ArcaQueueHandlerV1,
      feeManager: feeManager as ArcaFeeManagerV1
    };
  }

  describe("Registry Deployment", function () {
    it("should deploy registry with correct initial state", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      
      expect(await registry.owner()).to.equal(owner.address);
      
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(0);
    });
  });

  describe("Vault Registration", function () {
    it("should register a single vault correctly", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      // Deploy a single vault
      const { vault, rewardClaimer, queueHandler, feeManager } = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      // Register vault
      await registry.registerVault(
        vault.target,
        rewardClaimer.target,
        queueHandler.target,
        feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1, // deploymentId
        false // isProxy
      );
      
      // Verify registration
      const isRegistered = await registry.isRegisteredVault(vault.target);
      expect(isRegistered).to.be.true;
      
      const vaultInfo = await registry.vaultInfo(vault.target);
      expect(vaultInfo.vault).to.equal(vault.target);
      expect(vaultInfo.name).to.equal("ETH/USDT Vault");
      expect(vaultInfo.symbol).to.equal("ARCA-ETH-USDT");
      expect(vaultInfo.isActive).to.be.true;
      
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);
      expect(activeVaults[0]).to.equal(vault.target);
    });

    it("should register multiple vaults with different token pairs", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      // Deploy three different vaults
      const vault1 = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      const vault2 = await deploySingleVault(
        tokens.vault2.tokenX,
        tokens.vault2.tokenY,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC"
      );
      
      const vault3 = await deploySingleVault(
        tokens.vault3.tokenX,
        tokens.vault3.tokenY,
        "LINK/WBTC Vault",
        "ARCA-LINK-WBTC"
      );
      
      // Register all vaults
      await registry.registerVault(
        vault1.vault.target,
        vault1.rewardClaimer.target,
        vault1.queueHandler.target,
        vault1.feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      await registry.registerVault(
        vault2.vault.target,
        vault2.rewardClaimer.target,
        vault2.queueHandler.target,
        vault2.feeManager.target,
        tokens.vault2.tokenX.target,
        tokens.vault2.tokenY.target,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC",
        2,
        false
      );
      
      await registry.registerVault(
        vault3.vault.target,
        vault3.rewardClaimer.target,
        vault3.queueHandler.target,
        vault3.feeManager.target,
        tokens.vault3.tokenX.target,
        tokens.vault3.tokenY.target,
        "LINK/WBTC Vault",
        "ARCA-LINK-WBTC",
        3,
        false
      );
      
      // Verify all vaults are registered and active
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(3);
      
      // Verify specific vault info
      const vault1Info = await registry.vaultInfo(vault1.vault.target);
      expect(vault1Info.tokenX).to.equal(tokens.vault1.tokenX.target);
      expect(vault1Info.tokenY).to.equal(tokens.vault1.tokenY.target);
      
      const vault2Info = await registry.vaultInfo(vault2.vault.target);
      expect(vault2Info.tokenX).to.equal(tokens.vault2.tokenX.target);
      expect(vault2Info.tokenY).to.equal(tokens.vault2.tokenY.target);
    });

    it("should prevent duplicate vault registration", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      const { vault, rewardClaimer, queueHandler, feeManager } = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      // Register vault once
      await registry.registerVault(
        vault.target,
        rewardClaimer.target,
        queueHandler.target,
        feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      // Attempt to register same vault again
      await expect(
        registry.registerVault(
          vault.target,
          rewardClaimer.target,
          queueHandler.target,
          feeManager.target,
          tokens.vault1.tokenX.target,
          tokens.vault1.tokenY.target,
          "ETH/USDT Vault",
          "ARCA-ETH-USDT",
          2,
          false
        )
      ).to.be.revertedWith("Vault already registered");
    });
  });

  describe("Vault Discovery", function () {
    it("should filter vaults by token pair", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      // Deploy and register multiple vaults
      const vault1 = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      const vault2 = await deploySingleVault(
        tokens.vault2.tokenX,
        tokens.vault2.tokenY,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC"
      );
      
      // Register vaults
      await registry.registerVault(
        vault1.vault.target,
        vault1.rewardClaimer.target,
        vault1.queueHandler.target,
        vault1.feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      await registry.registerVault(
        vault2.vault.target,
        vault2.rewardClaimer.target,
        vault2.queueHandler.target,
        vault2.feeManager.target,
        tokens.vault2.tokenX.target,
        tokens.vault2.tokenY.target,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC",
        2,
        false
      );
      
      // Test filtering by token pair
      const ethUsdtVaults = await registry.getVaultsByTokenPair(
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target
      );
      expect(ethUsdtVaults).to.have.length(1);
      expect(ethUsdtVaults[0]).to.equal(vault1.vault.target);
      
      const daiUsdcVaults = await registry.getVaultsByTokenPair(
        tokens.vault2.tokenX.target,
        tokens.vault2.tokenY.target
      );
      expect(daiUsdcVaults).to.have.length(1);
      expect(daiUsdcVaults[0]).to.equal(vault2.vault.target);
      
      // Test non-existent pair
      const nonExistentVaults = await registry.getVaultsByTokenPair(
        tokens.vault1.tokenX.target,
        tokens.vault3.tokenY.target
      );
      expect(nonExistentVaults).to.have.length(0);
    });

    it("should return correct vault count", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      // Initially no vaults
      expect(await registry.getVaultCount()).to.equal(0);
      
      // Deploy and register one vault
      const vault1 = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      await registry.registerVault(
        vault1.vault.target,
        vault1.rewardClaimer.target,
        vault1.queueHandler.target,
        vault1.feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      expect(await registry.getVaultCount()).to.equal(1);
      
      // Add second vault
      const vault2 = await deploySingleVault(
        tokens.vault2.tokenX,
        tokens.vault2.tokenY,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC"
      );
      
      await registry.registerVault(
        vault2.vault.target,
        vault2.rewardClaimer.target,
        vault2.queueHandler.target,
        vault2.feeManager.target,
        tokens.vault2.tokenX.target,
        tokens.vault2.tokenY.target,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC",
        2,
        false
      );
      
      expect(await registry.getVaultCount()).to.equal(2);
    });
  });

  describe("Vault Activation/Deactivation", function () {
    it("should deactivate and reactivate vaults correctly", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      const { vault, rewardClaimer, queueHandler, feeManager } = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      // Register vault
      await registry.registerVault(
        vault.target,
        rewardClaimer.target,
        queueHandler.target,
        feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      // Initially active
      let activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);
      
      // Deactivate vault
      await registry.deactivateVault(vault.target, "Emergency maintenance");
      
      activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(0);
      
      const vaultInfo = await registry.vaultInfo(vault.target);
      expect(vaultInfo.isActive).to.be.false;
      
      // Reactivate vault
      await registry.activateVault(vault.target);
      
      activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);
      
      const reactivatedVaultInfo = await registry.vaultInfo(vault.target);
      expect(reactivatedVaultInfo.isActive).to.be.true;
    });

    it("should handle partial deactivation of multiple vaults", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      // Deploy three vaults
      const vault1 = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      const vault2 = await deploySingleVault(
        tokens.vault2.tokenX,
        tokens.vault2.tokenY,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC"
      );
      
      const vault3 = await deploySingleVault(
        tokens.vault3.tokenX,
        tokens.vault3.tokenY,
        "LINK/WBTC Vault",
        "ARCA-LINK-WBTC"
      );
      
      // Register all vaults
      await registry.registerVault(
        vault1.vault.target,
        vault1.rewardClaimer.target,
        vault1.queueHandler.target,
        vault1.feeManager.target,
        tokens.vault1.tokenX.target,
        tokens.vault1.tokenY.target,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT",
        1,
        false
      );
      
      await registry.registerVault(
        vault2.vault.target,
        vault2.rewardClaimer.target,
        vault2.queueHandler.target,
        vault2.feeManager.target,
        tokens.vault2.tokenX.target,
        tokens.vault2.tokenY.target,
        "DAI/USDC Vault",
        "ARCA-DAI-USDC",
        2,
        false
      );
      
      await registry.registerVault(
        vault3.vault.target,
        vault3.rewardClaimer.target,
        vault3.queueHandler.target,
        vault3.feeManager.target,
        tokens.vault3.tokenX.target,
        tokens.vault3.tokenY.target,
        "LINK/WBTC Vault",
        "ARCA-LINK-WBTC",
        3,
        false
      );
      
      // All active initially
      let activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(3);
      
      // Deactivate middle vault
      await registry.deactivateVault(vault2.vault.target, "Temporary maintenance");
      
      activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(2);
      
      // Verify the right vaults are still active
      expect(activeVaults).to.include(vault1.vault.target);
      expect(activeVaults).to.include(vault3.vault.target);
      expect(activeVaults).to.not.include(vault2.vault.target);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("should reject registration from non-owner", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      const { vault, rewardClaimer, queueHandler, feeManager } = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      // Try to register from non-owner account
      await expect(
        registry.connect(user1).registerVault(
          vault.target,
          rewardClaimer.target,
          queueHandler.target,
          feeManager.target,
          tokens.vault1.tokenX.target,
          tokens.vault1.tokenY.target,
          "ETH/USDT Vault",
          "ARCA-ETH-USDT",
          1,
          false
        )
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should reject deactivation of unregistered vault", async function () {
      const { registry, tokens } = await loadFixture(deployRegistryFixture);
      
      const { vault } = await deploySingleVault(
        tokens.vault1.tokenX,
        tokens.vault1.tokenY,
        "ETH/USDT Vault",
        "ARCA-ETH-USDT"
      );
      
      // Try to deactivate unregistered vault
      await expect(
        registry.deactivateVault(vault.target, "Test")
      ).to.be.revertedWith("Vault not registered");
    });

    it("should handle zero address inputs gracefully", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      
      // Try to register vault with zero address
      await expect(
        registry.registerVault(
          hre.ethers.ZeroAddress,
          hre.ethers.ZeroAddress,
          hre.ethers.ZeroAddress,
          hre.ethers.ZeroAddress,
          hre.ethers.ZeroAddress,
          hre.ethers.ZeroAddress,
          "Invalid Vault",
          "INVALID",
          1,
          false
        )
      ).to.be.revertedWith("Invalid vault address");
    });
  });
});