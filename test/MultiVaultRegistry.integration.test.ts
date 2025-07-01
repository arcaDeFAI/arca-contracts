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

describe("Multi-Vault Registry Integration Testing", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  
  let registry: ArcaVaultRegistry;
  
  // Token ecosystem for 5 different vaults
  let tokens: {
    eth: MockERC20;
    usdt: MockERC20;
    dai: MockERC20;
    usdc: MockERC20;
    link: MockERC20;
    wbtc: MockERC20;
    matic: MockERC20;
    weth: MockERC20;
    metro: MockERC20;
  };
  
  // Mock infrastructure
  let mockRouter: MockLBRouter;
  let mockPair: MockLBPair;
  let mockRewarder: MockLBHooksBaseRewarder;
  
  // Supporting contract beacons
  let feeManagerBeacon: Contract;
  let queueHandlerBeacon: Contract;

  interface VaultSystem {
    vault: ArcaTestnetV1;
    rewardClaimer: ArcaRewardClaimerV1;
    queueHandler: ArcaQueueHandlerV1;
    feeManager: ArcaFeeManagerV1;
    tokenX: MockERC20;
    tokenY: MockERC20;
    name: string;
    symbol: string;
  }

  async function deployMultiVaultEcosystem() {
    [owner, user1, user2, feeRecipient] = await hre.ethers.getSigners();
    
    // Deploy registry
    const Registry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();
    
    // Deploy diverse token ecosystem
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    
    tokens = {
      eth: await MockERC20.deploy("Ethereum", "ETH", 18),
      usdt: await MockERC20.deploy("Tether USD", "USDT", 6),
      dai: await MockERC20.deploy("DAI Stablecoin", "DAI", 18),
      usdc: await MockERC20.deploy("USD Coin", "USDC", 6),
      link: await MockERC20.deploy("Chainlink", "LINK", 18),
      wbtc: await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8),
      matic: await MockERC20.deploy("Polygon", "MATIC", 18),
      weth: await MockERC20.deploy("Wrapped Ether", "WETH", 18),
      metro: await MockERC20.deploy("METRO", "METRO", 18)
    };
    
    // Deploy mock infrastructure
    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    mockRouter = await MockLBRouter.deploy();
    
    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    mockPair = await MockLBPair.deploy();
    
    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    mockRewarder = await MockRewarder.deploy();
    
    // Deploy beacons for supporting contracts
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);
    
    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandler);
    
    // Deploy 5 vaults with different token pairs
    const vaultConfigs = [
      { tokenX: tokens.eth, tokenY: tokens.usdt, name: "ETH/USDT Vault", symbol: "ARCA-ETH-USDT" },
      { tokenX: tokens.dai, tokenY: tokens.usdc, name: "DAI/USDC Vault", symbol: "ARCA-DAI-USDC" },
      { tokenX: tokens.link, tokenY: tokens.wbtc, name: "LINK/WBTC Vault", symbol: "ARCA-LINK-WBTC" },
      { tokenX: tokens.matic, tokenY: tokens.weth, name: "MATIC/WETH Vault", symbol: "ARCA-MATIC-WETH" },
      { tokenX: tokens.wbtc, tokenY: tokens.eth, name: "WBTC/ETH Vault", symbol: "ARCA-WBTC-ETH" }
    ];
    
    const vaults: VaultSystem[] = [];
    
    for (let i = 0; i < vaultConfigs.length; i++) {
      const config = vaultConfigs[i];
      const vaultSystem = await deployVaultSystem(
        config.tokenX,
        config.tokenY,
        config.name,
        config.symbol,
        i + 1 // deploymentId
      );
      vaults.push({
        ...vaultSystem,
        tokenX: config.tokenX,
        tokenY: config.tokenY,
        name: config.name,
        symbol: config.symbol
      });
    }
    
    return {
      registry,
      tokens,
      vaults,
      infrastructure: { mockRouter, mockPair, mockRewarder },
      accounts: { owner, user1, user2, feeRecipient }
    };
  }

  async function deployVaultSystem(
    tokenX: MockERC20,
    tokenY: MockERC20,
    name: string,
    symbol: string,
    deploymentId: number
  ): Promise<{
    vault: ArcaTestnetV1;
    rewardClaimer: ArcaRewardClaimerV1;
    queueHandler: ArcaQueueHandlerV1;
    feeManager: ArcaFeeManagerV1;
  }> {
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
        tokens.metro.target,
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
    
    // Deploy vault
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
    
    // Register vault with registry
    await registry.registerVault(
      vault.target,
      rewardClaimer.target,
      queueHandler.target,
      feeManager.target,
      tokenX.target,
      tokenY.target,
      name,
      symbol,
      deploymentId,
      false // isProxy
    );
    
    return {
      vault: vault as ArcaTestnetV1,
      rewardClaimer: rewardClaimer as ArcaRewardClaimerV1,
      queueHandler: queueHandler as ArcaQueueHandlerV1,
      feeManager: feeManager as ArcaFeeManagerV1
    };
  }

  describe("Multi-Vault Ecosystem", function () {
    it("should deploy and register 5 vaults with different token pairs", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Verify all vaults are registered
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(5);
      
      // Verify each vault is correctly registered
      for (let i = 0; i < vaults.length; i++) {
        const vault = vaults[i];
        const isRegistered = await registry.isRegisteredVault(vault.vault.target);
        expect(isRegistered).to.equal(true);;
        
        const vaultInfo = await registry.vaultInfo(vault.vault.target);
        expect(vaultInfo.name).to.equal(vault.name);
        expect(vaultInfo.symbol).to.equal(vault.symbol);
        expect(vaultInfo.tokenX).to.equal(vault.tokenX.target);
        expect(vaultInfo.tokenY).to.equal(vault.tokenY.target);
        expect(vaultInfo.isActive).to.equal(true);;
      }
    });

    it("should correctly filter vaults by specific token pairs", async function () {
      const { registry, vaults, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Test ETH/USDT pair filtering
      const ethUsdtVaults = await registry.getVaultsByTokenPair(
        tokens.eth.target,
        tokens.usdt.target
      );
      expect(ethUsdtVaults).to.have.length(1);
      expect(ethUsdtVaults[0]).to.equal(vaults[0].vault.target); // First vault is ETH/USDT
      
      // Test DAI/USDC pair filtering
      const daiUsdcVaults = await registry.getVaultsByTokenPair(
        tokens.dai.target,
        tokens.usdc.target
      );
      expect(daiUsdcVaults).to.have.length(1);
      expect(daiUsdcVaults[0]).to.equal(vaults[1].vault.target); // Second vault is DAI/USDC
      
      // Test WBTC presence in multiple vaults
      const wbtcLinkVaults = await registry.getVaultsByTokenPair(
        tokens.link.target,
        tokens.wbtc.target
      );
      expect(wbtcLinkVaults).to.have.length(1);
      
      const wbtcEthVaults = await registry.getVaultsByTokenPair(
        tokens.wbtc.target,
        tokens.eth.target
      );
      expect(wbtcEthVaults).to.have.length(1);
      
      // Test non-existent pair
      const nonExistentPair = await registry.getVaultsByTokenPair(
        tokens.dai.target,
        tokens.wbtc.target
      );
      expect(nonExistentPair).to.have.length(0);
    });

    it("should maintain independence between vaults", async function () {
      const { registry, vaults, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deactivate middle vault (DAI/USDC)
      await registry.deactivateVault(vaults[1].vault.target, "Testing independence");
      
      // Verify other vaults remain active
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(4);
      
      // Verify deactivated vault is not in active list
      expect(activeVaults).to.not.include(vaults[1].vault.target);
      
      // Verify other specific vaults are still active
      expect(activeVaults).to.include(vaults[0].vault.target); // ETH/USDT
      expect(activeVaults).to.include(vaults[2].vault.target); // LINK/WBTC
      expect(activeVaults).to.include(vaults[3].vault.target); // MATIC/WETH
      expect(activeVaults).to.include(vaults[4].vault.target); // WBTC/ETH
      
      // Verify deactivated vault still exists in registry but inactive
      const daiUsdcInfo = await registry.vaultInfo(vaults[1].vault.target);
      expect(daiUsdcInfo.isActive).to.equal(false);;
      expect(daiUsdcInfo.name).to.equal("DAI/USDC Vault");
      
      // Reactivate and verify
      await registry.activateVault(vaults[1].vault.target);
      const reactivatedVaults = await registry.getActiveVaults();
      expect(reactivatedVaults).to.have.length(5);
    });

    it("should handle complex token pair queries", async function () {
      const { registry, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Test all unique token addresses appear in the registry
      const allActiveVaults = await registry.getActiveVaults();
      const vaultInfos = [];
      
      for (const vaultAddress of allActiveVaults) {
        const info = await registry.vaultInfo(vaultAddress);
        vaultInfos.push(info);
      }
      
      // Extract all unique tokens used in vaults
      const tokensInVaults = new Set<string>();
      vaultInfos.forEach(info => {
        tokensInVaults.add(info.tokenX.toLowerCase());
        tokensInVaults.add(info.tokenY.toLowerCase());
      });
      
      // Verify we have the expected tokens in our vault ecosystem
      const expectedTokens = [
        tokens.eth.target.toLowerCase(),
        tokens.usdt.target.toLowerCase(),
        tokens.dai.target.toLowerCase(),
        tokens.usdc.target.toLowerCase(),
        tokens.link.target.toLowerCase(),
        tokens.wbtc.target.toLowerCase(),
        tokens.matic.target.toLowerCase(),
        tokens.weth.target.toLowerCase()
      ];
      
      expectedTokens.forEach(token => {
        expect(tokensInVaults.has(token)).to.equal(true);;
      });
    });

    it("should support vault discovery patterns", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Pattern 1: Get all vaults and iterate
      const allVaults = await registry.getActiveVaults();
      expect(allVaults).to.have.length(5);
      
      // Pattern 2: Get vault count for pagination
      const vaultCount = await registry.getVaultCount();
      expect(vaultCount).to.equal(5);
      
      // Pattern 3: Verify each vault has unique address
      const uniqueAddresses = new Set(allVaults.map(addr => addr.toLowerCase()));
      expect(uniqueAddresses.size).to.equal(5);
      
      // Pattern 4: Verify vault info retrieval works for all
      for (const vaultAddress of allVaults) {
        const info = await registry.vaultInfo(vaultAddress);
        expect(info.vault).to.equal(vaultAddress);
        expect(info.isActive).to.equal(true);;
        expect(info.name).to.not.be.empty;
        expect(info.symbol).to.not.be.empty;
      }
    });
  });

  describe("Vault Lifecycle Management", function () {
    it("should handle adding vaults to existing ecosystem", async function () {
      const { registry, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Initially 5 vaults
      let activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(5);
      
      // Add a 6th vault with new token pair
      const newVault = await deployVaultSystem(
        tokens.usdc,
        tokens.matic,
        "USDC/MATIC Vault",
        "ARCA-USDC-MATIC",
        6 // deploymentId
      );
      
      // Verify 6 vaults now
      activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(6);
      
      // Verify new vault is discoverable by token pair
      const usdcMaticVaults = await registry.getVaultsByTokenPair(
        tokens.usdc.target,
        tokens.matic.target
      );
      expect(usdcMaticVaults).to.have.length(1);
      expect(usdcMaticVaults[0]).to.equal(newVault.vault.target);
    });

    it("should handle batch vault deactivation", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deactivate first 3 vaults
      await registry.deactivateVault(vaults[0].vault.target, "Batch deactivation 1");
      await registry.deactivateVault(vaults[1].vault.target, "Batch deactivation 2");
      await registry.deactivateVault(vaults[2].vault.target, "Batch deactivation 3");
      
      // Verify only 2 remain active
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(2);
      
      // Verify the right vaults remain
      expect(activeVaults).to.include(vaults[3].vault.target); // MATIC/WETH
      expect(activeVaults).to.include(vaults[4].vault.target); // WBTC/ETH
      
      // Verify total count unchanged (includes inactive)
      const totalCount = await registry.getVaultCount();
      expect(totalCount).to.equal(5);
      
      // Reactivate one vault
      await registry.activateVault(vaults[1].vault.target);
      const reactivatedVaults = await registry.getActiveVaults();
      expect(reactivatedVaults).to.have.length(3);
    });
  });

  describe("Registry Performance and Scalability", function () {
    it("should efficiently handle vault discovery operations", async function () {
      const { registry, vaults, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Test multiple rapid queries don't interfere
      const queries = await Promise.all([
        registry.getActiveVaults(),
        registry.getVaultCount(),
        registry.getVaultsByTokenPair(tokens.eth.target, tokens.usdt.target),
        registry.getVaultsByTokenPair(tokens.dai.target, tokens.usdc.target),
        registry.vaultInfo(vaults[0].vault.target),
        registry.vaultInfo(vaults[2].vault.target),
        registry.isRegisteredVault(vaults[4].vault.target)
      ]);
      
      // Verify all queries returned expected results
      expect(queries[0]).to.have.length(5); // getActiveVaults()
      expect(queries[1]).to.equal(5); // getVaultCount()
      expect(queries[2]).to.have.length(1); // ETH/USDT vaults
      expect(queries[3]).to.have.length(1); // DAI/USDC vaults
      expect(queries[4].name).to.equal("ETH/USDT Vault"); // vault info
      expect(queries[5].name).to.equal("LINK/WBTC Vault"); // vault info
      expect(queries[6]).to.equal(true);; // isRegisteredVault
    });

    it("should maintain data integrity under complex operations", async function () {
      const { registry, vaults, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Perform complex sequence of operations
      await registry.deactivateVault(vaults[1].vault.target, "Test 1");
      await registry.deactivateVault(vaults[3].vault.target, "Test 2");
      
      const midStateVaults = await registry.getActiveVaults();
      expect(midStateVaults).to.have.length(3);
      
      await registry.activateVault(vaults[1].vault.target);
      
      const finalStateVaults = await registry.getActiveVaults();
      expect(finalStateVaults).to.have.length(4);
      
      // Verify specific vault states
      const vault1Info = await registry.vaultInfo(vaults[1].vault.target);
      expect(vault1Info.isActive).to.equal(true);;
      
      const vault3Info = await registry.vaultInfo(vaults[3].vault.target);
      expect(vault3Info.isActive).to.equal(false);;
      
      // Verify token pair queries still work correctly
      const daiUsdcVaults = await registry.getVaultsByTokenPair(
        tokens.dai.target,
        tokens.usdc.target
      );
      expect(daiUsdcVaults).to.have.length(1); // Still exists, even if inactive
      
      // Verify total integrity
      const totalCount = await registry.getVaultCount();
      expect(totalCount).to.equal(5);
    });
  });

  describe("Business Logic Validation", function () {
    it("should demonstrate multi-vault architecture benefits", async function () {
      const { registry, vaults, tokens } = await loadFixture(deployMultiVaultEcosystem);
      
      // Benefit 1: Multiple token pairs supported simultaneously
      const tokenPairs = [
        [tokens.eth, tokens.usdt],
        [tokens.dai, tokens.usdc],
        [tokens.link, tokens.wbtc],
        [tokens.matic, tokens.weth],
        [tokens.wbtc, tokens.eth]
      ];
      
      for (const [tokenX, tokenY] of tokenPairs) {
        const vaultsForPair = await registry.getVaultsByTokenPair(
          tokenX.target,
          tokenY.target
        );
        expect(vaultsForPair).to.have.length(1);
      }
      
      // Benefit 2: Independent vault management
      await registry.deactivateVault(vaults[2].vault.target, "Maintenance");
      
      // Other vaults unaffected
      const remainingVaults = await registry.getActiveVaults();
      expect(remainingVaults).to.have.length(4);
      
      // Benefit 3: Scalable vault discovery
      const allVaults = await registry.getActiveVaults();
      expect(allVaults.length).to.be.greaterThan(1);
      
      // Benefit 4: Registry serves as single source of truth
      for (const vaultAddress of allVaults) {
        const info = await registry.vaultInfo(vaultAddress);
        expect(info.vault).to.equal(vaultAddress);
        expect(info.deployer).to.equal(owner.address);
        expect(info.deploymentTimestamp).to.be.greaterThan(0);
      }
    });
  });
});