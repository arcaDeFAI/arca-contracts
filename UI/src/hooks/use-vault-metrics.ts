import { useMemo } from "react";
import { useVault } from "./use-vault";
import {
  useTokenPrices,
  getTokenUSDValue,
  type TokenPrices,
} from "./use-token-prices";
import { useTransactionHistory } from "./use-transaction-history";

export interface VaultMetrics {
  // TVL calculations
  totalTvlUSD: number;
  vaultBalanceXUSD: number;
  vaultBalanceYUSD: number;

  // User position calculations
  userTotalUSD: number;
  userBalanceXUSD: number;
  userBalanceYUSD: number;
  userSharesXUSD: number;
  userSharesYUSD: number;

  // APR calculations
  estimatedApr: number;
  dailyApr: number;

  // User-specific metrics
  userEarnings: number;
  userTotalDeposited: number;
  userROI: number; // Return on Investment %

  // Additional metrics
  pricePerShareX: number;
  pricePerShareY: number;

  // Data freshness
  lastUpdated: number;
  isStale: boolean;
}

export interface VaultMetricsHook {
  metrics: VaultMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Calculate APR based on historical performance and current rates
function calculateEstimatedAPR(
  totalTvlUSD: number,
  userTransactionHistory: unknown[],
  prices: TokenPrices | null,
): number {
  // For development: use mock APR calculation
  // In production, this would use:
  // 1. Historical Metro rewards data
  // 2. Current DLMM trading fees
  // 3. Compounding frequency
  // 4. Pool utilization rates

  if (!prices || totalTvlUSD === 0) return 0;

  // Mock APR calculation based on TVL size (larger pools = lower APR due to dilution)
  const baseAPR = 45; // Base 45% APR
  const tvlFactor = Math.max(0.5, Math.min(1.0, 100000 / totalTvlUSD)); // Scale based on TVL
  const seasonalBonus = 1.2; // 20% bonus for early participation

  return baseAPR * tvlFactor * seasonalBonus;
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
  
  // Get token symbols from vault for price fetching
  const tokenSymbols = vault.tokenXSymbol && vault.tokenYSymbol 
    ? [vault.tokenXSymbol, vault.tokenYSymbol] 
    : [];
    
  const {
    prices,
    isLoading: pricesLoading,
    error: pricesError,
    refetch: refetchPrices,
  } = useTokenPrices(tokenSymbols);
  const { getTransactionSummary } = useTransactionHistory();

  const metrics = useMemo((): VaultMetrics | null => {
    if (!prices || pricesLoading) return null;

    // Get dynamic token symbols from vault configuration
    const tokenXSymbol = vault.tokenXSymbol;
    const tokenYSymbol = vault.tokenYSymbol;
    
    if (!tokenXSymbol || !tokenYSymbol) return null;

    // Vault balances are already formatted as strings by useVault
    const vaultBalanceXStr = vault.vaultBalanceX;
    const vaultBalanceYStr = vault.vaultBalanceY;
    const userSharesXStr = vault.userSharesX;
    const userSharesYStr = vault.userSharesY;
    const userBalanceXStr = vault.userBalanceX;
    const userBalanceYStr = vault.userBalanceY;

    // Calculate USD values using dynamic token symbols
    const vaultBalanceXUSD = getTokenUSDValue(vaultBalanceXStr, tokenXSymbol, prices);
    const vaultBalanceYUSD = getTokenUSDValue(vaultBalanceYStr, tokenYSymbol, prices);
    const totalTvlUSD = vaultBalanceXUSD + vaultBalanceYUSD;

    // User token balances in USD
    const userBalanceXUSD = getTokenUSDValue(userBalanceXStr, tokenXSymbol, prices);
    const userBalanceYUSD = getTokenUSDValue(userBalanceYStr, tokenYSymbol, prices);

    // Use price per share from vault contract (already formatted as strings)
    const pricePerShareX = parseFloat(vault.pricePerShareX) || 1;
    const pricePerShareY = parseFloat(vault.pricePerShareY) || 1;

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

    // APR calculations
    const estimatedApr = calculateEstimatedAPR(totalTvlUSD, [], prices);
    const dailyApr = estimatedApr / 365;

    const now = Date.now();

    return {
      // TVL calculations
      totalTvlUSD,
      vaultBalanceXUSD,
      vaultBalanceYUSD,

      // User position calculations
      userTotalUSD,
      userBalanceXUSD,
      userBalanceYUSD,
      userSharesXUSD,
      userSharesYUSD,

      // APR calculations
      estimatedApr,
      dailyApr,

      // User-specific metrics
      userEarnings,
      userTotalDeposited,
      userROI,

      // Additional metrics
      pricePerShareX,
      pricePerShareY,

      // Data freshness
      lastUpdated: now,
      isStale: prices ? now - prices.lastUpdated > 60000 : false, // Stale after 1 minute
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
    prices,
    pricesLoading,
    getTransactionSummary,
  ]);

  const isLoading = pricesLoading;
  const error = pricesError;

  const refetch = () => {
    refetchPrices();
    // Note: vault data refetches automatically via wagmi queries
  };

  return {
    metrics,
    isLoading,
    error,
    refetch,
  };
}
