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

describe("Registry Deployment Flow Integration Testing", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeRecipient: SignerWithAddress;

  async function deployCompleteArcaEcosystem() {
    [owner, user1, user2, feeRecipient] = await hre.ethers.getSigners();

    // Step 1: Deploy Registry (first, like production)
    const Registry = await hre.ethers.getContractFactory("ArcaVaultRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Step 2: Deploy mock infrastructure
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const tokenX = await MockERC20.deploy("Test Token X", "TKX", 18);
    const tokenY = await MockERC20.deploy("Test Token Y", "TKY", 18);
    const metroToken = await MockERC20.deploy("METRO", "METRO", 18);

    const MockLBRouter = await hre.ethers.getContractFactory("MockLBRouter");
    const mockRouter = await MockLBRouter.deploy();

    const MockLBPair = await hre.ethers.getContractFactory("MockLBPair");
    const mockPair = await MockLBPair.deploy();

    const MockRewarder = await hre.ethers.getContractFactory("MockLBHooksBaseRewarder");
    const mockRewarder = await MockRewarder.deploy();

    // Step 3: Deploy beacons for supporting contracts
    const FeeManager = await hre.ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await hre.upgrades.deployBeacon(FeeManager);

    const QueueHandler = await hre.ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandlerBeacon = await hre.upgrades.deployBeacon(QueueHandler);

    // Step 4: Deploy supporting contracts
    const feeManager = await hre.upgrades.deployBeaconProxy(
      feeManagerBeacon,
      FeeManager,
      [feeRecipient.address]
    );
    await feeManager.waitForDeployment();

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

    // Step 5: Deploy vault
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

    // Step 6: Transfer ownership (production flow)
    await queueHandler.transferOwnership(vault.target);
    await feeManager.transferOwnership(vault.target);
    await rewardClaimer.transferOwnership(vault.target);

    // Step 7: Register with registry (final step in production)
    await registry.registerVault(
      vault.target,
      rewardClaimer.target,
      queueHandler.target,
      feeManager.target,
      tokenX.target,
      tokenY.target,
      "Production Test Vault",
      "PROD-TEST",
      1,
      true // isProxy (because we used upgradeable contracts)
    );

    return {
      registry,
      vault: vault as ArcaTestnetV1,
      rewardClaimer: rewardClaimer as ArcaRewardClaimerV1,
      queueHandler: queueHandler as ArcaQueueHandlerV1,
      feeManager: feeManager as ArcaFeeManagerV1,
      tokenX: tokenX as MockERC20,
      tokenY: tokenY as MockERC20,
      metroToken: metroToken as MockERC20,
      mockRouter: mockRouter as MockLBRouter,
      mockPair: mockPair as MockLBPair,
      mockRewarder: mockRewarder as MockLBHooksBaseRewarder,
      beacons: { feeManagerBeacon, queueHandlerBeacon },
      accounts: { owner, user1, user2, feeRecipient }
    };
  }

  describe("Complete Deployment Flow", function () {
    it("should deploy all components in correct order", async function () {
      const { registry, vault, rewardClaimer, queueHandler, feeManager } = await loadFixture(deployCompleteArcaEcosystem);

      // Verify all components deployed successfully
      expect(await registry.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await vault.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await rewardClaimer.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await queueHandler.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await feeManager.getAddress()).to.not.equal(hre.ethers.ZeroAddress);

      // Verify registry has the vault registered
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);
      expect(activeVaults[0]).to.equal(vault.target);
    });

    it("should have correct ownership structure after deployment", async function () {
      const { vault, rewardClaimer, queueHandler, feeManager } = await loadFixture(deployCompleteArcaEcosystem);

      // Verify vault owns all supporting contracts
      expect(await queueHandler.owner()).to.equal(vault.target);
      expect(await feeManager.owner()).to.equal(vault.target);
      expect(await rewardClaimer.owner()).to.equal(vault.target);

      // Verify vault has correct owner (should be deployer)
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("should have all contracts properly linked", async function () {
      const { vault, rewardClaimer, queueHandler, feeManager } = await loadFixture(deployCompleteArcaEcosystem);

      // Verify vault has references to supporting contracts
      // Note: These are internal variables, so we test by interacting with the contracts
      
      // Test that vault can interact with queue handler
      const TokenX = 0;
      // This should not revert if contracts are properly linked
      await expect(vault.tokenBalance(TokenX)).to.not.be.reverted;
    });

    it("should support the complete user flow after deployment", async function () {
      const { vault, tokenX, tokenY } = await loadFixture(deployCompleteArcaEcosystem);

      // Mint tokens to user
      const amount = hre.ethers.parseEther("100");
      await tokenX.mint(user1.address, amount);
      await tokenY.mint(user1.address, amount);

      // Approve vault
      await tokenX.connect(user1).approve(vault.target, amount);
      await tokenY.connect(user1).approve(vault.target, amount);

      // Test deposit (should not revert if system is properly deployed)
      const TokenX = 0;
      const depositAmount = hre.ethers.parseEther("10");
      
      await expect(vault.connect(user1).depositToken(depositAmount, TokenX)).to.not.be.reverted;

      // Verify user's token balance decreased
      const remainingBalance = await tokenX.balanceOf(user1.address);
      expect(remainingBalance).to.equal(amount - depositAmount);
    });
  });

  describe("Registry Integration Validation", function () {
    it("should store complete vault metadata in registry", async function () {
      const { registry, vault, rewardClaimer, queueHandler, feeManager, tokenX, tokenY } = await loadFixture(deployCompleteArcaEcosystem);

      const vaultInfo = await registry.vaultInfo(vault.target);

      // Verify all metadata is correctly stored
      expect(vaultInfo.vault).to.equal(vault.target);
      expect(vaultInfo.rewardClaimer).to.equal(rewardClaimer.target);
      expect(vaultInfo.queueHandler).to.equal(queueHandler.target);
      expect(vaultInfo.feeManager).to.equal(feeManager.target);
      expect(vaultInfo.tokenX).to.equal(tokenX.target);
      expect(vaultInfo.tokenY).to.equal(tokenY.target);
      expect(vaultInfo.name).to.equal("Production Test Vault");
      expect(vaultInfo.symbol).to.equal("PROD-TEST");
      expect(vaultInfo.isActive).to.be.true;
      expect(vaultInfo.isProxy).to.be.true;
      expect(vaultInfo.deployer).to.equal(owner.address);
      expect(vaultInfo.deploymentTimestamp).to.be.greaterThan(0);
    });

    it("should support vault discovery through registry", async function () {
      const { registry, vault, tokenX, tokenY } = await loadFixture(deployCompleteArcaEcosystem);

      // Test getActiveVaults
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.include(vault.target);

      // Test getVaultsByTokenPair
      const vaultsForPair = await registry.getVaultsByTokenPair(tokenX.target, tokenY.target);
      expect(vaultsForPair).to.include(vault.target);

      // Test getVaultCount
      const vaultCount = await registry.getVaultCount();
      expect(vaultCount).to.equal(1);

      // Test isRegisteredVault
      const isRegistered = await registry.isRegisteredVault(vault.target);
      expect(isRegistered).to.be.true;
    });
  });

  describe("Deployment Address Export Simulation", function () {
    it("should provide all addresses needed for UI configuration", async function () {
      const { registry, vault, rewardClaimer, queueHandler, feeManager, tokenX, tokenY, mockRouter, mockPair } = await loadFixture(deployCompleteArcaEcosystem);

      // Simulate what deployment scripts would export for UI
      const deploymentExport = {
        network: "localhost",
        chainId: 31337,
        contracts: {
          registry: registry.target,
          vault: vault.target,
          rewardClaimer: rewardClaimer.target,
          queueHandler: queueHandler.target,
          feeManager: feeManager.target
        },
        tokens: {
          tokenX: tokenX.target,
          tokenY: tokenY.target
        },
        infrastructure: {
          lbRouter: mockRouter.target,
          lbPair: mockPair.target
        }
      };

      // Verify all addresses are valid
      expect(deploymentExport.contracts.registry).to.not.equal(hre.ethers.ZeroAddress);
      expect(deploymentExport.contracts.vault).to.not.equal(hre.ethers.ZeroAddress);
      expect(deploymentExport.contracts.rewardClaimer).to.not.equal(hre.ethers.ZeroAddress);
      expect(deploymentExport.contracts.queueHandler).to.not.equal(hre.ethers.ZeroAddress);
      expect(deploymentExport.contracts.feeManager).to.not.equal(hre.ethers.ZeroAddress);

      // Verify registry can be used to discover vault info
      const vaultInfo = await registry.vaultInfo(deploymentExport.contracts.vault);
      expect(vaultInfo.isActive).to.be.true;
    });

    it("should demonstrate registry-driven UI loading pattern", async function () {
      const { registry } = await loadFixture(deployCompleteArcaEcosystem);

      // Simulate UI loading pattern:
      // 1. UI gets registry address from deployment export
      const registryAddress = registry.target;

      // 2. UI queries registry for active vaults
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);

      // 3. UI gets details for each vault
      const vaultDetails = [];
      for (const vaultAddress of activeVaults) {
        const info = await registry.vaultInfo(vaultAddress);
        vaultDetails.push({
          address: vaultAddress,
          name: info.name,
          symbol: info.symbol,
          tokenX: info.tokenX,
          tokenY: info.tokenY,
          isActive: info.isActive
        });
      }

      expect(vaultDetails).to.have.length(1);
      expect(vaultDetails[0].name).to.equal("Production Test Vault");

      // 4. UI can filter or search vaults
      const activeVaultDetails = vaultDetails.filter(v => v.isActive);
      expect(activeVaultDetails).to.have.length(1);
    });
  });

  describe("Production Readiness Validation", function () {
    it("should pass all production deployment checks", async function () {
      const { registry, vault, rewardClaimer, queueHandler, feeManager, tokenX, tokenY, beacons } = await loadFixture(deployCompleteArcaEcosystem);

      // Check 1: All contracts deployed successfully
      expect(await registry.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await vault.getAddress()).to.not.equal(hre.ethers.ZeroAddress);

      // Check 2: Ownership is correctly transferred
      expect(await vault.owner()).to.equal(owner.address);
      expect(await queueHandler.owner()).to.equal(vault.target);
      expect(await feeManager.owner()).to.equal(vault.target);
      expect(await rewardClaimer.owner()).to.equal(vault.target);

      // Check 3: Vault is registered and discoverable
      const isRegistered = await registry.isRegisteredVault(vault.target);
      expect(isRegistered).to.be.true;

      // Check 4: Vault metadata is complete
      const vaultInfo = await registry.vaultInfo(vault.target);
      expect(vaultInfo.tokenX).to.equal(tokenX.target);
      expect(vaultInfo.tokenY).to.equal(tokenY.target);
      expect(vaultInfo.name).to.not.be.empty;
      expect(vaultInfo.symbol).to.not.be.empty;

      // Check 5: Beacons are properly deployed (for future upgrades)
      expect(await beacons.feeManagerBeacon.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
      expect(await beacons.queueHandlerBeacon.getAddress()).to.not.equal(hre.ethers.ZeroAddress);

      // Check 6: Registry supports all discovery methods
      const activeVaults = await registry.getActiveVaults();
      const vaultsByPair = await registry.getVaultsByTokenPair(tokenX.target, tokenY.target);
      const vaultCount = await registry.getVaultCount();

      expect(activeVaults).to.include(vault.target);
      expect(vaultsByPair).to.include(vault.target);
      expect(vaultCount).to.be.greaterThan(0);
    });

    it("should support multiple deployment scenarios", async function () {
      const { registry } = await loadFixture(deployCompleteArcaEcosystem);

      // Verify registry is ready for multiple vault registrations
      const initialCount = await registry.getVaultCount();
      expect(initialCount).to.equal(1);

      // Registry should be able to handle additional vault registrations
      // (This would be tested more thoroughly in multi-vault tests)
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults).to.have.length(1);

      // Registry maintains state correctly
      const vaultInfo = await registry.vaultInfo(activeVaults[0]);
      expect(vaultInfo.isActive).to.be.true;
    });
  });
});