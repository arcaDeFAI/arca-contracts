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

// New interface for real vault data from contracts
export interface RealVault {
  id: string; // Contract address
  name: string; // "wS-USDC.e"
  tokens: ["wS", "USDC.e"];
  platform: "Arca DLMM";
  chain: "Sonic" | "Sonic Fork";

  // Real-time contract data
  vaultBalanceX: string; // From useVault.vaultBalanceX
  vaultBalanceY: string; // From useVault.vaultBalanceY
  userSharesX: string; // From useVault.userSharesX
  userSharesY: string; // From useVault.userSharesY
  pricePerShareX: string; // From useVault.pricePerShareX
  pricePerShareY: string; // From useVault.pricePerShareY

  // Calculated values (from useVaultMetrics)
  totalTvl: number; // Total vault TVL in USD
  userBalance: number; // User's total position in USD
  apr: number; // Estimated APR from Metro rewards + trading fees
  aprDaily: number; // Daily APR (apr / 365)

  // Enhanced user metrics
  userEarnings: number; // Current position - total deposited
  userROI: number; // Return on investment percentage
  userTotalDeposited: number; // Total user deposits from history

  // USD breakdowns for display
  vaultBalanceXUSD: number; // wS balance in USD
  vaultBalanceYUSD: number; // USDC.e balance in USD
  userSharesXUSD: number; // User's wS shares value in USD
  userSharesYUSD: number; // User's USDC.e shares value in USD

  contractAddress: string; // From getContracts()
  isActive: boolean;
  description?: string;

  // User balances for deposit/withdraw UI
  userBalanceWS: string;
  userBalanceUSDC: string;

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
