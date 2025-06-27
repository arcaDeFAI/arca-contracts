/**
 * Central Vault Configuration System
 *
 * This file defines all supported vault types and their metadata.
 * Adding new vaults is as simple as adding a new configuration here.
 */

export interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
  coingeckoId?: string; // For price fetching
}

export interface VaultConfig {
  address: string;
  tokenX: TokenConfig; // First token in the pair
  tokenY: TokenConfig; // Second token in the pair
  name: string; // Display name like "wS-USDC.e"
  platform: string; // "Arca DLMM", "Shadow Exchange", etc.
  chain: string; // "Sonic", "Sonic Fork", etc.
  isActive: boolean;
  description?: string;
  // Future: Add APR calculation specifics, fee structures, etc.
}

// Import contract addresses from deployment data
import { getContracts } from "./contracts";

/**
 * Vault Configurations for Different Networks
 *
 * Each entry represents a deployed vault contract with its token pair configuration.
 * This makes it easy to support multiple vaults with different token pairs.
 */

// Get current network contracts (this will be dynamic based on chainId)
const contracts = getContracts(31337); // Default to fork for now

export const VAULT_CONFIGS: VaultConfig[] = [
  {
    address: contracts?.vault || "0x0000000000000000000000000000000000000000",
    tokenX: {
      symbol: "wS",
      address:
        contracts?.tokens.wS || "0x0000000000000000000000000000000000000000",
      decimals: 18,
      coingeckoId: "sonic", // Hypothetical - replace with actual if available
    },
    tokenY: {
      symbol: "USDC.e",
      address:
        contracts?.tokens.usdce || "0x0000000000000000000000000000000000000000",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    name: "wS-USDC.e",
    platform: "Arca DLMM",
    chain: "Sonic Fork", // Will be dynamic based on chainId
    isActive: true,
    description:
      "Automated liquidity provision for wS-USDC.e pair with Metro reward compounding",
  },

  // Future vault configurations can be added here:
  // {
  //   address: "0x...", // wS-METRO vault
  //   tokenX: { symbol: "wS", address: "0x...", decimals: 18 },
  //   tokenY: { symbol: "METRO", address: "0x...", decimals: 18 },
  //   name: "wS-METRO",
  //   platform: "Arca DLMM",
  //   chain: "Sonic",
  //   isActive: true
  // },
  // {
  //   address: "0x...", // METRO-USDC vault
  //   tokenX: { symbol: "METRO", address: "0x...", decimals: 18 },
  //   tokenY: { symbol: "USDC", address: "0x...", decimals: 6 },
  //   name: "METRO-USDC",
  //   platform: "Arca DLMM",
  //   chain: "Sonic",
  //   isActive: true
  // }
];

/**
 * Get vault configuration by address
 */
export const getVaultConfig = (address: string): VaultConfig | undefined => {
  return VAULT_CONFIGS.find(
    (config) => config.address.toLowerCase() === address.toLowerCase(),
  );
};

/**
 * Get all active vault configurations
 */
export const getActiveVaultConfigs = (): VaultConfig[] => {
  return VAULT_CONFIGS.filter((config) => config.isActive);
};

/**
 * Get vault configurations by chain
 */
export const getVaultConfigsByChain = (chain: string): VaultConfig[] => {
  return VAULT_CONFIGS.filter(
    (config) => config.chain === chain && config.isActive,
  );
};

/**
 * Get vault configuration by token pair
 */
export const getVaultConfigByTokens = (
  tokenXSymbol: string,
  tokenYSymbol: string,
): VaultConfig | undefined => {
  return VAULT_CONFIGS.find(
    (config) =>
      (config.tokenX.symbol === tokenXSymbol &&
        config.tokenY.symbol === tokenYSymbol) ||
      (config.tokenX.symbol === tokenYSymbol &&
        config.tokenY.symbol === tokenXSymbol),
  );
};

/**
 * Generate vault configurations dynamically for different networks
 * This function will be called when the user switches networks
 */
export const getVaultConfigsForChain = (chainId: number): VaultConfig[] => {
  const networkContracts = getContracts(chainId);

  if (!networkContracts) {
    return [];
  }

  const chainName = chainId === 146 ? "Sonic" : "Sonic Fork";

  return [
    {
      address: networkContracts.vault,
      tokenX: {
        symbol: "wS",
        address: networkContracts.tokens.wS,
        decimals: 18,
        coingeckoId: "sonic",
      },
      tokenY: {
        symbol: "USDC.e",
        address: networkContracts.tokens.usdce,
        decimals: 6,
        coingeckoId: "usd-coin",
      },
      name: "wS-USDC.e",
      platform: "Arca DLMM",
      chain: chainName,
      isActive: true,
      description:
        "Automated liquidity provision for wS-USDC.e pair with Metro reward compounding",
    },
    // Future: Auto-discover additional vaults from on-chain registry
  ];
};

/**
 * Validate that a vault configuration is complete and valid
 */
export const validateVaultConfig = (config: VaultConfig): boolean => {
  return !!(
    config.address &&
    config.tokenX.address &&
    config.tokenY.address &&
    config.name &&
    config.platform &&
    config.chain
  );
};
