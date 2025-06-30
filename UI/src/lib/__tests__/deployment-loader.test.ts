import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDeploymentAddresses,
  validateDeploymentAddresses,
  getDeploymentStatus,
} from "../deployment-loader";

// Mock the deployments export
vi.mock("../../../../exports/deployments", () => ({
  deployments: {
    localhost: {
      vault: "0xLocalVault",
      registry: "0xLocalRegistry",
      feeManager: "0xLocalFeeManager",
      queueHandler: "0xLocalQueueHandler",
      rewardClaimer: "0xLocalRewardClaimer",
      config: {
        tokenX: "0xLocalTokenX",
        tokenY: "0xLocalTokenY",
      },
    },
    "sonic-testnet": {
      vault: "0xTestnetVault",
      registry: "0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f",
      feeManager: "0xTestnetFeeManager",
      queueHandler: "0xTestnetQueueHandler",
      rewardClaimer: "0xTestnetRewardClaimer",
      config: {
        tokenX: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
        tokenY: "0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0",
      },
    },
  },
}));

describe("deployment-loader - TDD Testnet Support & Registry Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Testnet Support", () => {
    it("should support Sonic Blaze Testnet (chainId 57054)", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert
      expect(deployment).toBeDefined();
      expect(deployment).not.toBeNull();
      expect(deployment?.registry).toBe("0xd8cF609ac86ddE8Bde1d41F53Ed2F94Ba173BF2f");
      expect(deployment?.tokens.wS).toBe("0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38");
      expect(deployment?.tokens.usdce).toBe("0x1570300e9cFEC66c9Fb0C8bc14366C86EB170Ad0");
    });

    it("should have proper Metropolis addresses for testnet", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert
      expect(deployment?.metropolis).toBeDefined();
      expect(deployment?.metropolis.lbRouter).toBeDefined();
      expect(deployment?.metropolis.lbFactory).toBeDefined();
      expect(deployment?.metropolis.pool).toBeDefined();
      // Testnet should have real contract addresses, not null addresses
      expect(deployment?.metropolis.lbRouter).not.toBe("0x0000000000000000000000000000000000000000");
    });
  });

  describe("Registry-Based Architecture", () => {
    it("should return infrastructure only, not vault-specific addresses", () => {
      // Act
      const localhostDeployment = getDeploymentAddresses(31337);
      const testnetDeployment = getDeploymentAddresses(57054);
      const mainnetDeployment = getDeploymentAddresses(146);

      // Assert - all deployments should have registry
      expect(localhostDeployment?.registry).toBeDefined();
      expect(testnetDeployment?.registry).toBeDefined();
      
      // Registry should be the source of vault discovery
      // The deployment should still include vault address for backward compatibility
      // but in the future this will be removed
      expect(localhostDeployment?.vault).toBeDefined(); // For now, kept for compatibility
    });

    it("should provide network infrastructure for dynamic vault discovery", () => {
      // Act
      const deployment = getDeploymentAddresses(31337);

      // Assert - should have infrastructure needed for vault operations
      expect(deployment).toMatchObject({
        registry: expect.any(String),
        metropolis: {
          lbRouter: expect.any(String),
          lbFactory: expect.any(String),
          pool: expect.any(String),
        },
        tokens: expect.any(Object),
      });
    });
  });

  describe("Deployment Validation", () => {
    it("should validate complete deployment addresses", () => {
      // Arrange
      const validDeployment = {
        vault: "0xVault",
        feeManager: "0xFeeManager",
        queueHandler: "0xQueueHandler",
        rewardClaimer: "0xRewardClaimer",
        registry: "0xRegistry",
        tokens: {
          wS: "0xTokenX",
          usdce: "0xTokenY",
          metro: "0xMetro",
        },
        metropolis: {
          lbRouter: "0xRouter",
          lbFactory: "0xFactory",
          pool: "0xPool",
        },
      };

      // Act & Assert
      expect(validateDeploymentAddresses(validDeployment)).toBe(true);
    });

    it("should reject deployment with null addresses", () => {
      // Arrange
      const invalidDeployment = {
        vault: "0x0000000000000000000000000000000000000000",
        feeManager: "0xFeeManager",
        queueHandler: "0xQueueHandler",
        rewardClaimer: "0xRewardClaimer",
        registry: "0xRegistry",
        tokens: {
          wS: "0xTokenX",
          usdce: "0xTokenY",
          metro: "0xMetro",
        },
        metropolis: {
          lbRouter: "0xRouter",
          lbFactory: "0xFactory",
          pool: "0xPool",
        },
      };

      // Act & Assert
      expect(validateDeploymentAddresses(invalidDeployment)).toBe(false);
    });
  });

  describe("Deployment Status", () => {
    it("should return ready status for supported networks", () => {
      // Act
      const localhostStatus = getDeploymentStatus(31337);
      const testnetStatus = getDeploymentStatus(57054);

      // Assert
      expect(localhostStatus.status).toBe("ready");
      expect(testnetStatus.status).toBe("ready");
      expect(localhostStatus.addresses).toBeDefined();
      expect(testnetStatus.addresses).toBeDefined();
    });

    it("should return missing status for unsupported networks", () => {
      // Act
      const unsupportedStatus = getDeploymentStatus(999);

      // Assert
      expect(unsupportedStatus.status).toBe("missing");
      expect(unsupportedStatus.message).toBe("No deployment found");
    });

    it("should return missing status for mainnet (not deployed yet)", () => {
      // Act
      const mainnetStatus = getDeploymentStatus(146);

      // Assert
      expect(mainnetStatus.status).toBe("missing");
      expect(mainnetStatus.message).toBe("No deployment found");
    });
  });

  describe("Network Infrastructure Functions", () => {
    it("should provide function to get network infrastructure", () => {
      // This test verifies the architecture supports getting just infrastructure
      // without vault-specific addresses
      const deployment = getDeploymentAddresses(31337);
      
      // Should be able to extract network infrastructure
      const infrastructure = {
        registry: deployment?.registry,
        metropolis: deployment?.metropolis,
        // Note: tokens might be network-specific (wrapped versions)
      };

      expect(infrastructure.registry).toBeDefined();
      expect(infrastructure.metropolis).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain backward compatibility with existing UI code", () => {
      // The deployment should still work with existing code that expects vault address
      const deployment = getDeploymentAddresses(31337);

      // These fields should still exist for now
      expect(deployment?.vault).toBeDefined();
      expect(deployment?.feeManager).toBeDefined();
      expect(deployment?.queueHandler).toBeDefined();
      expect(deployment?.rewardClaimer).toBeDefined();
    });
  });
});