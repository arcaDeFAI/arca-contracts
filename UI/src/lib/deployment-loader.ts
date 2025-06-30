/**
 * Dynamic Deployment Address Loader
 *
 * This module loads contract addresses from deployment files instead of hardcoded values.
 * It supports localhost, mainnet fork, and mainnet deployments.
 */

// Import deployment exports from the contract deployment system
import { deployments } from "../../../exports/deployments";

export interface DeploymentAddresses {
  vault: string;
  feeManager: string;
  queueHandler: string;
  rewardClaimer: string;
  registry: string;
  tokens: Record<string, string>; // Generic token addresses for any token pair
  metropolis: {
    lbRouter: string;
    lbFactory: string;
    pool: string;
  };
}

// Mainnet token addresses (known constants)
const MAINNET_TOKENS = {
  wS: "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38",
  usdce: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  metro: "0x71E99522EaD5E21CF57F1f542Dc4ad2E841F7321",
};

const MAINNET_METROPOLIS = {
  lbRouter: "0x67803fe6d76409640efDC9b7ABcD2c6c2E7cBa48",
  lbFactory: "0x39D966c1BaFe7D3F1F53dA4845805E15f7D6EE43",
  pool: "0x11d899dec22fb03a0047212b1a20a7ad8d699420", // wS/USDC.e pool
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
  // Try to load from deployment exports first
  if (deployments.localhost) {
    const deployment = deployments.localhost;

    // Check if we have a deployment.json file for more complete data
    try {
      // For localhost, we need to read the full deployment data
      return loadFromDeploymentFile("localhost");
    } catch {
      // Fallback to basic export data
      console.warn("Using basic deployment data - some features may not work");
      // Validate that all required addresses are present
      if (
        !deployment.vault ||
        !deployment.registry ||
        !deployment.feeManager ||
        !deployment.queueHandler ||
        !deployment.rewardClaimer
      ) {
        console.error(
          "Missing required contract addresses in deployment export",
        );
        return null;
      }

      return {
        vault: deployment.vault,
        feeManager: deployment.feeManager,
        queueHandler: deployment.queueHandler,
        rewardClaimer: deployment.rewardClaimer,
        registry: deployment.registry,
        tokens: {
          wS: deployment.config.tokenX,
          usdce: deployment.config.tokenY,
          metro: "0x0000000000000000000000000000000000000000", // Mock token
        },
        metropolis: {
          lbRouter: "0x0000000000000000000000000000000000000000", // Mock
          lbFactory: "0x0000000000000000000000000000000000000000",
          pool: "0x0000000000000000000000000000000000000000",
        },
      };
    }
  }

  console.warn("No localhost deployment found");
  return null;
}

/**
 * Load fork addresses (from previous successful deployment)
 */
function getForkAddresses(): DeploymentAddresses {
  return {
    vault: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    feeManager: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    queueHandler: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
    rewardClaimer: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
    registry: "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1",
    tokens: MAINNET_TOKENS, // Fork uses mainnet token addresses
    metropolis: MAINNET_METROPOLIS,
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

/**
 * Load full deployment data from deployment JSON files
 * This requires reading the actual deployment files with complete contract addresses
 */
function loadFromDeploymentFile(network: string): DeploymentAddresses {
  // This would ideally read from ../../../deployments/{network}/latest.json
  // For now, we'll implement a basic version and can enhance later

  if (network === "localhost") {
    // Use the actual addresses from the latest deployment (from exports/deployments.ts)
    if (deployments.localhost) {
      const deployment = deployments.localhost;
      return {
        vault: deployment.vault,
        feeManager: deployment.feeManager,
        queueHandler: deployment.queueHandler,
        rewardClaimer: deployment.rewardClaimer,
        registry: deployment.registry,
        tokens: {
          wS: deployment.config.tokenX, // Use actual deployed tokenX
          usdce: deployment.config.tokenY, // Use actual deployed tokenY
          metro: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // rewardToken from deployment
        },
        metropolis: {
          lbRouter: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
          lbFactory: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9", // lbpAMM
          pool: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9", // lbpContract
        },
      };
    }
  }

  throw new Error(`No deployment file found for network: ${network}`);
}

/**
 * Validate that deployment addresses are complete
 */
export function validateDeploymentAddresses(
  addresses: DeploymentAddresses,
): boolean {
  const nullAddress = "0x0000000000000000000000000000000000000000";

  return !!(
    (
      addresses.vault &&
      addresses.vault !== nullAddress &&
      addresses.tokens.wS &&
      addresses.tokens.wS !== nullAddress &&
      addresses.tokens.usdce &&
      addresses.tokens.usdce !== nullAddress
    )
    // Other addresses can be null for testing
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
