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
  platform: string; // "DLMM", "Shadow Exchange", etc.
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
 * NOTE: This is now deprecated in favor of getVaultConfigsForChain()
 * which dynamically loads configurations based on the current chain.
 *
 * This static array is kept for backward compatibility but will be empty.
 */
export const VAULT_CONFIGS: VaultConfig[] = [
  // Static configurations removed - use getVaultConfigsForChain() instead
];

/**
 * Get vault configuration by address
 */
export const getVaultConfig = (
  address: string,
  chainId: number,
): VaultConfig | undefined => {
  if (!chainId) {
    console.warn("No chainId provided to getVaultConfig");
    return undefined;
  }
  const configs = getVaultConfigsForChain(chainId);
  return configs.find(
    (config) => config.address.toLowerCase() === address.toLowerCase(),
  );
};

/**
 * Get all active vault configurations - now uses dynamic loading
 *
 * @param chainId - The chain ID to get configurations for. If not provided,
 *                  will attempt to use a reasonable default.
 */
export const getActiveVaultConfigs = (chainId: number): VaultConfig[] => {
  if (!chainId) {
    console.warn("No chainId provided to getActiveVaultConfigs");
    return [];
  }
  return getVaultConfigsForChain(chainId);
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
    console.warn(`No contracts available for chain ${chainId}`);
    return [];
  }

  // Get chain-specific names and settings
  const getChainInfo = (chainId: number) => {
    switch (chainId) {
      case 31337:
        return { name: "Localhost", testnet: true };
      case 31338:
        return { name: "Sonic Fork", testnet: true };
      case 146:
        return { name: "Sonic", testnet: false };
      default:
        return { name: "Unknown", testnet: true };
    }
  };

  const chainInfo = getChainInfo(chainId);

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
      platform: "DLMM",
      chain: chainInfo.name,
      isActive: true,
      description: `Automated liquidity provision for wS-USDC.e pair with Metro reward compounding${chainInfo.testnet ? " (Test Network)" : ""}`,
    },
    // Future: Auto-discover additional vaults from on-chain registry
    // Future: Add METRO-USDC vault when available
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
