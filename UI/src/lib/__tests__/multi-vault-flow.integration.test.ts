import { describe, it, expect, vi } from "vitest";
import {
  createVaultConfigFromRegistry,
  getActiveVaultConfigs,
} from "../vault-configs";
import { getDeploymentAddresses } from "../deployment-loader";
import type { RegistryVaultInfo } from "../../hooks/use-vault-registry";
import {
  MOCK_SYSTEM_CONTRACTS,
  MOCK_DEPLOYMENT_ADDRESSES,
} from "../../test-utils/mock-contracts";

// Mock the deployments to use consistent test addresses
vi.mock("../../../../exports/deployments", () => ({
  deployments: {
    localhost: {
      vault: "0xLocalVault",
      registry: "0x9876543210987654321098765432109876543210",
      feeManager: "0xFEEDFACEFEEDFACEFEEDFACEFEEDFACEFEEDFACE",
      queueHandler: "0x1234567890ABCDEF1234567890ABCDEF12345678",
      rewardClaimer: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      config: {
        tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS - actual address from KNOWN_TOKENS
        tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e - actual address from KNOWN_TOKENS
      },
    },
    "sonic-testnet": {
      vault: "0xTestnetVault",
      registry: "0x9876543210987654321098765432109876543210",
      feeManager: "0xFEEDFACEFEEDFACEFEEDFACEFEEDFACEFEEDFACE",
      queueHandler: "0x1234567890ABCDEF1234567890ABCDEF12345678",
      rewardClaimer: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      config: {
        tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
        tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e - actual address from KNOWN_TOKENS
      },
    },
  },
}));

