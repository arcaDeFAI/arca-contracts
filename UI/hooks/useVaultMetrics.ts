'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { useTokenPrices } from './useAPYCalculation';
import { useVaultAPR } from './useVaultAPR';
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

  // Get APY using vault-wide calculation
  const { apr, dailyApr, isLoading: aprLoading, error: aprError } = useVaultAPR(
    name,
    isShadowVault,
    dashboardData.pendingRewards,
    depositedValueUSD,
    vaultAddress as `0x${string}`,
    vaultData.userShares,
    vaultData.totalSupply,
    vaultTVL
  );

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
