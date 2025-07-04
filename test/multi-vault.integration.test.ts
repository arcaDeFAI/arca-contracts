import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type {
  ArcaTestnetV1,
  ArcaQueueHandlerV1,
  ArcaFeeManagerV1,
  ArcaRewardClaimerV1,
  MockERC20,
  MockLBPair,
  MockLBHooksBaseRewarder} from "../typechain-types";
import type {
  ArcaVaultRegistry,
  MockLBRouter,
} from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Token type enum to match contract
enum TokenType {
  TokenX = 0,
  TokenY = 1
}

interface VaultConfig {
  id: string;
  tokenX: MockERC20;
  tokenY: MockERC20;
  lbPair: MockLBPair;
  vault: ArcaTestnetV1;
  queueHandler: ArcaQueueHandlerV1;
  feeManager: ArcaFeeManagerV1;
  rewardClaimer: ArcaRewardClaimerV1;
  rewarder: MockLBHooksBaseRewarder;
}

// TODO: Additional multi-vault test scenarios to implement:
// 1. Test reward claiming with configured swap paths (METRO -> tokenX/tokenY)
//    - Verify actual token swaps occur and vault receives swapped tokens
//    - Test with different price ratios and slippage scenarios
// 2. Test beacon proxy upgrade scenarios
//    - Upgrade all queue handlers via beacon
//    - Verify all vaults still function after upgrade
// 3. Test with many vaults (10+) for performance/scalability
//    - Registry query performance with large vault count
//    - Gas costs for operations at scale
// 4. Test error scenarios
//    - Failed reward claims (rewarder reverts)
//    - Insufficient liquidity for swaps
//    - Invalid swap paths
// 5. Test vaults with different configurations
//    - Different bin steps (25, 50, 100)
//    - Different fee structures via different fee managers
//    - Different decimal combinations (6/6, 18/18, etc.)
// 6. Test vault migration scenarios
//    - Deactivating old vault and activating new one
//    - User migration between vault versions
// 7. Test cross-vault liquidity scenarios
//    - Multiple vaults for same token pair
//    - Competition for liquidity between vaults
// 8. Test emergency scenarios
//    - Pausing specific vaults
//    - Recovering stuck tokens from multiple vaults

