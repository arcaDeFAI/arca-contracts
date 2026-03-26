'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { useTokenPrices } from './useAPYCalculation';
import { useMetroAPY } from './useMetroAPY';
import { useShadowAPY } from './useShadowAPY';
import { useShadowAPYAdjusted } from './useShadowAPYAdjusted';
import { CONTRACTS } from '@/lib/contracts';
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { type VaultConfig } from '@/lib/vaultConfigs';

/**
 * Unified hook for vault metrics (TVL, APY, user balances)
 * Eliminates duplication between VaultCard and DashboardVaultCard
 */
export function useVaultMetrics(config: VaultConfig, userAddress?: string) {
  const { name, vaultAddress, stratAddress, tokenX = 'S', tokenY = 'USDC' } = config;
  const isShadowVault = name.includes('Shadow');

  // Fetch all data
  const vaultData = useVaultData(config, userAddress);
  const dashboardData = useDashboardData(config, userAddress, vaultData.sharePercentage);
  const { prices, isLoading: pricesLoading } = useTokenPrices();
  const sonicPrice = prices?.sonic || 0.17;

  // Calculate active vs reserved liquidity
  const activeLiquidity = vaultData.balances && vaultData.idleBalances ? {
    token0: vaultData.balances[0] - vaultData.idleBalances[0],
    token1: vaultData.balances[1] - vaultData.idleBalances[1],
  } : { token0: 0n, token1: 0n };

  const reservedLiquidity = vaultData.idleBalances ? {
    token0: vaultData.idleBalances[0],
    token1: vaultData.idleBalances[1],
  } : { token0: 0n, token1: 0n };

  // Calculate vault TVL (total value locked) - vault's total balances with dynamic decimals
  const vaultTVL = vaultData.balances ? (() => {
    const token0Decimals = getTokenDecimals(tokenX);
    const token1Decimals = getTokenDecimals(tokenY);

    // Get token prices using centralized utility
    const token0Price = getTokenPrice(tokenX, prices, sonicPrice);
    const token0Value = (Number(vaultData.balances[0]) / (10 ** token0Decimals)) * token0Price;

    const token1Price = getTokenPrice(tokenY, prices);
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

  // Use new DeFi Llama APY for Shadow vaults if poolSymbol (pool ID) is provided
  const shadowAPYAdjusted = useShadowAPYAdjusted(
    stratAddress,
    config.poolSymbol || 'bfb130df-7dd3-4f19-a54c-305c8cb6c9f0' // Default to WS-USDC pool ID if not specified
  );

  // Fallback to old Shadow APY calculation (kept for backwards compatibility)
  const shadowAPYOld = useShadowAPY(
    stratAddress,
    (config as any).rewardsAddress || CONTRACTS.SHADOW_REWARDS,
    CONTRACTS.SHADOW,
    vaultTVL,
    prices?.shadow || 0
  );

  // Use new DeFi Llama APY if available and poolSymbol is provided, otherwise fallback to old calculation
  const shadowAPY = config.poolSymbol && !shadowAPYAdjusted.error ? shadowAPYAdjusted : shadowAPYOld;

  // Calculate activePercentage for Shadow APY adjustment
  const activePercentage = (vaultData.balances && vaultData.idleBalances) ? (() => {
    const token0Price = getTokenPrice(tokenX, prices, sonicPrice);
    const token1Price = getTokenPrice(tokenY, prices);
    const totalToken0 = Number(vaultData.balances[0]) / (10 ** getTokenDecimals(tokenX));
    const totalToken1 = Number(vaultData.balances[1]) / (10 ** getTokenDecimals(tokenY));
    const idleToken0 = Number(vaultData.idleBalances[0]) / (10 ** getTokenDecimals(tokenX));
    const idleToken1 = Number(vaultData.idleBalances[1]) / (10 ** getTokenDecimals(tokenY));
    const totalUSD = (totalToken0 * token0Price) + (totalToken1 * token1Price);
    const idleUSD = (idleToken0 * token0Price) + (idleToken1 * token1Price);
    return totalUSD > 0 ? ((totalUSD - idleUSD) / totalUSD) * 100 : 0;
  })() : 0;

  // Metro APY is already calculated against Total TVL in useMetroAPY hook.
  // Shadow APY (from pool data) needs scaling by the % of vault TVL actually in the pool.
  const apy = isShadowVault ? (shadowAPY.apy * (activePercentage / 100)) : metroAPY.apy;
  const aprLoading = isShadowVault ? shadowAPY.isLoading : metroAPY.isLoading;

  const raw30dMean = isShadowVault && config.poolSymbol ? shadowAPYAdjusted.apy30dMean : null;
  const apy30dMean = (isShadowVault && raw30dMean !== null) ? (raw30dMean * (activePercentage / 100)) : raw30dMean;

  return {
    // Vault data
    userShares: vaultData.userShares,
    totalSupply: vaultData.totalSupply,
    sharePercentage: vaultData.sharePercentage,
    balances: vaultData.balances,
    idleBalances: vaultData.idleBalances,

    // Liquidity breakdown
    activeLiquidity,
    reservedLiquidity,

    // Calculated values
    depositedValueUSD,
    vaultTVL,

    // APY metrics
    apy,
    apy30dMean,
    aprLoading,

    // Dashboard data
    pendingRewards: dashboardData.pendingRewards,
    currentRound: dashboardData.currentRound,
    queuedWithdrawal: dashboardData.queuedWithdrawal,
    claimableWithdrawals: dashboardData.claimableWithdrawals,
    totalClaimableAmount: dashboardData.totalClaimableAmount,

    // Actions
    handleClaimRewards: dashboardData.handleClaimRewards,
    isClaimingRewards: dashboardData.isClaimingRewards,
    handleRedeemWithdrawal: dashboardData.handleRedeemWithdrawal,
    isRedeemingWithdrawal: dashboardData.isRedeemingWithdrawal,
    handleCancelWithdrawal: dashboardData.handleCancelWithdrawal,
    isCancellingWithdrawal: dashboardData.isCancellingWithdrawal,

    // Loading states
    isLoading: vaultData.isLoading || pricesLoading,
    isError: vaultData.isError,

    // Prices
    prices,
    sonicPrice,
    isShadowVault,
    activePercentage,
  };
}
