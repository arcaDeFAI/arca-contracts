'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { useTokenPrices, useAPYCalculation } from './useAPYCalculation';
import { useSonicPrice } from './useSonicPrice';

interface VaultConfig {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
}

/**
 * Unified hook for vault metrics (TVL, APY, user balances)
 * Eliminates duplication between VaultCard and DashboardVaultCard
 */
export function useVaultMetrics(config: VaultConfig, userAddress?: string) {
  const { name, vaultAddress } = config;
  const isShadowVault = name.includes('Shadow');

  // Fetch all data
  const vaultData = useVaultData(config, userAddress);
  const dashboardData = useDashboardData(config, userAddress);
  const { prices, isLoading: pricesLoading } = useTokenPrices();
  const { price: sonicPrice } = useSonicPrice();

  // Calculate vault TVL (total value locked) - vault's total balances
  const vaultTVL = vaultData.balances ?
    Number(vaultData.balances[1]) / (10 ** 6) + // USDC in vault
    (Number(vaultData.balances[0]) / (10 ** 18)) * sonicPrice : 0; // S in vault

  // Calculate user's deposited value in USD based on their share percentage
  const depositedValueUSD = (vaultData.userShares && vaultData.totalSupply && vaultData.totalSupply > 0n) ?
    vaultTVL * (Number(vaultData.userShares) / Number(vaultData.totalSupply)) : 0;

  // Get actual rewards for APY calculation
  const actualRewardsToken = isShadowVault 
    ? Number(dashboardData.shadowEarned || 0n) / (10 ** 18)
    : (dashboardData.pendingRewards && dashboardData.pendingRewards.length > 0 
        ? Number(dashboardData.pendingRewards[0].pendingRewards) / (10 ** 18)
        : 0);

  const tokenPrice = isShadowVault ? (prices?.shadow || 0) : (prices?.metro || 0);

  // Calculate instant APR (5-minute intervals)
  const { apy: apr, isLoading: aprLoading, error: aprError } = useAPYCalculation(
    name,
    depositedValueUSD,
    actualRewardsToken,
    tokenPrice
  );

  // For now, use the same APR for daily average
  // In the full implementation, this would track 24h harvest data
  const dailyApr = apr;

  return {
    // Vault data
    userShares: vaultData.userShares,
    totalSupply: vaultData.totalSupply,
    sharePercentage: vaultData.sharePercentage,
    balances: vaultData.balances,

    // Calculated values
    depositedValueUSD,
    vaultTVL,

    // APY metrics
    apr,
    dailyApr,
    aprLoading,
    aprError,

    // Dashboard data
    pendingRewards: dashboardData.pendingRewards,
    shadowEarned: dashboardData.shadowEarned,
    xShadowEarned: dashboardData.xShadowEarned,
    shadowTokenId: dashboardData.shadowTokenId,
    currentRound: dashboardData.currentRound,
    queuedWithdrawal: dashboardData.queuedWithdrawal,
    claimableWithdrawal: dashboardData.claimableWithdrawal,

    // Actions
    handleClaimRewards: dashboardData.handleClaimRewards,
    isClaimingRewards: dashboardData.isClaimingRewards,
    handleRedeemWithdrawal: dashboardData.handleRedeemWithdrawal,
    isRedeemingWithdrawal: dashboardData.isRedeemingWithdrawal,

    // Loading states
    isLoading: vaultData.isLoading || pricesLoading,
    isError: vaultData.isError,

    // Prices
    prices,
    sonicPrice,
    isShadowVault,
  };
}