describe("Multi-Vault Integration Tests", function () {
  const BIN_STEP = 25;
  const FEE_DEPOSIT = 50; // 0.5%
  const FEE_CLAIM = 1000; // 10%
  const MIN_AMOUNT_X = ethers.parseEther("0.01");
  const MIN_AMOUNT_Y_18 = ethers.parseEther("0.01");
  const MIN_AMOUNT_Y_6 = ethers.parseUnits("0.01", 6);
  
  // Helper function to create default rebalance params
  function getDefaultRebalanceParams(owner: SignerWithAddress) {
    return {
      deltaIds: [0], // Simple single bin
      distributionX: [10000], // 100% in single bin
      distributionY: [10000], // 100% in single bin
      ids: [],
      amounts: [],
      removeAmountXMin: 0,
      removeAmountYMin: 0,
      to: owner.address,
      refundTo: owner.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      forceRebalance: false
    };
  }
  
  async function deployMultiVaultEcosystem() {
    const [owner, alice, bob, charlie, feeRecipient] = await ethers.getSigners();
    
    // Deploy shared infrastructure
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const metroToken = await MockERC20Factory.deploy("METRO Token", "METRO", 18, owner.address);
    await metroToken.waitForDeployment();
    
    // Deploy mock Metropolis infrastructure
    const MockLBRouterFactory = await ethers.getContractFactory("MockLBRouter");
    const lbRouter = await MockLBRouterFactory.deploy();
    await lbRouter.waitForDeployment();
    
    // Deploy registry (not upgradeable)
    const ArcaVaultRegistryFactory = await ethers.getContractFactory("ArcaVaultRegistry");
    const registry = await ArcaVaultRegistryFactory.deploy();
    await registry.waitForDeployment();
    
    // Deploy beacons for shared implementations
    const ArcaQueueHandlerV1Factory = await ethers.getContractFactory("ArcaQueueHandlerV1");
    const queueHandlerBeacon = await upgrades.deployBeacon(ArcaQueueHandlerV1Factory);
    
    const ArcaFeeManagerV1Factory = await ethers.getContractFactory("ArcaFeeManagerV1");
    const feeManagerBeacon = await upgrades.deployBeacon(ArcaFeeManagerV1Factory);
    
    // Track deployed tokens for reuse
    const deployedTokens = new Map<string, MockERC20>();
    deployedTokens.set("METRO", metroToken);
    
    // Define vault configurations
    const vaultConfigs = [
      { id: "ws-usdc", tokenXSymbol: "wS", tokenYSymbol: "USDC", tokenYDecimals: 6 },
      { id: "metro-usdc", tokenXSymbol: "METRO", tokenYSymbol: "USDC", tokenYDecimals: 6 },
      { id: "test1-test2", tokenXSymbol: "TEST1", tokenYSymbol: "TEST2", tokenYDecimals: 18 },
    ];
    
    const vaults: VaultConfig[] = [];
    
    // Deploy vaults
    for (let deploymentId = 0; deploymentId < vaultConfigs.length; deploymentId++) {
      const config = vaultConfigs[deploymentId];
      
      // Deploy or reuse tokens
      let tokenX: MockERC20;
      let tokenY: MockERC20;
      
      // Handle tokenX
      if (deployedTokens.has(config.tokenXSymbol)) {
        tokenX = deployedTokens.get(config.tokenXSymbol)!;
      } else {
        tokenX = await MockERC20Factory.deploy(
          config.tokenXSymbol + " Token",
          config.tokenXSymbol,
          18,
          owner.address
        );
        await tokenX.waitForDeployment();
        deployedTokens.set(config.tokenXSymbol, tokenX);
      }
      
      // Handle tokenY
      if (deployedTokens.has(config.tokenYSymbol)) {
        tokenY = deployedTokens.get(config.tokenYSymbol)!;
      } else {
        tokenY = await MockERC20Factory.deploy(
          config.tokenYSymbol + " Token",
          config.tokenYSymbol,
          config.tokenYDecimals,
          owner.address
        );
        await tokenY.waitForDeployment();
        deployedTokens.set(config.tokenYSymbol, tokenY);
      }
      
      // Deploy MockLBPair (no constructor parameters)
      const MockLBPairFactory = await ethers.getContractFactory("MockLBPair");
      const lbPair = await MockLBPairFactory.deploy();
      await lbPair.waitForDeployment();
      
      // Deploy rewarder
      const MockLBHooksBaseRewarderFactory = await ethers.getContractFactory("MockLBHooksBaseRewarder");
      const rewarder = await MockLBHooksBaseRewarderFactory.deploy();
      await rewarder.waitForDeployment();
      
      // Configure rewarder
      await rewarder.setRewardToken(await metroToken.getAddress());
      await rewarder.setClaimAmount(ethers.parseEther("10")); // 10 METRO per claim
      
      // Deploy queue handler beacon proxy
      const queueHandlerProxy = await upgrades.deployBeaconProxy(
        queueHandlerBeacon,
        ArcaQueueHandlerV1Factory,
        [] // No initialization parameters
      ) as unknown as ArcaQueueHandlerV1;
      await queueHandlerProxy.waitForDeployment();
      
      // Deploy fee manager beacon proxy
      const feeManagerProxy = await upgrades.deployBeaconProxy(
        feeManagerBeacon,
        ArcaFeeManagerV1Factory,
        [feeRecipient.address] // Initialize with fee recipient
      ) as unknown as ArcaFeeManagerV1;
      await feeManagerProxy.waitForDeployment();
      
      // Fees are already set to defaults in initialize (0.5%, 0.5%, 10%)
      
      // Deploy reward claimer (UUPS proxy)
      const ArcaRewardClaimerV1Factory = await ethers.getContractFactory("ArcaRewardClaimerV1");
      const minAmountY = config.tokenYDecimals === 6 ? MIN_AMOUNT_Y_6 : MIN_AMOUNT_Y_18;
      
      const rewardClaimer = await upgrades.deployProxy(
        ArcaRewardClaimerV1Factory,
        [
          await rewarder.getAddress(),
          await metroToken.getAddress(),
          await feeManagerProxy.getAddress(),
          await tokenX.getAddress(), // native token (wS or equivalent)
          await lbPair.getAddress(),
          await lbPair.getAddress(), // lpAMM
          await lbPair.getAddress(), // lbpContractUSD
          await lbRouter.getAddress(),
          5, // idSlippage
          await tokenX.getAddress(),
          await tokenY.getAddress()
        ],
        { kind: 'uups' }
      ) as unknown as ArcaRewardClaimerV1;
      await rewardClaimer.waitForDeployment();
      
      // Deploy vault (UUPS proxy)
      const ArcaTestnetV1Factory = await ethers.getContractFactory("ArcaTestnetV1");
      const vault = await upgrades.deployProxy(
        ArcaTestnetV1Factory,
        [
          await tokenX.getAddress(),
          await tokenY.getAddress(),
          BIN_STEP,
          MIN_AMOUNT_X,
          minAmountY,
          await lbRouter.getAddress(),
          await lbPair.getAddress(), // lbpAMM
          await lbPair.getAddress(), // lbpContract
          await rewardClaimer.getAddress(),
          await queueHandlerProxy.getAddress(),
          await feeManagerProxy.getAddress()
        ],
        { kind: 'uups' }
      ) as unknown as ArcaTestnetV1;
      await vault.waitForDeployment();
      
      // Transfer ownership of supporting contracts to vault
      await queueHandlerProxy.transferOwnership(await vault.getAddress());
      await feeManagerProxy.transferOwnership(await vault.getAddress());
      await rewardClaimer.transferOwnership(await vault.getAddress());
      
      // Register vault in registry
      await registry.registerVault(
        await vault.getAddress(),
        await rewardClaimer.getAddress(),
        await queueHandlerProxy.getAddress(),
        await feeManagerProxy.getAddress(),
        await tokenX.getAddress(),
        await tokenY.getAddress(),
        `Arca ${config.id} Vault`,
        `ARCA-${config.id}`,
        deploymentId,
        true // isProxy
      );
      
      // Add initial liquidity to mock pair (simplified - just set reserves)
      // In real deployment, this would be done via router
      
      vaults.push({
        id: config.id,
        tokenX,
        tokenY,
        lbPair,
        vault,
        queueHandler: queueHandlerProxy,
        feeManager: feeManagerProxy,
        rewardClaimer,
        rewarder,
      });
    }
    
    // Distribute tokens to test accounts
    const testAccounts = [alice, bob, charlie];
    const tokenAmount18 = ethers.parseEther("1000000");
    const tokenAmount6 = ethers.parseUnits("1000000", 6);
    
    for (const account of testAccounts) {
      // Distribute all unique tokens
      for (const [, token] of deployedTokens) {
        const decimals = await token.decimals();
        const amount = decimals === BigInt(6) ? tokenAmount6 : tokenAmount18;
        await token.connect(owner).transfer(account.address, amount);
      }
    }
    
    return {
      owner,
      alice,
      bob,
      charlie,
      feeRecipient,
      registry,
      vaults,
      metroToken,
      lbRouter,
      queueHandlerBeacon,
      feeManagerBeacon,
    };
  }
  
  describe("Multi-Vault Deployment", function () {
    it("should deploy multiple vaults with shared infrastructure", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Verify all vaults are registered
      const vaultCount = await registry.getVaultCount();
      expect(vaultCount).to.equal(3);
      
      // Verify each vault is properly configured
      for (let i = 0; i < vaults.length; i++) {
        const vault = vaults[i];
        const vaultAddress = await vault.vault.getAddress();
        
        // Check if vault is registered
        expect(await registry.isRegisteredVault(vaultAddress)).to.be.true;
        
        // Verify vault info
        const vaultInfo = await registry.getVaultInfo(vaultAddress);
        expect(vaultInfo.isActive).to.be.true;
        expect(vaultInfo.tokenX).to.equal(await vault.tokenX.getAddress());
        expect(vaultInfo.tokenY).to.equal(await vault.tokenY.getAddress());
        expect(vaultInfo.vault).to.equal(vaultAddress);
        expect(vaultInfo.rewardClaimer).to.equal(await vault.rewardClaimer.getAddress());
        expect(vaultInfo.queueHandler).to.equal(await vault.queueHandler.getAddress());
        expect(vaultInfo.feeManager).to.equal(await vault.feeManager.getAddress());
      }
    });
    
    it("should share USDC token between vaults", async function () {
      const { vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // ws-usdc and metro-usdc should share the same USDC token
      const wsUsdcTokenY = await vaults[0].tokenY.getAddress();
      const metroUsdcTokenY = await vaults[1].tokenY.getAddress();
      
      expect(wsUsdcTokenY).to.equal(metroUsdcTokenY);
      
      // test1-test2 should have different tokens
      const test1Test2TokenY = await vaults[2].tokenY.getAddress();
      expect(test1Test2TokenY).to.not.equal(wsUsdcTokenY);
    });
    
    it("should use shared beacons for queue handlers and fee managers", async function () {
      const { vaults, queueHandlerBeacon, feeManagerBeacon } = await loadFixture(deployMultiVaultEcosystem);
      
      // All queue handlers should share the same beacon
      for (const vault of vaults) {
        const queueHandlerAddress = await vault.queueHandler.getAddress();
        const beaconAddress = await upgrades.erc1967.getBeaconAddress(queueHandlerAddress);
        expect(beaconAddress).to.equal(await queueHandlerBeacon.getAddress());
      }
      
      // All fee managers should share the same beacon
      for (const vault of vaults) {
        const feeManagerAddress = await vault.feeManager.getAddress();
        const beaconAddress = await upgrades.erc1967.getBeaconAddress(feeManagerAddress);
        expect(beaconAddress).to.equal(await feeManagerBeacon.getAddress());
      }
    });
  });
  
  describe("Multi-Vault Operations", function () {
    it("should handle deposits to multiple vaults independently", async function () {
      const { alice, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deposit to each vault
      for (const vault of vaults) {
        const depositAmountX = ethers.parseEther("1000");
        const decimalsY = await vault.tokenY.decimals();
        const depositAmountY = ethers.parseUnits("1000", decimalsY);
        
        // Approve tokens
        await vault.tokenX.connect(alice).approve(await vault.vault.getAddress(), depositAmountX);
        await vault.tokenY.connect(alice).approve(await vault.vault.getAddress(), depositAmountY);
        
        // Deposit each token separately
        await vault.vault.connect(alice).depositToken(depositAmountX, TokenType.TokenX);
        await vault.vault.connect(alice).depositToken(depositAmountY, TokenType.TokenY);
        
        // Verify deposits queued
        expect(await vault.queueHandler.getPendingDepositsCount()).to.equal(2);
        
        // Calculate expected amounts after fees
        const expectedX = depositAmountX - (depositAmountX * BigInt(FEE_DEPOSIT) / 10000n);
        const expectedY = depositAmountY - (depositAmountY * BigInt(FEE_DEPOSIT) / 10000n);
        
        // Verify exact queued amounts (net amounts after fees)
        expect(await vault.queueHandler.getQueuedToken(TokenType.TokenX)).to.equal(expectedX);
        expect(await vault.queueHandler.getQueuedToken(TokenType.TokenY)).to.equal(expectedY);
      }
    });
    
    it("should track vault-specific shares independently", async function () {
      const { owner, alice, bob, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deposit to first vault as alice
      const vault1 = vaults[0];
      const depositAmountX = ethers.parseEther("1000");
      const depositAmountY = ethers.parseUnits("1000", 6); // USDC has 6 decimals
      
      await vault1.tokenX.connect(alice).approve(await vault1.vault.getAddress(), depositAmountX);
      await vault1.tokenY.connect(alice).approve(await vault1.vault.getAddress(), depositAmountY);
      await vault1.vault.connect(alice).depositToken(depositAmountX, TokenType.TokenX);
      await vault1.vault.connect(alice).depositToken(depositAmountY, TokenType.TokenY);
      
      // Process deposit via rebalance
      await vault1.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      
      // Verify alice has shares in vault1
      const aliceSharesVault1X = await vault1.vault.getShares(alice.address, TokenType.TokenX);
      const aliceSharesVault1Y = await vault1.vault.getShares(alice.address, TokenType.TokenY);
      expect(aliceSharesVault1X).to.be.gt(0);
      expect(aliceSharesVault1Y).to.be.gt(0);
      
      // Verify alice has no shares in vault2
      const vault2 = vaults[1];
      const aliceSharesVault2X = await vault2.vault.getShares(alice.address, TokenType.TokenX);
      const aliceSharesVault2Y = await vault2.vault.getShares(alice.address, TokenType.TokenY);
      expect(aliceSharesVault2X).to.equal(0);
      expect(aliceSharesVault2Y).to.equal(0);
      
      // Deposit to second vault as bob
      await vault2.tokenX.connect(bob).approve(await vault2.vault.getAddress(), depositAmountX);
      await vault2.tokenY.connect(bob).approve(await vault2.vault.getAddress(), depositAmountY);
      await vault2.vault.connect(bob).depositToken(depositAmountX, TokenType.TokenX);
      await vault2.vault.connect(bob).depositToken(depositAmountY, TokenType.TokenY);
      
      // Process deposit
      await vault2.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      
      // Verify bob has shares in vault2 but not vault1
      const bobSharesVault2X = await vault2.vault.getShares(bob.address, TokenType.TokenX);
      const bobSharesVault2Y = await vault2.vault.getShares(bob.address, TokenType.TokenY);
      expect(bobSharesVault2X).to.be.gt(0);
      expect(bobSharesVault2Y).to.be.gt(0);
      
      const bobSharesVault1X = await vault1.vault.getShares(bob.address, TokenType.TokenX);
      const bobSharesVault1Y = await vault1.vault.getShares(bob.address, TokenType.TokenY);
      expect(bobSharesVault1X).to.equal(0);
      expect(bobSharesVault1Y).to.equal(0);
    });
    
    it("should collect fees to the same recipient across all vaults", async function () {
      const { owner, alice, feeRecipient, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      const initialBalances: Record<string, bigint> = {};
      
      // Record initial fee recipient balances
      const processedTokens = new Set<string>();
      for (const vault of vaults) {
        const tokenXAddress = await vault.tokenX.getAddress();
        const tokenYAddress = await vault.tokenY.getAddress();
        
        if (!processedTokens.has(tokenXAddress)) {
          initialBalances[tokenXAddress] = await vault.tokenX.balanceOf(feeRecipient.address);
          processedTokens.add(tokenXAddress);
        }
        
        if (!processedTokens.has(tokenYAddress)) {
          initialBalances[tokenYAddress] = await vault.tokenY.balanceOf(feeRecipient.address);
          processedTokens.add(tokenYAddress);
        }
      }
      
      // Deposit to all vaults (fees are collected immediately on deposit)
      for (const vault of vaults) {
        const depositAmountX = ethers.parseEther("10000");
        const decimalsY = await vault.tokenY.decimals();
        const depositAmountY = ethers.parseUnits("10000", decimalsY);
        
        await vault.tokenX.connect(alice).approve(await vault.vault.getAddress(), depositAmountX);
        await vault.tokenY.connect(alice).approve(await vault.vault.getAddress(), depositAmountY);
        await vault.vault.connect(alice).depositToken(depositAmountX, TokenType.TokenX);
        await vault.vault.connect(alice).depositToken(depositAmountY, TokenType.TokenY);
      }
      
      // Verify fee recipient received fees from all vaults
      processedTokens.clear();
      for (const vault of vaults) {
        const tokenXAddress = await vault.tokenX.getAddress();
        const tokenYAddress = await vault.tokenY.getAddress();
        
        if (!processedTokens.has(tokenXAddress)) {
          const finalBalance = await vault.tokenX.balanceOf(feeRecipient.address);
          expect(finalBalance).to.be.gt(initialBalances[tokenXAddress]);
          processedTokens.add(tokenXAddress);
        }
        
        if (!processedTokens.has(tokenYAddress)) {
          const finalBalance = await vault.tokenY.balanceOf(feeRecipient.address);
          expect(finalBalance).to.be.gt(initialBalances[tokenYAddress]);
          processedTokens.add(tokenYAddress);
        }
      }
    });
  });
  
  describe("Multi-Vault Registry", function () {
    it("should allow querying vaults by token pairs", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Query by token pair
      for (const vault of vaults) {
        const tokenX = await vault.tokenX.getAddress();
        const tokenY = await vault.tokenY.getAddress();
        
        const vaultsByPair = await registry.getVaultsByTokenPair(tokenX, tokenY);
        expect(vaultsByPair.length).to.be.gte(1);
        expect(vaultsByPair).to.include(await vault.vault.getAddress());
      }
    });
    
    it("should return all active vaults", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults.length).to.equal(vaults.length);
      
      for (const vault of vaults) {
        expect(activeVaults).to.include(await vault.vault.getAddress());
      }
    });
    
    it("should handle vault deactivation", async function () {
      const { owner, registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deactivate first vault
      const vaultToDeactivate = await vaults[0].vault.getAddress();
      await registry.connect(owner).deactivateVault(vaultToDeactivate, "Testing deactivation");
      
      // Verify vault is deactivated
      const vaultInfo = await registry.getVaultInfo(vaultToDeactivate);
      expect(vaultInfo.isActive).to.be.false;
      
      // Verify active vaults list updated
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults.length).to.equal(vaults.length - 1);
      expect(activeVaults).to.not.include(vaultToDeactivate);
      
      // Verify other vaults still active
      for (let i = 1; i < vaults.length; i++) {
        expect(activeVaults).to.include(await vaults[i].vault.getAddress());
      }
    });
  });
  
  describe("Cross-Vault Scenarios", function () {
    it("should handle METRO rewards independently across vaults", async function () {
      const { owner, alice, bob, vaults, metroToken } = await loadFixture(deployMultiVaultEcosystem);
      
      // Setup: Deposit to both metro-usdc and ws-usdc vaults
      const vault1 = vaults[0]; // ws-usdc
      const vault2 = vaults[1]; // metro-usdc
      
      const depositAmount = ethers.parseEther("1000");
      const depositAmountUSDC = ethers.parseUnits("1000", 6);
      
      // Alice deposits to vault1
      await vault1.tokenX.connect(alice).approve(await vault1.vault.getAddress(), depositAmount);
      await vault1.tokenY.connect(alice).approve(await vault1.vault.getAddress(), depositAmountUSDC);
      await vault1.vault.connect(alice).depositToken(depositAmount, TokenType.TokenX);
      await vault1.vault.connect(alice).depositToken(depositAmountUSDC, TokenType.TokenY);
      
      // Bob deposits to vault2
      await vault2.tokenX.connect(bob).approve(await vault2.vault.getAddress(), depositAmount);
      await vault2.tokenY.connect(bob).approve(await vault2.vault.getAddress(), depositAmountUSDC);
      await vault2.vault.connect(bob).depositToken(depositAmount, TokenType.TokenX);
      await vault2.vault.connect(bob).depositToken(depositAmountUSDC, TokenType.TokenY);
      
      // Process deposits
      await vault1.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      await vault2.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      
      // Add METRO rewards to both rewarders
      const rewardAmount = ethers.parseEther("100");
      await metroToken.transfer(await vault1.rewarder.getAddress(), rewardAmount);
      await metroToken.transfer(await vault2.rewarder.getAddress(), rewardAmount);
      
      // Set minimum swap amount to 0 to allow small amounts to be swapped
      await vault1.vault.connect(owner).setMinSwapAmount(0);
      await vault2.vault.connect(owner).setMinSwapAmount(0);
      
      // Track reward claimer balances before rebalance
      const claimer1Address = await vault1.rewardClaimer.getAddress();
      const claimer1MetroBefore = await metroToken.balanceOf(claimer1Address);
      
      // Rebalance vault1 - this will trigger reward claiming internally
      await vault1.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      
      const claimer1MetroAfter = await metroToken.balanceOf(claimer1Address);
      
      // Verify rewards were claimed by checking reward claimer received METRO (minus fee to recipient)
      const expectedReward = ethers.parseEther("10"); // Mock rewarder gives 10 METRO per claim
      const expectedFee = expectedReward * BigInt(FEE_CLAIM) / 10000n;
      const expectedNetReward = expectedReward - expectedFee;
      
      // The reward claimer should have the net rewards (since no swap paths configured, it keeps METRO)
      expect(claimer1MetroAfter - claimer1MetroBefore).to.equal(expectedNetReward);
      
      // Verify vault2 hasn't claimed yet
      const claimer2Address = await vault2.rewardClaimer.getAddress();
      const claimer2MetroBefore = await metroToken.balanceOf(claimer2Address);
      expect(claimer2MetroBefore).to.equal(0);
      
      // Rebalance vault2 - this will claim its rewards
      await vault2.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      const claimer2MetroAfter = await metroToken.balanceOf(claimer2Address);
      expect(claimer2MetroAfter - claimer2MetroBefore).to.equal(expectedNetReward);
    });
    
    it("should handle concurrent operations across multiple vaults", async function () {
      const { owner, alice, bob, charlie, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      const depositAmount = ethers.parseEther("500");
      
      // Users deposit to different vaults concurrently
      const promises = [];
      
      // Alice deposits to vault 1
      promises.push((async () => {
        const vault = vaults[0];
        const amountY = ethers.parseUnits("500", await vault.tokenY.decimals());
        await vault.tokenX.connect(alice).approve(await vault.vault.getAddress(), depositAmount);
        await vault.tokenY.connect(alice).approve(await vault.vault.getAddress(), amountY);
        await vault.vault.connect(alice).depositToken(depositAmount, TokenType.TokenX);
        return vault.vault.connect(alice).depositToken(amountY, TokenType.TokenY);
      })());
      
      // Bob deposits to vault 2
      promises.push((async () => {
        const vault = vaults[1];
        const amountY = ethers.parseUnits("500", await vault.tokenY.decimals());
        await vault.tokenX.connect(bob).approve(await vault.vault.getAddress(), depositAmount);
        await vault.tokenY.connect(bob).approve(await vault.vault.getAddress(), amountY);
        await vault.vault.connect(bob).depositToken(depositAmount, TokenType.TokenX);
        return vault.vault.connect(bob).depositToken(amountY, TokenType.TokenY);
      })());
      
      // Charlie deposits to vault 3
      promises.push((async () => {
        const vault = vaults[2];
        const amountY = ethers.parseUnits("500", await vault.tokenY.decimals());
        await vault.tokenX.connect(charlie).approve(await vault.vault.getAddress(), depositAmount);
        await vault.tokenY.connect(charlie).approve(await vault.vault.getAddress(), amountY);
        await vault.vault.connect(charlie).depositToken(depositAmount, TokenType.TokenX);
        return vault.vault.connect(charlie).depositToken(amountY, TokenType.TokenY);
      })());
      
      // Execute all deposits
      await Promise.all(promises);
      
      // Process all vaults
      for (const vault of vaults) {
        await vault.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner));
      }
      
      // Verify all users have shares in their respective vaults
      expect(await vaults[0].vault.getShares(alice.address, TokenType.TokenX)).to.be.gt(0);
      expect(await vaults[1].vault.getShares(bob.address, TokenType.TokenX)).to.be.gt(0);
      expect(await vaults[2].vault.getShares(charlie.address, TokenType.TokenX)).to.be.gt(0);
    });
  });
  
  describe("Multi-Vault Edge Cases", function () {
    it("should handle vault with zero liquidity gracefully", async function () {
      const { owner, alice, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Use vault 3 which has no initial liquidity added
      const vault = vaults[2];
      
      // Try to deposit when there's no liquidity
      const depositAmount = ethers.parseEther("100");
      await vault.tokenX.connect(alice).approve(await vault.vault.getAddress(), depositAmount);
      await vault.tokenY.connect(alice).approve(await vault.vault.getAddress(), depositAmount);
      
      await vault.vault.connect(alice).depositToken(depositAmount, TokenType.TokenX);
      await vault.vault.connect(alice).depositToken(depositAmount, TokenType.TokenY);
      
      // Process deposit - should work even with no initial liquidity
      await expect(
        vault.vault.connect(owner).rebalance(getDefaultRebalanceParams(owner))
      ).to.not.be.reverted;
      
      // Alice should have shares
      expect(await vault.vault.getShares(alice.address, TokenType.TokenX)).to.be.gt(0);
      expect(await vault.vault.getShares(alice.address, TokenType.TokenY)).to.be.gt(0);
    });
    
    it("should handle registry queries efficiently with multiple vaults", async function () {
      const { registry, vaults } = await loadFixture(deployMultiVaultEcosystem);
      
      // Registry should handle many vaults efficiently
      const vaultCount = await registry.getVaultCount();
      expect(vaultCount).to.equal(3);
      
      // Getting all vaults should work efficiently
      const vaultList = [];
      for (let i = 0; i < vaultCount; i++) {
        // Access vaultList array directly
        const vaultAddress = await registry.vaultList(i);
        vaultList.push(vaultAddress);
      }
      expect(vaultList.length).to.equal(3);
      
      // Active vaults query should be gas-efficient
      const activeVaults = await registry.getActiveVaults();
      expect(activeVaults.length).to.equal(3);
      
      // Verify all deployed vaults are in the list
      for (const vault of vaults) {
        expect(vaultList).to.include(await vault.vault.getAddress());
      }
    });
    
    it("should properly track token pairs with multiple vaults", async function () {
      const { registry, vaults, owner, lbRouter } = await loadFixture(deployMultiVaultEcosystem);
      
      // Deploy another ws-usdc vault to test multiple vaults per pair
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const ArcaTestnetV1Factory = await ethers.getContractFactory("ArcaTestnetV1");
      const MockLBPairFactory = await ethers.getContractFactory("MockLBPair");
      const MockLBRouterFactory = await ethers.getContractFactory("MockLBRouter");
      
      // Reuse existing tokens from first vault
      const tokenX = vaults[0].tokenX;
      const tokenY = vaults[0].tokenY;
      
      // Deploy new vault for same token pair
      const newLbPair = await MockLBPairFactory.deploy();
      const newVault = await upgrades.deployProxy(
        ArcaTestnetV1Factory,
        [
          await tokenX.getAddress(),
          await tokenY.getAddress(),
          BIN_STEP,
          MIN_AMOUNT_X,
          MIN_AMOUNT_Y_6,
          await lbRouter.getAddress(), // Reuse router from deployment
          await newLbPair.getAddress(),
          await newLbPair.getAddress(),
          await vaults[0].rewardClaimer.getAddress(), // Simplified for test
          await vaults[0].queueHandler.getAddress(),
          await vaults[0].feeManager.getAddress()
        ],
        { kind: 'uups' }
      ) as unknown as ArcaTestnetV1;
      
      // Register the new vault
      await registry.registerVault(
        await newVault.getAddress(),
        await vaults[0].rewardClaimer.getAddress(),
        await vaults[0].queueHandler.getAddress(),
        await vaults[0].feeManager.getAddress(),
        await tokenX.getAddress(),
        await tokenY.getAddress(),
        "Arca ws-usdc Vault 2",
        "ARCA-ws-usdc-2",
        100, // deploymentId
        true
      );
      
      // Query vaults by token pair - should return both vaults
      const vaultsByPair = await registry.getVaultsByTokenPair(
        await tokenX.getAddress(),
        await tokenY.getAddress()
      );
      
      expect(vaultsByPair.length).to.equal(2);
      expect(vaultsByPair).to.include(await vaults[0].vault.getAddress());
      expect(vaultsByPair).to.include(await newVault.getAddress());
    });
  });
});