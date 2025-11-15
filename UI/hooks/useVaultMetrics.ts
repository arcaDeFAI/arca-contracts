'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { useTokenPrices } from './useAPYCalculation';
import { useMetroAPY } from './useMetroAPY';
import { useShadowAPY } from './useShadowAPY';
import { CONTRACTS } from '@/lib/contracts';
import { getTokenDecimals } from '@/lib/tokenHelpers';

interface VaultConfig {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
  tokenX?: string;
  tokenY?: string;
}

/**
 * Unified hook for vault metrics (TVL, APY, user balances)
 * Eliminates duplication between VaultCard and DashboardVaultCard
 */
export function useVaultMetrics(config: VaultConfig, userAddress?: string) {
  const { name, vaultAddress, stratAddress, tokenX = 'S', tokenY = 'USDC' } = config;
  const isShadowVault = name.includes('Shadow');

  // Fetch all data
  const vaultData = useVaultData(config, userAddress);
  const dashboardData = useDashboardData(config, userAddress);
  const { prices, isLoading: pricesLoading } = useTokenPrices();
  const sonicPrice = prices?.sonic || 0.17;

  // Calculate vault TVL (total value locked) - vault's total balances with dynamic decimals
  const vaultTVL = vaultData.balances ? (() => {
    const token0Decimals = getTokenDecimals(tokenX);
    const token1Decimals = getTokenDecimals(tokenY);
    
    const token0Value = (Number(vaultData.balances[0]) / (10 ** token0Decimals)) * sonicPrice;
    
    // Get token1 price (USDC = 1, WETH = eth price)
    let token1Price = 1;
    if (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH') {
      token1Price = prices?.weth || 0;
    }
    const token1Value = (Number(vaultData.balances[1]) / (10 ** token1Decimals)) * token1Price;
    
    return token0Value + token1Value;
  })() : 0;

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
    (config as any).rewardsAddress || CONTRACTS.SHADOW_REWARDS, // Use vault-specific rewards address if available
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