describe("Multi-Vault Flow Integration", () => {
  describe("Complete Configuration Flow", () => {
    it("should handle infrastructure and vault configs separately", () => {
      // Step 1: Get infrastructure addresses for testnet
      const infrastructure = getDeploymentAddresses(57054);

      expect(infrastructure).toBeDefined();
      expect(infrastructure?.registry).toBe(MOCK_SYSTEM_CONTRACTS.registry);
      expect(infrastructure?.networkTokens.rewardToken).toBe(
        MOCK_DEPLOYMENT_ADDRESSES.networkTokens.rewardToken,
      ); // METRO
      expect(infrastructure?.networkTokens.wrappedNative).toBe(
        MOCK_DEPLOYMENT_ADDRESSES.networkTokens.wrappedNative,
      ); // wS
      expect(infrastructure?.metropolis.lbRouter).toBeDefined();

      // No vault-specific data in infrastructure
      expect(infrastructure).not.toHaveProperty("vault");
      expect(infrastructure).not.toHaveProperty("tokens");
    });

    it("should create vault configs from registry data", () => {
      // Step 2: Simulate registry data with various token pairs
      const registryVaults: RegistryVaultInfo[] = [
        {
          vault: "0xVault1",
          rewardClaimer: "0xRC1",
          queueHandler: "0xQH1",
          feeManager: "0xFM1",
          tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
          tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e
          name: "Arca wS-USDC.e Vault",
          symbol: "ARCA-V1",
          isActive: true,
        },
        {
          vault: "0xVault2",
          rewardClaimer: "0xRC2",
          queueHandler: "0xQH2",
          feeManager: "0xFM2",
          tokenX: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
          tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e
          name: "Arca METRO-USDC.e Vault",
          symbol: "ARCA-V2",
          isActive: true,
        },
        {
          vault: "0xVault3",
          rewardClaimer: "0xRC3",
          queueHandler: "0xQH3",
          feeManager: "0xFM3",
          tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
          tokenY: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
          name: "Arca wS-METRO Vault",
          symbol: "ARCA-V3",
          isActive: true,
        },
      ];

      // Step 3: Create vault configs
      const vaultConfigs = getActiveVaultConfigs(registryVaults, 57054);

      expect(vaultConfigs).toHaveLength(3);

      // Check first vault (wS-USDC.e)
      expect(vaultConfigs[0].tokenX.symbol).toBe("wS");
      expect(vaultConfigs[0].tokenY.symbol).toBe("USDC.e");
      expect(vaultConfigs[0].chain).toBe("Sonic Blaze Testnet");

      // Check second vault (METRO-USDC.e)
      expect(vaultConfigs[1].tokenX.symbol).toBe("METRO");
      expect(vaultConfigs[1].tokenY.symbol).toBe("USDC.e");

      // Check third vault (wS-METRO)
      expect(vaultConfigs[2].tokenX.symbol).toBe("wS");
      expect(vaultConfigs[2].tokenY.symbol).toBe("METRO");
    });

    it("should support any token pair combination", () => {
      // Test with arbitrary tokens
      const exoticVault: RegistryVaultInfo = {
        vault: "0xExoticVault",
        rewardClaimer: "0xRC",
        queueHandler: "0xQH",
        feeManager: "0xFM",
        tokenX: "0xAAA",
        tokenY: "0xBBB",
        name: "Exotic Token Pair Vault",
        symbol: "EXOTIC",
        isActive: true,
      };

      const config = createVaultConfigFromRegistry(exoticVault, 31337);

      // Should handle unknown tokens gracefully
      expect(config.tokenX.address).toBe("0xAAA");
      expect(config.tokenY.address).toBe("0xBBB");
      expect(config.tokenX.symbol).toMatch(/^TOKEN-/); // Unknown token pattern
      expect(config.tokenY.symbol).toMatch(/^TOKEN-/);
      expect(config.tokenX.decimals).toBe(18); // Default decimals
    });

    it("should filter inactive vaults", () => {
      const mixedVaults: RegistryVaultInfo[] = [
        {
          vault: "0xActive",
          rewardClaimer: "0xRC1",
          queueHandler: "0xQH1",
          feeManager: "0xFM1",
          tokenX: "0xX",
          tokenY: "0xY",
          name: "Active Vault",
          symbol: "ACTIVE",
          isActive: true,
        },
        {
          vault: "0xInactive",
          rewardClaimer: "0xRC2",
          queueHandler: "0xQH2",
          feeManager: "0xFM2",
          tokenX: "0xX2",
          tokenY: "0xY2",
          name: "Inactive Vault",
          symbol: "INACTIVE",
          isActive: false,
        },
      ];

      const activeConfigs = getActiveVaultConfigs(mixedVaults, 31337);

      expect(activeConfigs).toHaveLength(1);
      expect(activeConfigs[0].name).toBe("Active Vault");
    });
  });

  describe("Network Switching", () => {
    it("should provide correct infrastructure for each network", () => {
      // Localhost
      const localhost = getDeploymentAddresses(31337);
      expect(localhost?.registry).toBeDefined();
      expect(localhost?.registry).toBe(MOCK_SYSTEM_CONTRACTS.registry);

      // Testnet
      const testnet = getDeploymentAddresses(57054);
      expect(testnet?.registry).toBe(MOCK_SYSTEM_CONTRACTS.registry);
      expect(testnet?.networkTokens.rewardToken).toBe(
        MOCK_DEPLOYMENT_ADDRESSES.networkTokens.rewardToken,
      );

      // Mainnet (not deployed yet)
      const mainnet = getDeploymentAddresses(146);
      expect(mainnet).toBeNull(); // Not deployed yet
    });

    it("should create vault configs with correct chain names", () => {
      const vault: RegistryVaultInfo = {
        vault: "0xVault",
        rewardClaimer: "0xRC",
        queueHandler: "0xQH",
        feeManager: "0xFM",
        tokenX: "0xX",
        tokenY: "0xY",
        name: "Test Vault",
        symbol: "TEST",
        isActive: true,
      };

      // Test different chains
      const localhostConfig = createVaultConfigFromRegistry(vault, 31337);
      expect(localhostConfig.chain).toBe("Localhost");

      const testnetConfig = createVaultConfigFromRegistry(vault, 57054);
      expect(testnetConfig.chain).toBe("Sonic Blaze Testnet");

      const mainnetConfig = createVaultConfigFromRegistry(vault, 146);
      expect(mainnetConfig.chain).toBe("Sonic");
    });
  });

  describe("Token Architecture", () => {
    it("should separate infrastructure tokens from vault tokens", () => {
      const infrastructure = getDeploymentAddresses(57054);

      // Infrastructure tokens
      expect(infrastructure?.networkTokens).toBeDefined();
      expect(infrastructure?.networkTokens.rewardToken).toBeDefined(); // METRO for rewards
      expect(infrastructure?.networkTokens.wrappedNative).toBeDefined(); // wS

      // But wS and METRO can also be vault tokens
      const vaultWithInfraTokens: RegistryVaultInfo = {
        vault: "0xVault",
        rewardClaimer: "0xRC",
        queueHandler: "0xQH",
        feeManager: "0xFM",
        tokenX: infrastructure!.networkTokens.wrappedNative, // wS as vault token
        tokenY: infrastructure!.networkTokens.rewardToken, // METRO as vault token
        name: "wS-METRO Vault",
        symbol: "WS-METRO",
        isActive: true,
      };

      const config = createVaultConfigFromRegistry(vaultWithInfraTokens, 57054);

      // Should recognize them as vault tokens
      expect(config.tokenX.symbol).toBe("wS");
      expect(config.tokenY.symbol).toBe("METRO");
      expect(config.tokenX.address).toBe(
        infrastructure!.networkTokens.wrappedNative,
      );
      expect(config.tokenY.address).toBe(
        infrastructure!.networkTokens.rewardToken,
      );
    });

    it("should not assume token positions", () => {
      const registryVaults: RegistryVaultInfo[] = [
        {
          vault: "0xVault1",
          rewardClaimer: "0xRC1",
          queueHandler: "0xQH1",
          feeManager: "0xFM1",
          tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS as tokenX
          tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e as tokenY
          name: "Vault 1",
          symbol: "V1",
          isActive: true,
        },
        {
          vault: "0xVault2",
          rewardClaimer: "0xRC2",
          queueHandler: "0xQH2",
          feeManager: "0xFM2",
          tokenX: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e as tokenX
          tokenY: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS as tokenY
          name: "Vault 2",
          symbol: "V2",
          isActive: true,
        },
      ];

      const configs = getActiveVaultConfigs(registryVaults, 31337);

      // First vault: wS-USDC.e
      expect(configs[0].tokenX.symbol).toBe("wS");
      expect(configs[0].tokenY.symbol).toBe("USDC.e");

      // Second vault: USDC.e-wS (reversed)
      expect(configs[1].tokenX.symbol).toBe("USDC.e");
      expect(configs[1].tokenY.symbol).toBe("wS");
    });
  });
});
