/**
 * Central Vault Configuration System
 *
 * This file creates vault configurations from registry data.
 * It's fully token-agnostic and supports any token pair.
 */

import type { RegistryVaultInfo } from "../hooks/use-vault-registry";
import { getChainName } from "../config/chains";

export interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
  coingeckoId?: string; // For price fetching
}

export interface VaultConfig {
  address: string;
  tokenX: TokenConfig;
  tokenY: TokenConfig;
  name: string;
  platform: string;
  chain: string;
  isActive: boolean;
  description?: string;
}

// Known token information for symbol and decimal resolution
const KNOWN_TOKENS: Record<
  string,
  { symbol: string; decimals: number; coingeckoId?: string }
> = {
  // Network infrastructure tokens
  "0x71e99522ead5e21cf57f1f542dc4ad2e841f7321": {
    symbol: "METRO",
    decimals: 18,
    coingeckoId: "metro",
  },
  "0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38": {
    symbol: "wS",
    decimals: 18,
    coingeckoId: "sonic",
  },
  // Common tokens
  "0x29219dd400f2bf60e5a23d13be72b486d4038894": {
    symbol: "USDC.e",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  "0x1570300e9cfec66c9fb0c8bc14366c86eb170ad0": {
    symbol: "USDC.e",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
};

/**
 * Get token symbol from address
 */
export function getTokenSymbol(address: string): string {
  const normalizedAddress = address.toLowerCase();
  const tokenInfo = KNOWN_TOKENS[normalizedAddress];

  if (tokenInfo) {
    return tokenInfo.symbol;
  }

  // For unknown tokens, return a shortened address as symbol
  return `TOKEN-${address.slice(2, 8).toUpperCase()}`;
}

/**
 * Get token decimals from address
 */
export function getTokenDecimals(address: string): number {
  const normalizedAddress = address.toLowerCase();
  const tokenInfo = KNOWN_TOKENS[normalizedAddress];

  return tokenInfo?.decimals || 18; // Default to 18 decimals
}

/**
 * Get coingecko ID for price fetching
 */
function getCoingeckoId(address: string): string | undefined {
  const normalizedAddress = address.toLowerCase();
  const tokenInfo = KNOWN_TOKENS[normalizedAddress];

  return tokenInfo?.coingeckoId;
}

/**
 * Create vault configuration from registry data
 * This is the main function that creates configs without assumptions
 */
export function createVaultConfigFromRegistry(
  vaultInfo: RegistryVaultInfo,
  chainId: number,
): VaultConfig {
  const tokenXSymbol = getTokenSymbol(vaultInfo.tokenX);
  const tokenYSymbol = getTokenSymbol(vaultInfo.tokenY);

  return {
    address: vaultInfo.vault,
    tokenX: {
      symbol: tokenXSymbol,
      address: vaultInfo.tokenX,
      decimals: getTokenDecimals(vaultInfo.tokenX),
      coingeckoId: getCoingeckoId(vaultInfo.tokenX),
    },
    tokenY: {
      symbol: tokenYSymbol,
      address: vaultInfo.tokenY,
      decimals: getTokenDecimals(vaultInfo.tokenY),
      coingeckoId: getCoingeckoId(vaultInfo.tokenY),
    },
    name: vaultInfo.name,
    platform: "DLMM", // All vaults use Metropolis DLMM
    chain: getChainName(chainId),
    isActive: vaultInfo.isActive,
    description: `Automated liquidity provision for ${tokenXSymbol}-${tokenYSymbol} pair with Metro reward compounding`,
  };
}

/**
 * Get active vault configurations from registry data
 */
export function getActiveVaultConfigs(
  registryVaults: RegistryVaultInfo[],
  chainId: number,
): VaultConfig[] {
  return registryVaults
    .filter((vault) => vault.isActive)
    .map((vault) => createVaultConfigFromRegistry(vault, chainId));
}

/**
 * Get vault configuration by address
 */
export const getVaultConfig = (
  address: string,
  registryVaults: RegistryVaultInfo[],
  chainId: number,
): VaultConfig | undefined => {
  const vaultInfo = registryVaults.find(
    (vault) => vault.vault.toLowerCase() === address.toLowerCase(),
  );

  if (!vaultInfo) {
    return undefined;
  }

  return createVaultConfigFromRegistry(vaultInfo, chainId);
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
