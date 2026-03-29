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
  //{
  //protocol: 'metropolis',
  //vaultAddress: '0xF5708969da13879d7A6D2F21d0411BF9eEB045E9',
  //stratAddress: '0x20302bc08CcaAFB039916e4a06f0B3917506019a',
  //lbBookAddress: '0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC',
  //name: 'S • USDC | Metropolis',
  //tier: 'Premium',
  //tokenX: 'S',
  //tokenY: 'USDC',
  //},
  {
    protocol: 'metropolis',
    vaultAddress: '0xBaef4Da824f554c35035211cb997db4ecB75F45f',
    stratAddress: '0x7069B87c64ee8DA6bF928B4Af0693bC7a4f9D7e6',
    lbBookAddress: '0x12f1cacda05242ccfe4c7139a46b8545bd2b2537',
    name: 'USSD • USDC | Metropolis',
    tier: 'Premium',
    tokenX: 'USSD',
    tokenY: 'USDC',
  },
  {
    protocol: 'metropolis',
    vaultAddress: '0x1C0C5A4197b7Fa25a180E6e08eA19A91EBBe5fD2',
    stratAddress: '0xeca4AE2D4778b1417d6cB47B9C7769e9f5fC4A3f',
    lbBookAddress: '0x361f55337074ae43957204cb30ffbabbce4fb837',
    name: 'wS • USSD | Metropolis',
    tier: 'Premium',
    tokenX: 'wS',
    tokenY: 'USSD',
  },
  {
    protocol: 'metropolis',
    vaultAddress: '0x34331E66a634D69D64edC3e21E52A53899e12640',
    stratAddress: '0x38FdF9a12Ac2e2aD95dd5bE3d271cC6EA23C5c2C',
    lbBookAddress: '0x9eDE606c7168bb09fF73EbdE7bFD6FcfaBDA9Bc3',
    name: 'WETH • wS | Metropolis',
    tier: 'Premium',
    tokenX: 'WETH',
    tokenY: 'WS',
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
  {
    protocol: 'shadow',
    vaultAddress: '0xc318C24c8A8584B03019D34E586DAa14F208eF2d',
    stratAddress: '0x4ddB609F6D03dC29172c51C6D7f3a2B66e997c18',
    clpoolAddress: '0x092c0B146201Bb16D9A37cFC0a7310b05fc8799b',
    rewardsAddress: '',
    poolSymbol: '', // DeFi Llama pool ID (not found)
    name: 'USSD • USDC | Shadow',
    tier: 'Premium',
    tokenX: 'USSD',
    tokenY: 'USDC',
  },
  {
    protocol: 'shadow',
    vaultAddress: '0x3a284cc4080F9d88aC2eE330296975C78C53B5cd',
    stratAddress: '0x496932dD85dB0E9A64F08e529E91cF86D7A65775',
    clpoolAddress: '0x356C9EB08f9121cfB00AD6Dc03A12422eEf8a9A8',
    rewardsAddress: '',
    poolSymbol: '', // DeFi Llama pool ID (not found)
    name: 'USSD • wS | Shadow',
    tier: 'Premium',
    tokenX: 'USSD',
    tokenY: 'wS',
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
