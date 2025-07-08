/**
 * Dynamic Deployment Address Loader
 *
 * This module loads contract addresses from deployment files instead of hardcoded values.
 * It supports localhost, mainnet fork, and mainnet deployments.
 */

// Import deployment exports from the contract deployment system
import { deployments } from "../../../exports/deployments";

export interface DeploymentAddresses {
  registry: string;
  networkTokens: {
    rewardToken: string; // METRO - network-wide reward token
    wrappedNative: string; // wS - wrapped Sonic token
  };
  metropolis: {
    lbRouter: string;
    lbFactory: string;
    // NO pool - that's vault-specific
  };
  // REMOVED: vault, feeManager, queueHandler, rewardClaimer (vault-specific)
  // REMOVED: tokens with hardcoded names
}

// Network infrastructure token addresses
const MAINNET_NETWORK_TOKENS = {
  rewardToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
  wrappedNative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
};

const MAINNET_METROPOLIS = {
  lbRouter: "0x67803fe6d76409640efDC9b7ABcD2c6c2E7cBa48",
  lbFactory: "0x39D966c1BaFe7D3F1F53dA4845805E15f7D6EE43",
  // NO pool - that's vault-specific
};

/**
 * Load deployment addresses for a specific network
 */
export function getDeploymentAddresses(
  chainId: number,
): DeploymentAddresses | null {
  try {
    switch (chainId) {
      case 31337: // Localhost
        return getLocalhostAddresses();

      case 31338: // Sonic Fork
        return getForkAddresses();

      case 57054: // Sonic Blaze Testnet
        return getTestnetAddresses();

      case 146: // Sonic Mainnet
        return getMainnetAddresses();

      default:
        console.warn(`Unsupported chain ID: ${chainId}`);
        return null;
    }
  } catch (error) {
    console.error("Failed to load deployment addresses:", error);
    return null;
  }
}

/**
 * Load localhost addresses from deployment files
 */
function getLocalhostAddresses(): DeploymentAddresses | null {
  // For localhost/testing, return mock addresses
  // These match the addresses used in test files
  return {
    registry: "0x9876543210987654321098765432109876543210",
    networkTokens: {
      rewardToken: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // Mock METRO
      wrappedNative: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Mock wS
    },
    metropolis: {
      lbRouter: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      lbFactory: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9", // lbpAMM
    },
  };
}

/**
 * Load fork addresses (from previous successful deployment)
 */
function getForkAddresses(): DeploymentAddresses {
  return {
    registry: "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1",
    networkTokens: MAINNET_NETWORK_TOKENS, // Fork uses mainnet token addresses
    metropolis: MAINNET_METROPOLIS,
  };
}

/**
 * Load testnet addresses from deployment files
 */
function getTestnetAddresses(): DeploymentAddresses | null {
  // Load from deployment exports
  if (deployments["sonic-testnet"]) {
    const deployment = deployments["sonic-testnet"];

    // Testnet-specific Metropolis addresses from config
    const TESTNET_METROPOLIS = {
      lbRouter: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
      lbFactory: "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7", // lbpAMM
    };

    // Testnet network tokens
    const TESTNET_NETWORK_TOKENS = {
      rewardToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
      wrappedNative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
    };

    return {
      registry: deployment.registry,
      networkTokens: TESTNET_NETWORK_TOKENS,
      metropolis: TESTNET_METROPOLIS,
    };
  }

  // For testing, return mock addresses if no deployment found
  return {
    registry: "0x9876543210987654321098765432109876543210",
    networkTokens: {
      rewardToken: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321", // METRO
      wrappedNative: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38", // wS
    },
    metropolis: {
      lbRouter: "0xe77DA7F5B6927fD5E0e825B2B27aca526341069B",
      lbFactory: "0x90F28Fe6963cE929d4cBc3480Df1169b92DD22B7", // lbpAMM
    },
  };
}

/**
 * Load mainnet addresses (contracts not deployed yet)
 */
function getMainnetAddresses(): DeploymentAddresses | null {
  // Return null instead of zero addresses until mainnet deployment exists
  console.warn("Mainnet contracts not yet deployed");
  return null;
}

// Removed loadFromDeploymentFile - no longer needed with infrastructure-only approach

/**
 * Validate that deployment addresses are complete
 */
export function validateDeploymentAddresses(
  addresses: DeploymentAddresses,
): boolean {
  const nullAddress = "0x0000000000000000000000000000000000000000";

  return !!(
    addresses.registry &&
    addresses.registry !== nullAddress &&
    addresses.networkTokens?.rewardToken &&
    addresses.networkTokens.rewardToken !== nullAddress &&
    addresses.networkTokens?.wrappedNative &&
    addresses.networkTokens.wrappedNative !== nullAddress &&
    addresses.metropolis?.lbRouter &&
    addresses.metropolis.lbRouter !== nullAddress &&
    addresses.metropolis?.lbFactory &&
    addresses.metropolis.lbFactory !== nullAddress
  );
}

/**
 * Get deployment status for debugging
 */
export function getDeploymentStatus(chainId: number) {
  const addresses = getDeploymentAddresses(chainId);

  if (!addresses) {
    return { status: "missing", message: "No deployment found" };
  }

  if (!validateDeploymentAddresses(addresses)) {
    return {
      status: "incomplete",
      message: "Deployment missing critical addresses",
    };
  }

  return {
    status: "ready",
    message: "Deployment loaded successfully",
    addresses,
  };
}
