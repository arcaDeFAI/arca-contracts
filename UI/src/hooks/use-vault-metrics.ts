import { useMemo } from "react";
import { useVault } from "./use-vault";
import { useHybridTokenPrices } from "./use-hybrid-token-prices";
import { getTokenUSDValue } from "./use-token-prices";
import { useTransactionHistory } from "./use-transaction-history";
import { useVaultTransactionHistory } from "./use-vault-transaction-history";

export interface VaultMetrics {
  // Progressive enhancement indicators
  isDataAvailable: boolean;
  priceDataLoading: boolean;
  priceDataError: string | null;

  // TVL calculations (optional - undefined when prices unavailable)
  totalTvlUSD?: number;
  vaultBalanceXUSD?: number;
  vaultBalanceYUSD?: number;

  // User position calculations (optional - undefined when prices unavailable)
  userTotalUSD?: number;
  userBalanceXUSD?: number;
  userBalanceYUSD?: number;
  userSharesXUSD?: number;
  userSharesYUSD?: number;

  // APR calculations (optional - undefined when prices unavailable)
  realApr?: number; // Real APR from blockchain reward data
  dailyApr?: number;

  // User-specific metrics (optional - undefined when prices unavailable)
  userEarnings?: number;
  userTotalDeposited?: number;
  userROI?: number; // Return on Investment %

  // Additional metrics (always available from vault contract)
  pricePerShareX: number;
  pricePerShareY: number;

  // Data freshness
  lastUpdated: number;
  isStale: boolean;

  // Reward system integration
  isRealData?: boolean;
  rewardDataSource?: "blockchain" | "estimated";
  timeWindowDays?: number;
}

