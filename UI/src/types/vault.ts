export interface Vault {
  id: number;
  name: string;
  platform: string;
  chain: string;
  earnings: number;
  poolTvl: number;
  farmTvl: number;
  apr: number;
  aprDaily: number;
  tokens: string[];
  description?: string;
  contractAddress?: string;
  isActive?: boolean;
}

// Multi-vault interface supporting any token pair
export interface RealVault {
  id: string; // Vault contract address
  name: string; // "wS-USDC.e", "wS-METRO", "METRO-USDC", etc.
  tokens: [string, string]; // ["wS", "USDC.e"] - any token pair
  tokenAddresses: [string, string]; // [tokenXAddress, tokenYAddress]
  tokenDecimals: [number, number]; // [tokenXDecimals, tokenYDecimals] e.g., [18, 6]
  tokenSymbols: [string, string]; // Same as tokens but explicit naming
  platform: string; // "Arca DLMM", future: "Shadow Exchange", etc.
  chain: string; // "Sonic", "Sonic Fork", etc.

  // Real-time contract data (token-agnostic)
  vaultBalanceX: string; // First token balance in vault
  vaultBalanceY: string; // Second token balance in vault
  userSharesX: string; // User's shares for first token
  userSharesY: string; // User's shares for second token
  pricePerShareX: string; // Price per share for first token
  pricePerShareY: string; // Price per share for second token

  // Calculated values (from useVaultMetrics)
  totalTvl: number; // Total vault TVL in USD
  userBalance: number; // User's total position in USD
  apr: number; // Estimated APR from rewards + trading fees
  aprDaily: number; // Daily APR (apr / 365)

  // Enhanced user metrics
  userEarnings: number; // Current position - total deposited
  userROI: number; // Return on investment percentage
  userTotalDeposited: number; // Total user deposits from history

  // USD breakdowns for display (token-agnostic)
  vaultBalanceXUSD: number; // First token balance in USD
  vaultBalanceYUSD: number; // Second token balance in USD
  userSharesXUSD: number; // User's first token shares value in USD
  userSharesYUSD: number; // User's second token shares value in USD

  contractAddress: string; // Vault contract address
  isActive: boolean;
  description?: string;

  // User balances for deposit/withdraw UI (token-agnostic)
  userBalanceX: string; // User's balance of first token
  userBalanceY: string; // User's balance of second token

  // Queue status
  pendingDeposits: string;
  pendingWithdraws: string;

  // Data freshness indicators
  lastUpdated?: number;
  isStale?: boolean;
}

export interface VaultFilters {
  platform: string;
  chain: string;
  sortBy: string;
  search: string;
}
