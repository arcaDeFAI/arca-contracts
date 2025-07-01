import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RegistryVaultInfo } from "../../hooks/use-vault-registry";

// Mock the contracts module
vi.mock("../contracts", () => ({
  getContracts: vi.fn(),
}));

// Import after mocks
import {
  createVaultConfigFromRegistry,
  getTokenSymbol,
  getTokenDecimals,
  getActiveVaultConfigs,
  VaultConfig,
} from "../vault-configs";
import { getContracts } from "../contracts";
import type { Mock } from "vitest";

describe("vault-configs - True Token-Agnostic Support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Registry-Based Vault Configuration", () => {
    it("should create config from registry data without assumptions", () => {
      // Arrange - Mock registry vault info
      const vaultInfo: RegistryVaultInfo = {
        vault: "0xVault1",
        rewardClaimer: "0xRewardClaimer1",
        queueHandler: "0xQueueHandler1",
        feeManager: "0xFeeManager1",
        tokenX: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO as tokenX
        tokenY: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894", // USDC.e as tokenY
        name: "Arca METRO-USDC.e Vault",
        symbol: "ARCA-METRO-USDC",
        isActive: true,
      };

      // Mock network infrastructure
      (getContracts as Mock).mockReturnValue({
        registry: "0xRegistry",
        networkTokens: {
          rewardToken: "0xMETRO",
          wrappedNative: "0xwS",
        },
        metropolis: {
          lbRouter: "0xRouter",
          lbFactory: "0xFactory",
        },
      });

      // Act
      const config = createVaultConfigFromRegistry(vaultInfo, 31337);

      // Assert - Should use exact tokens from registry
      expect(config.tokenX.address).toBe(
        "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
      );
      expect(config.tokenY.address).toBe(
        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
      );
      expect(config.name).toBe("Arca METRO-USDC.e Vault");

      // Should NOT assume wS/USDC.e
      expect(config.tokenX.symbol).toBe("METRO");
      expect(config.tokenX.symbol).not.toBe("wS");
    });

    it("should support wS as tokenY (not always tokenX)", () => {
      // Arrange
      const vaultInfo: RegistryVaultInfo = {
        vault: "0xVault2",
        rewardClaimer: "0xRewardClaimer2",
        queueHandler: "0xQueueHandler2",
        feeManager: "0xFeeManager2",
        tokenX: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
        tokenY: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS can be tokenY too!
        name: "Arca METRO-wS Vault",
        symbol: "ARCA-METRO-WS",
        isActive: true,
      };

      // Act
      const config = createVaultConfigFromRegistry(vaultInfo, 31337);

      // Assert
      expect(config.tokenY.address).toBe(
        "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      );
      expect(config.tokenY.symbol).toBe("wS");
      expect(config.name).toBe("Arca METRO-wS Vault");
    });

    it("should support any arbitrary token pair", () => {
      // Arrange - Test various token pairs
      const vaultInfos: RegistryVaultInfo[] = [
        {
          vault: "0xVault3",
          rewardClaimer: "0xRC3",
          queueHandler: "0xQH3",
          feeManager: "0xFM3",
          tokenX: "0xAAA",
          tokenY: "0xBBB",
          name: "Arca AAA-BBB Vault",
          symbol: "ARCA-AAA-BBB",
          isActive: true,
        },
        {
          vault: "0xVault4",
          rewardClaimer: "0xRC4",
          queueHandler: "0xQH4",
          feeManager: "0xFM4",
          tokenX: "0xCCC",
          tokenY: "0xDDD",
          name: "Arca CCC-DDD Vault",
          symbol: "ARCA-CCC-DDD",
          isActive: true,
        },
      ];

      // Act & Assert
      vaultInfos.forEach((vaultInfo) => {
        const config = createVaultConfigFromRegistry(vaultInfo, 31337);
        expect(config.tokenX.address).toBe(vaultInfo.tokenX);
        expect(config.tokenY.address).toBe(vaultInfo.tokenY);
        expect(config.address).toBe(vaultInfo.vault);
      });
    });
  });

  describe("Token Symbol Discovery", () => {
    it("should determine token symbols from addresses", () => {
      // Arrange
      const tokenAddresses = {
        "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321": "METRO",
        "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38": "wS",
        "0x29219dd400f2Bf60E5a23d13Be72B486D4038894": "USDC.e",
        "0xCustomToken": "CUSTOM",
      };

      // Act & Assert
      Object.entries(tokenAddresses).forEach(([address, expectedSymbol]) => {
        const symbol = getTokenSymbol(address);
        if (expectedSymbol === "CUSTOM") {
          // Unknown tokens should return a default
          expect(symbol).toMatch(/^TOKEN-[A-Z0-9]+$/); // TOKEN- prefix for unknown
        } else {
          expect(symbol).toBe(expectedSymbol);
        }
      });
    });

    it("should handle case-insensitive token addresses", () => {
      // Act & Assert
      expect(getTokenSymbol("0x71e99522ead5e21cf57f1f542dc4ad2e841f7321")).toBe(
        "METRO",
      );
      expect(getTokenSymbol("0x039E2FB66102314CE7B64CE5CE3E5183BC94AD38")).toBe(
        "wS",
      );
    });
  });

  describe("Token Decimals", () => {
    it("should return correct decimals for known tokens", () => {
      // Assert
      expect(
        getTokenDecimals("0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321"),
      ).toBe(18); // METRO
      expect(
        getTokenDecimals("0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38"),
      ).toBe(18); // wS
      expect(
        getTokenDecimals("0x29219dd400f2Bf60E5a23d13Be72B486D4038894"),
      ).toBe(6); // USDC.e
    });

    it("should return default decimals for unknown tokens", () => {
      // Act & Assert
      expect(getTokenDecimals("0xUnknownToken")).toBe(18); // Default
    });
  });

  describe("Active Vault Discovery", () => {
    it("should return vaults from registry without hardcoding", () => {
      // Arrange - Mock multiple registry vaults
      const mockRegistryVaults: RegistryVaultInfo[] = [
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

      // Act
      const configs = getActiveVaultConfigs(mockRegistryVaults, 31337);

      // Assert
      expect(configs).toHaveLength(3);
      expect(configs[0].tokenX.symbol).toBe("wS");
      expect(configs[0].tokenY.symbol).toBe("USDC.e");
      expect(configs[1].tokenX.symbol).toBe("METRO");
      expect(configs[1].tokenY.symbol).toBe("USDC.e");
      expect(configs[2].tokenX.symbol).toBe("wS");
      expect(configs[2].tokenY.symbol).toBe("METRO");
    });

    it("should filter out inactive vaults", () => {
      // Arrange
      const mockRegistryVaults: RegistryVaultInfo[] = [
        {
          vault: "0xVault1",
          rewardClaimer: "0xRC1",
          queueHandler: "0xQH1",
          feeManager: "0xFM1",
          tokenX: "0xTokenX",
          tokenY: "0xTokenY",
          name: "Active Vault",
          symbol: "ACTIVE",
          isActive: true,
        },
        {
          vault: "0xVault2",
          rewardClaimer: "0xRC2",
          queueHandler: "0xQH2",
          feeManager: "0xFM2",
          tokenX: "0xTokenX2",
          tokenY: "0xTokenY2",
          name: "Inactive Vault",
          symbol: "INACTIVE",
          isActive: false,
        },
      ];

      // Act
      const configs = getActiveVaultConfigs(mockRegistryVaults, 31337);

      // Assert
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe("Active Vault");
    });
  });

  describe("Chain Information", () => {
    it("should set correct chain info for different networks", () => {
      // Arrange
      const vaultInfo: RegistryVaultInfo = {
        vault: "0xVault",
        rewardClaimer: "0xRC",
        queueHandler: "0xQH",
        feeManager: "0xFM",
        tokenX: "0xTokenX",
        tokenY: "0xTokenY",
        name: "Test Vault",
        symbol: "TEST",
        isActive: true,
      };

      // Act & Assert
      const localhostConfig = createVaultConfigFromRegistry(vaultInfo, 31337);
      expect(localhostConfig.chain).toBe("Localhost");

      const testnetConfig = createVaultConfigFromRegistry(vaultInfo, 57054);
      expect(testnetConfig.chain).toBe("Sonic Blaze Testnet");

      const mainnetConfig = createVaultConfigFromRegistry(vaultInfo, 146);
      expect(mainnetConfig.chain).toBe("Sonic");
    });
  });

  describe("No Hardcoded Assumptions", () => {
    it("should not contain any hardcoded vault configurations", () => {
      // This test ensures we're not using the old VAULT_CONFIGS array
      // or getVaultConfigsForChain that hardcodes wS/USDC.e

      // Act - Get configs with empty registry
      const configs = getActiveVaultConfigs([], 31337);

      // Assert - Should be empty, not hardcoded vaults
      expect(configs).toEqual([]);
    });

    it("should generate descriptions dynamically based on token pairs", () => {
      // Arrange
      const vaultInfo: RegistryVaultInfo = {
        vault: "0xVault",
        rewardClaimer: "0xRC",
        queueHandler: "0xQH",
        feeManager: "0xFM",
        tokenX: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
        tokenY: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
        name: "Arca METRO-wS Vault",
        symbol: "ARCA-METRO-WS",
        isActive: true,
      };

      // Act
      const config = createVaultConfigFromRegistry(vaultInfo, 31337);

      // Assert
      expect(config.description).toContain("METRO-wS");
      expect(config.description).toContain("Metro reward compounding");
      expect(config.description).not.toContain("wS-USDC.e"); // Not hardcoded
    });
  });
});
