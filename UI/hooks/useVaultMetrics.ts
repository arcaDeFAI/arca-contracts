'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { useTokenPrices } from './useAPYCalculation';
import { useSonicPrice } from './useSonicPrice';
import { useMetroAPY } from './useMetroAPY';
import { useShadowAPY } from './useShadowAPY';
import { CONTRACTS } from '@/lib/contracts';

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
  const { name, vaultAddress, stratAddress } = config;
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

  // Calculate APY based on vault type
  const metroAPY = useMetroAPY(
    stratAddress,
    CONTRACTS.METRO,
    vaultTVL,
    prices?.metro || 0
  );

  const shadowAPY = useShadowAPY(
    stratAddress,
    CONTRACTS.SHADOW_REWARDS,
    CONTRACTS.SHADOW,
    vaultTVL,
    prices?.shadow || 0
  );

  const apy = isShadowVault ? shadowAPY.apy : metroAPY.apy;
  const aprLoading = isShadowVault ? shadowAPY.isLoading : metroAPY.isLoading;

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
    apy,
    aprLoading,

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