export interface VaultMetricsHook {
  metrics: VaultMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Calculate user's earnings based on current position vs deposits
function calculateUserEarnings(
  userCurrentValueUSD: number,
  userTotalDepositedUSD: number,
): number {
  return userCurrentValueUSD - userTotalDepositedUSD;
}

// Calculate user's ROI percentage
function calculateUserROI(earnings: number, totalDeposited: number): number {
  if (totalDeposited === 0) return 0;
  return (earnings / totalDeposited) * 100;
}

export function useVaultMetrics(vaultAddress?: string): VaultMetricsHook {
  const vault = useVault(vaultAddress);

  // Get token symbols from vault for price fetching - memoize to prevent infinite renders
  const tokenSymbols = useMemo(
    () =>
      vault.tokenXSymbol && vault.tokenYSymbol
        ? [vault.tokenXSymbol, vault.tokenYSymbol]
        : [],
    [vault.tokenXSymbol, vault.tokenYSymbol],
  );

  const {
    prices,
    isLoading: pricesLoading,
    error: pricesError,
    refresh: refetchPrices,
    isUsingRealPrices: isRealData,
  } = useHybridTokenPrices({ tokens: tokenSymbols });
  const { getTransactionSummary } = useTransactionHistory(
    vaultAddress ? [vaultAddress] : [],
  );

  // Use vault-specific transaction history when vault data is available
  const vaultTransactionHistory = useVaultTransactionHistory(
    vault.vaultAddress &&
      vault.tokenXSymbol &&
      vault.tokenYSymbol &&
      vault.chainId &&
      vault.userAddress
      ? {
          vaultAddress: vault.vaultAddress,
          tokenXSymbol: vault.tokenXSymbol,
          tokenYSymbol: vault.tokenYSymbol,
          chainId: vault.chainId,
          userAddress: vault.userAddress,
        }
      : {
          vaultAddress: "",
          tokenXSymbol: "",
          tokenYSymbol: "",
          chainId: 0,
          userAddress: "",
        },
  );

  const metrics = useMemo((): VaultMetrics | null => {
    // Get dynamic token symbols from vault configuration
    const tokenXSymbol = vault.tokenXSymbol;
    const tokenYSymbol = vault.tokenYSymbol;

    // Return null only if we don't have basic vault data
    if (!tokenXSymbol || !tokenYSymbol) return null;

    // Progressive enhancement: Return partial data even when prices unavailable
    const hasPriceData = !!(
      prices &&
      !pricesLoading &&
      !pricesError &&
      Object.keys(prices).length > 0
    );

    // Always available metrics from vault contract (non-price-dependent)
    const pricePerShareX = parseFloat(vault.pricePerShareX) || 1;
    const pricePerShareY = parseFloat(vault.pricePerShareY) || 1;
    const now = Date.now();

    // Base metrics object with always-available data
    const baseMetrics: VaultMetrics = {
      // Progressive enhancement indicators
      isDataAvailable: true,
      priceDataLoading: pricesLoading,
      priceDataError: pricesError,

      // Always available metrics (from vault contract)
      pricePerShareX,
      pricePerShareY,
      lastUpdated: now,
      isStale: false, // Price staleness only matters when we have prices
    };

    // If we don't have price data, return partial metrics
    if (!hasPriceData) {
      return baseMetrics;
    }

    // We have price data - calculate USD values
    const vaultBalanceXStr = vault.vaultBalanceX;
    const vaultBalanceYStr = vault.vaultBalanceY;
    const userSharesXStr = vault.userSharesX;
    const userSharesYStr = vault.userSharesY;
    const userBalanceXStr = vault.userBalanceX;
    const userBalanceYStr = vault.userBalanceY;

    // Convert hybrid prices to TokenPrices format for compatibility
    const pricesWithTimestamp = { ...prices, lastUpdated: Date.now() };

    // Calculate USD values using dynamic token symbols
    const vaultBalanceXUSD = getTokenUSDValue(
      vaultBalanceXStr,
      tokenXSymbol,
      pricesWithTimestamp,
    );
    const vaultBalanceYUSD = getTokenUSDValue(
      vaultBalanceYStr,
      tokenYSymbol,
      pricesWithTimestamp,
    );
    const totalTvlUSD = vaultBalanceXUSD + vaultBalanceYUSD;

    // User token balances in USD
    const userBalanceXUSD = getTokenUSDValue(
      userBalanceXStr,
      tokenXSymbol,
      pricesWithTimestamp,
    );
    const userBalanceYUSD = getTokenUSDValue(
      userBalanceYStr,
      tokenYSymbol,
      pricesWithTimestamp,
    );

    // Get token prices dynamically
    const tokenXPrice = prices[tokenXSymbol.toLowerCase()] || 0;
    const tokenYPrice = prices[tokenYSymbol.toLowerCase()] || 0;

    // User shares value in USD
    const userSharesXUSD =
      parseFloat(userSharesXStr) * pricePerShareX * tokenXPrice;
    const userSharesYUSD =
      parseFloat(userSharesYStr) * pricePerShareY * tokenYPrice;
    const userTotalUSD = userSharesXUSD + userSharesYUSD;

    // Transaction history analysis
    const txSummary = getTransactionSummary();
    const userTotalDeposited = txSummary.totalDeposited;

    // Calculate earnings and ROI
    const userEarnings = calculateUserEarnings(
      userTotalUSD,
      userTotalDeposited,
    );
    const userROI = calculateUserROI(userEarnings, userTotalDeposited);

    // APR calculations using real reward data from contracts
    const rawTimeWindowDays = vaultTransactionHistory.calculateTimeWindowDays();
    const timeWindowDays = Math.max(1, rawTimeWindowDays); // Minimum 1 day to avoid division errors

    // Check if we have real reward data (contracts available and data exists)
    // Changed to check for existence rather than truthiness to handle "0.0" values
    const hasRealRewardData =
      vault.totalCompoundedX !== undefined &&
      vault.totalCompoundedY !== undefined &&
      vault.rewardDataAvailable === true &&
      vault.rewardClaimerAddress;

    let realApr: number | undefined;
    const rewardDataSource: "blockchain" | "estimated" = hasRealRewardData
      ? "blockchain"
      : "estimated";

    if (hasRealRewardData && totalTvlUSD > 0) {
      // Calculate real APR from contract reward data

      // Calculate USD values for each token type separately
      const tokenXSymbolLower = tokenXSymbol.toLowerCase();
      const tokenYSymbolLower = tokenYSymbol.toLowerCase();
      const tokenXPrice =
        (pricesWithTimestamp as Record<string, number>)?.[tokenXSymbolLower] ||
        0;
      const tokenYPrice =
        (pricesWithTimestamp as Record<string, number>)?.[tokenYSymbolLower] ||
        0;

      const compoundedXUSD =
        parseFloat(vault.totalCompoundedX || "0") * tokenXPrice;
      const compoundedYUSD =
        parseFloat(vault.totalCompoundedY || "0") * tokenYPrice;
      const totalRewardsUSD = compoundedXUSD + compoundedYUSD;

      // Direct APR calculation matching the test expectations
      // APR = (Total Rewards * 365 / Time Window Days) / TVL * 100
      if (timeWindowDays > 0) {
        const annualizedRewardsUSD = totalRewardsUSD * (365 / timeWindowDays);
        realApr = (annualizedRewardsUSD / totalTvlUSD) * 100;
      }
    }

    const dailyApr = (realApr || 0) / 365;

    // Return complete metrics with price data
    return {
      ...baseMetrics,

      // TVL calculations (now available)
      totalTvlUSD,
      vaultBalanceXUSD,
      vaultBalanceYUSD,

      // User position calculations (now available)
      userTotalUSD,
      userBalanceXUSD,
      userBalanceYUSD,
      userSharesXUSD,
      userSharesYUSD,

      // APR calculations (now available)
      realApr,
      dailyApr,

      // User-specific metrics (now available)
      userEarnings,
      userTotalDeposited,
      userROI,

      // Update data freshness with price staleness
      isStale: now - pricesWithTimestamp.lastUpdated > 60000, // Stale after 1 minute

      // Debug info for real data migration
      isRealData: isRealData,

      // Reward system integration
      rewardDataSource,
      timeWindowDays,
    };
  }, [
    vault.vaultBalanceX,
    vault.vaultBalanceY,
    vault.userSharesX,
    vault.userSharesY,
    vault.userBalanceX,
    vault.userBalanceY,
    vault.pricePerShareX,
    vault.pricePerShareY,
    vault.tokenXSymbol,
    vault.tokenYSymbol,
    vault.totalCompoundedX,
    vault.totalCompoundedY,
    prices,
    pricesLoading,
    pricesError,
    vaultTransactionHistory.calculateTimeWindowDays,
  ]);

  // Don't block hook loading on price fetching - vault discovery should proceed
  const isLoading = false; // Only loading if vault data itself is unavailable
  const error = null; // Price errors are handled within metrics object

  const refetch = () => {
    void refetchPrices?.();
    // Note: vault data refetches automatically via wagmi queries
  };

  return {
    metrics,
    isLoading,
    error,
    refetch,
  };
}
