'use client';

import { useVaultData } from './useVaultData';
import { useDashboardData } from './useDashboardData';
import { usePrices } from '@/contexts/PriceContext';
import { useSubgraphMetrics } from './useSubgraphMetrics';
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { type VaultConfig } from '@/lib/vaultConfigs';

/**
 * Unified hook for vault metrics (TVL, APY, user balances)
 * Eliminates duplication between VaultCard and DashboardVaultCard
 */
export function useVaultMetrics(config: VaultConfig, userAddress?: string) {
  const { name, vaultAddress, tokenX = 'S', tokenY = 'USDC' } = config;
  const isShadowVault = name.includes('Shadow');

  // Fetch all data
  const vaultData = useVaultData(config, userAddress);
  const dashboardData = useDashboardData(config, userAddress, vaultData.sharePercentage);
  const { prices, isLoading: pricesLoading } = usePrices();
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

  // Subgraph metrics — single source of truth for fee APR + reward APR
  const subgraphMetrics = useSubgraphMetrics(config);

  // Use new DeFi Llama APY for Shadow vaults if poolSymbol (pool ID) is provided
  const shadowAPYAdjusted = useDefiLlamaAPYAdjusted(
    stratAddress,
    config.poolSymbol || 'bfb130df-7dd3-4f19-a54c-305c8cb6c9f0' // Default to WS-USDC pool ID if not specified
  );

  // Fallback to old Shadow APY calculation (kept for backwards compatibility)
  const shadowAPYOld = useShadowAPY(
    stratAddress,
    (config as any).rewardsAddress || CONTRACTS.SHADOW_REWARDS,
    getTokenOrThrow('SHADOW').address!,
    vaultTVL,
    prices?.shadow || 0
  );

  // Calculate Forwarded APY natively via RPC (for Shadow vaults without a DeFi Llama pool)
  const shadowAPYForwarded = useShadowRewardForwardedAPY(
    stratAddress,
    getTokenOrThrow('SHADOW').address!,
    config.vaultAddress,
    vaultTVL,
    prices?.shadow || 0
  );

  // Use new DeFi Llama APY if available, otherwise route to the native Forwarded APY
  const shadowAPY = config.poolSymbol 
    ? (!shadowAPYAdjusted.error ? shadowAPYAdjusted : shadowAPYOld)
    : shadowAPYForwarded;

  // Goldsky Subgraph APR — only enabled for vaults that opt in via useSubgraphAPR config flag
  const subgraphAPR = useSubgraphAPR(
    config.useSubgraphAPR ? config.vaultAddress : '',
    vaultTVL,
    prices?.shadow || 0
  );

  // Calculate activePercentage for Shadow APY adjustment (active vs idle liquidity ratio)
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

  // Final APY/APR — subgraph metrics are the single source of truth.
  // Show 0 / loading state while the subgraph is syncing; never fall back to DeFi Llama or RPC
  // estimates so users can clearly tell when real data is available.
  let finalAPY: number;
  let aprLoading: boolean;

  if (subgraphMetrics.isLoading) {
    // Still fetching — show loading state
    finalAPY = 0;
    aprLoading = true;
  } else if (subgraphMetrics.rewardApr !== null) {
    // Use rewards-only APR (fee APR excluded — unreliable during withdrawal periods)
    finalAPY = Math.max(0, subgraphMetrics.rewardApr);
    aprLoading = false;
  } else {
    // No subgraph data yet (vault not indexed / insufficient snapshots) → show 0
    finalAPY = 0;
    aprLoading = false;
  }

  // Subgraph is the single APR source — never show the DeFi Llama 30d average.
  const apy30dMean = null;

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
    apy: finalAPY,
    apy30dMean,
    aprLoading,
    // Subgraph metrics breakdown (fee + reward APR components)
    subgraphMetrics,

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
