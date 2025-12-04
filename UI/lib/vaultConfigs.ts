/**
 * Centralized vault configuration for all vaults across the application
 * Single source of truth for vault addresses, strategies, and metadata
 */

// Tier types - supports all possible vault tiers
export type VaultTier = 'Active' | 'Premium' | 'Elite' | 'Standard';

// Base configuration shared by all vaults
type BaseVaultConfig = {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: VaultTier;
  tokenX: string;
  tokenY: string;
  // Optional fields that any vault might have
  poolSymbol?: string; // DeFi Llama pool ID
  rewardsAddress?: string;
};

// Protocol-specific vault configurations using discriminated unions
export type MetropolisVaultConfig = BaseVaultConfig & {
  protocol: 'metropolis';
  lbBookAddress: string;
  clpoolAddress?: never; // Metropolis vaults don't have this
};

export type ShadowVaultConfig = BaseVaultConfig & {
  protocol: 'shadow';
  clpoolAddress: string;
  lbBookAddress?: never; // Shadow vaults don't have this
};

// Union type for all vault configs
export type VaultConfig = MetropolisVaultConfig | ShadowVaultConfig;

/**
 * All active vault configurations
 * This is the single source of truth for vault data across the application
 */
export const VAULT_CONFIGS: VaultConfig[] = [
  // Metropolis Vaults
  {
    protocol: 'metropolis',
    vaultAddress: '0xF5708969da13879d7A6D2F21d0411BF9eEB045E9',
    stratAddress: '0x20302bc08CcaAFB039916e4a06f0B3917506019a',
    lbBookAddress: '0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC',
    name: 'S • USDC | Metropolis',
    tier: 'Premium',
    tokenX: 'S',
    tokenY: 'USDC',
  },

  // Shadow Vaults
  {
    protocol: 'shadow',
    vaultAddress: '0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5',
    stratAddress: '0x64efeA2531f2b1A3569555084B88bb5714f5286c',
    clpoolAddress: '0x324963c267C354c7660Ce8CA3F5f167E05649970',
    rewardsAddress: '0xe879d0E44e6873cf4ab71686055a4f6817685f02', // S-USDC uses old rewards contract
    poolSymbol: 'bfb130df-7dd3-4f19-a54c-305c8cb6c9f0', // DeFi Llama pool ID
    name: 'wS • USDC | Shadow',
    tier: 'Premium',
    tokenX: 'WS',
    tokenY: 'USDC',
  },
  {
    protocol: 'shadow',
    vaultAddress: '0xB6a8129779E57845588Db74435A9aFAE509e1454',
    stratAddress: '0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126',
    clpoolAddress: '0xb6d9b069f6b96a507243d501d1a23b3fccfc85d3',
    rewardsAddress: '0xf5c7598c953e49755576cda6b2b2a9daaf89a837', // WS-WETH uses new rewards contract
    poolSymbol: 'e50ce450-d2b8-45fe-b496-9ee1fb5673c2', // DeFi Llama pool ID
    name: 'WS • WETH | Shadow',
    tier: 'Premium',
    tokenX: 'WS',
    tokenY: 'WETH',
  },
  {
    protocol: 'shadow',
    vaultAddress: '0xd4083994F3ce977bcb5d3022041D489B162f5B85',
    stratAddress: '0x0806709c30A2999867160A1e4064f29ecCFA4605',
    clpoolAddress: '0x6fb30f3fcb864d49cdff15061ed5c6adfee40b40',
    rewardsAddress: '0x8cdec539ba3d3857ec29b491c78cfb48f5d34f56', // USDC-WETH uses its own rewards contract
    poolSymbol: 'a5ea7bec-91e2-4743-964d-35ea9034b0bd', // DeFi Llama pool ID
    name: 'USDC • WETH | Shadow',
    tier: 'Premium',
    tokenX: 'USDC',
    tokenY: 'WETH',
  },
];

/**
 * Type guards for protocol-specific vault configs
 */
export function isMetropolisVault(vault: VaultConfig): vault is MetropolisVaultConfig {
  return vault.protocol === 'metropolis';
}

export function isShadowVault(vault: VaultConfig): vault is ShadowVaultConfig {
  return vault.protocol === 'shadow';
}

/**
 * Utility functions for filtering vaults by protocol
 */
export function getMetropolisVaults(): MetropolisVaultConfig[] {
  return VAULT_CONFIGS.filter(isMetropolisVault);
}

export function getShadowVaults(): ShadowVaultConfig[] {
  return VAULT_CONFIGS.filter(isShadowVault);
}

/**
 * Get vault by address (case-insensitive)
 */
export function getVaultByAddress(address: string): VaultConfig | undefined {
  const lowerAddress = address.toLowerCase();
  return VAULT_CONFIGS.find(v => v.vaultAddress.toLowerCase() === lowerAddress);
}
