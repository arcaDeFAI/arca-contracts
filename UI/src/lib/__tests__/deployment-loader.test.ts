import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getDeploymentAddresses,
  validateDeploymentAddresses,
  getDeploymentStatus,
  type DeploymentAddresses,
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
      registry: "0x9876543210987654321098765432109876543210",
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

describe("deployment-loader - Infrastructure vs Vault Tokens Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Network Infrastructure Tokens", () => {
    it("should provide network infrastructure tokens separately", () => {
      // Act
      const deployment = getDeploymentAddresses(31337);

      // Assert
      expect(deployment).toBeDefined();

      // Should have network-wide tokens
      expect(deployment?.networkTokens).toBeDefined();
      expect(deployment?.networkTokens?.rewardToken).toBeDefined(); // METRO
      expect(deployment?.networkTokens?.wrappedNative).toBeDefined(); // wS

      // Should NOT have vault-specific token structure
      expect("tokens" in deployment!).toBe(false);

      // The old structure should not exist
      const deploymentStr = JSON.stringify(deployment);
      expect(deploymentStr).not.toContain('"tokens":{"wS"');
      expect(deploymentStr).not.toContain('"tokens":{"usdce"');
    });

    it("should not mix infrastructure with vault configuration", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert - Infrastructure only
      expect(deployment).toBeDefined();
      expect(deployment?.registry).toBeDefined();

      // Network tokens are infrastructure
      expect(deployment?.networkTokens).toBeDefined();
      expect(deployment?.networkTokens?.rewardToken).toBeDefined();
      expect(deployment?.networkTokens?.wrappedNative).toBeDefined();

      // Metropolis infrastructure
      expect(deployment?.metropolis).toBeDefined();
      expect(deployment?.metropolis?.lbRouter).toBeDefined();
      expect(deployment?.metropolis?.lbFactory).toBeDefined();

      // NO vault-specific data
      expect("pool" in deployment!.metropolis).toBe(false); // Pool is vault-specific

      // Vault-specific contracts should be obtained from registry
      expect("vault" in deployment!).toBe(false);
      expect("feeManager" in deployment!).toBe(false);
      expect("queueHandler" in deployment!).toBe(false);
      expect("rewardClaimer" in deployment!).toBe(false);
    });

    it("should support vaults with any token pair", () => {
      // Act
      const deployment = getDeploymentAddresses(31337);
      const jsonStr = JSON.stringify(deployment);

      // Assert - Should not contain vault-specific token references
      expect(jsonStr).not.toContain('"tokenX"');
      expect(jsonStr).not.toContain('"tokenY"');
      expect(jsonStr).not.toContain('"usdce"'); // Specific token, not infrastructure

      // Should not make assumptions about which tokens vaults use
      expect(jsonStr).not.toContain("wS-USDC.e");
      expect(jsonStr).not.toContain("vault-specific");
    });
  });

  describe("Infrastructure Token Addresses", () => {
    it("should have correct METRO address for testnet", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert - METRO is the reward token
      expect(deployment?.networkTokens?.rewardToken).toBe(
        "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
      );
    });

    it("should have correct wrapped native (wS) address for testnet", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert - wS is the wrapped native token
      expect(deployment?.networkTokens?.wrappedNative).toBe(
        "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
      );
    });

    it("should have correct Metropolis infrastructure for testnet", () => {
      // Act
      const deployment = getDeploymentAddresses(57054);

      // Assert
      expect(deployment?.metropolis?.lbRouter).toBe(
        "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
      );
      expect(deployment?.metropolis?.lbFactory).toBe(
        "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7",
      );
    });
  });

  describe("Registry as Source of Truth", () => {
    it("should provide registry address for vault discovery", () => {
      // Act
      const localhostDeployment = getDeploymentAddresses(31337);
      const testnetDeployment = getDeploymentAddresses(57054);

      // Assert - Registry is the entry point for vault discovery
      expect(localhostDeployment?.registry).toBeDefined();
      expect(testnetDeployment?.registry).toBe(
        "0x9876543210987654321098765432109876543210",
      );
    });

    it("should not include individual vault addresses", () => {
      // Act
      const deployment = getDeploymentAddresses(31337);

      // Assert - These should come from registry, not deployment
      expect("vault" in deployment!).toBe(false);
      expect("vaults" in deployment!).toBe(false);
      expect("vaultAddresses" in deployment!).toBe(false);
    });
  });

  describe("Clean Architecture Validation", () => {
    it("should validate infrastructure-only addresses", () => {
      // Arrange - Infrastructure-only deployment
      const validDeployment = {
        registry: "0xRegistry",
        networkTokens: {
          rewardToken: "0xMETRO",
          wrappedNative: "0xwS",
        },
        metropolis: {
          lbRouter: "0xRouter",
          lbFactory: "0xFactory",
        },
      };

      // Act & Assert
      expect(
        validateDeploymentAddresses(validDeployment as DeploymentAddresses),
      ).toBe(true);
    });

    it("should reject deployment with null addresses", () => {
      // Arrange
      const invalidDeployment = {
        registry: "0x0000000000000000000000000000000000000000",
        networkTokens: {
          rewardToken: "0xMETRO",
          wrappedNative: "0xwS",
        },
        metropolis: {
          lbRouter: "0xRouter",
          lbFactory: "0xFactory",
        },
      };

      // Act & Assert
      expect(
        validateDeploymentAddresses(invalidDeployment as DeploymentAddresses),
      ).toBe(false);
    });
  });

  describe("Deployment Status", () => {
    it("should report ready status with infrastructure-only deployment", () => {
      // Act
      const localhostStatus = getDeploymentStatus(31337);
      const testnetStatus = getDeploymentStatus(57054);

      // Assert - Infrastructure ready is sufficient
      expect(localhostStatus.status).toBe("ready");
      expect(testnetStatus.status).toBe("ready");

      // Should not require vault-specific addresses for ready status
      expect(localhostStatus.addresses).toBeDefined();
      expect(localhostStatus.addresses?.registry).toBeDefined();
      expect(localhostStatus.addresses?.networkTokens).toBeDefined();
    });
  });

  describe("Token Agnostic Support", () => {
    it("should not hardcode any vault token pairs", () => {
      // Act
      const deployment = getDeploymentAddresses(31337);
      const deploymentStr = JSON.stringify(deployment);

      // Assert - No hardcoded pairs
      expect(deploymentStr).not.toContain("wS/USDC.e");
      expect(deploymentStr).not.toContain("METRO/USDC.e");
      expect(deploymentStr).not.toContain("wS/METRO");

      // Infrastructure tokens are labeled as such
      expect(deployment?.networkTokens?.rewardToken).toBeDefined();
      expect(deployment?.networkTokens?.wrappedNative).toBeDefined();
    });

    it("should support any token being tokenX or tokenY", () => {
      // This test verifies the architecture supports flexibility
      const deployment = getDeploymentAddresses(31337);

      // wS can be tokenX OR tokenY in different vaults
      // METRO can be tokenX OR tokenY in different vaults
      // USDC.e can be tokenX OR tokenY in different vaults

      // The deployment structure should not make assumptions
      expect("tokenX" in deployment!).toBe(false);
      expect("tokenY" in deployment!).toBe(false);

      // Only infrastructure tokens are defined
      expect(deployment?.networkTokens).toBeDefined();
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain registry address for existing code", () => {
      // The registry is still needed
      const deployment = getDeploymentAddresses(31337);
      expect(deployment?.registry).toBeDefined();
    });
  });
});
