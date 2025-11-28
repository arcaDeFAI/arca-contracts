'use client';

import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { CONTRACTS } from '@/lib/contracts';
import { type UserRewardStructOutput } from '@/lib/typechain';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenLogo, getTokenDecimals } from '@/lib/tokenHelpers';
import { usePrices } from '@/contexts/PriceContext';
import { useState } from 'react';
import PositionVisualizationCard from './PositionVisualizationCard';

interface DashboardVaultCardProps {
  vaultAddress: string;
  stratAddress: string;
  lbBookAddress?: string;
  clpoolAddress?: string;
  rewardsAddress?: string;
  poolSymbol?: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
  userAddress?: string;
  tokenX?: string;
  tokenY?: string;
}

export function DashboardVaultCard({ 
  vaultAddress, 
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  rewardsAddress,
  poolSymbol,
  name, 
  tier, 
  userAddress,
  tokenX = 'S',
  tokenY = 'USDC'
}: DashboardVaultCardProps) {
  const config = { vaultAddress, stratAddress, rewardsAddress, poolSymbol, name, tier, tokenX, tokenY };
  
  // Use the connected wallet address
  const actualAddress = userAddress;

  // Use unified metrics hook
  const metrics = useVaultMetrics(config, actualAddress);
  const { prices } = usePrices();

  const {
    userShares,
    sharePercentage,
    balances,
    idleBalances,
    totalSupply,
    apy,
    apy30dMean,
    aprLoading,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawals,
    totalClaimableAmount,
    handleClaimRewards,
    handleRedeemWithdrawal,
    isClaimingRewards,
    isRedeemingWithdrawal,
    sonicPrice,
    isShadowVault,
    activeLiquidity,
    reservedLiquidity,
  } = metrics;

  // Calculate deposited amounts based on user's share percentage
  const depositedAmounts = (() => {
    if (!balances || !userShares || !totalSupply || totalSupply === 0n) {
      return null;
    }
    
    const shareRatio = Number(userShares) / Number(totalSupply);
    
    // Token 0 - use dynamic decimals and price
    const token0Decimals = getTokenDecimals(tokenX);
    const token0Amount = Number(formatUnits(balances[0], token0Decimals)) * shareRatio;
    
    // Get token0 price (USDC = 1, S = sonic price, WETH = eth price)
    let token0Price = sonicPrice || 0; // Default for S
    if (tokenX.toUpperCase() === 'USDC') {
      token0Price = 1;
    } else if (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH') {
      token0Price = prices?.weth || 0;
    }
    const token0Value = token0Amount * token0Price;
    
    // Token 1 - use dynamic decimals and price
    const token1Decimals = getTokenDecimals(tokenY);
    const token1Amount = Number(formatUnits(balances[1], token1Decimals)) * shareRatio;
    
    // Get token1 price (USDC = 1, WETH = eth price)
    let token1Price = 1; // Default for USDC
    if (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH') {
      token1Price = prices?.weth || 0;
    }
    const token1Value = token1Amount * token1Price;
    
    return {
      token0: { name: tokenX, amount: token0Amount, usdValue: token0Value },
      token1: { name: tokenY, amount: token1Amount, usdValue: token1Value }
    };
  })();

  const [showActiveBreakdown, setShowActiveBreakdown] = useState(false);
  const [showReservedBreakdown, setShowReservedBreakdown] = useState(false);

  // Calculate liquidity percentages based on USD value
  const liquidityPercentages = (() => {
    if (!balances || !idleBalances) {
      return { activePercentage: 0, reservedPercentage: 0 };
    }
    
    // Get token prices
    let token0Price = sonicPrice || 0;
    if (tokenX.toUpperCase() === 'USDC') {
      token0Price = 1;
    } else if (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH') {
      token0Price = prices?.weth || 0;
    }
    
    let token1Price = 1;
    if (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH') {
      token1Price = prices?.weth || 0;
    }
    
    // Convert to actual token amounts with proper decimals
    const totalToken0 = Number(formatUnits(balances[0], getTokenDecimals(tokenX)));
    const totalToken1 = Number(formatUnits(balances[1], getTokenDecimals(tokenY)));
    const idleToken0 = Number(formatUnits(idleBalances[0], getTokenDecimals(tokenX)));
    const idleToken1 = Number(formatUnits(idleBalances[1], getTokenDecimals(tokenY)));
    
    // Calculate USD values
    const totalValueUSD = (totalToken0 * token0Price) + (totalToken1 * token1Price);
    const idleValueUSD = (idleToken0 * token0Price) + (idleToken1 * token1Price);
    
    if (totalValueUSD === 0) {
      return { activePercentage: 0, reservedPercentage: 0 };
    }
    
    const reservedPercentage = (idleValueUSD / totalValueUSD) * 100;
    const activePercentage = 100 - reservedPercentage;
    
    return { activePercentage, reservedPercentage };
  })();

  // Calculate user's share of active and reserved liquidity
  const userLiquidityBreakdown = (() => {
    if (!balances || !idleBalances || !userShares || !totalSupply || totalSupply === 0n) {
      return {
        activeLiquidity: { token0: 0, token1: 0, usdValue: 0, token0Percentage: 0, token1Percentage: 0 },
        reservedLiquidity: { token0: 0, token1: 0, usdValue: 0, token0Percentage: 0, token1Percentage: 0 },
        totalLiquidity: { token0: 0, token1: 0 }
      };
    }
    
    const shareRatio = Number(userShares) / Number(totalSupply);
    
    // Get token prices
    let token0Price = sonicPrice || 0; // Default for S
    if (tokenX.toUpperCase() === 'USDC') {
      token0Price = 1;
    } else if (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH') {
      token0Price = prices?.weth || 0;
    }
    
    let token1Price = 1; // Default for USDC
    if (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH') {
      token1Price = prices?.weth || 0;
    }
    
    // User's total token amounts
    const totalToken0 = Number(formatUnits(balances[0], getTokenDecimals(tokenX))) * shareRatio;
    const totalToken1 = Number(formatUnits(balances[1], getTokenDecimals(tokenY))) * shareRatio;
    
    // User's share of active liquidity (total - idle)
    const userActiveToken0 = Number(formatUnits(activeLiquidity.token0, getTokenDecimals(tokenX))) * shareRatio;
    const userActiveToken1 = Number(formatUnits(activeLiquidity.token1, getTokenDecimals(tokenY))) * shareRatio;
    const activeUSDValue = (userActiveToken0 * token0Price) + (userActiveToken1 * token1Price);
    
    // User's share of reserved liquidity (idle)
    const userReservedToken0 = Number(formatUnits(reservedLiquidity.token0, getTokenDecimals(tokenX))) * shareRatio;
    const userReservedToken1 = Number(formatUnits(reservedLiquidity.token1, getTokenDecimals(tokenY))) * shareRatio;
    const reservedUSDValue = (userReservedToken0 * token0Price) + (userReservedToken1 * token1Price);
    
    // Calculate percentages for each token relative to total
    const activeToken0Percentage = totalToken0 > 0 ? (userActiveToken0 / totalToken0) * 100 : 0;
    const activeToken1Percentage = totalToken1 > 0 ? (userActiveToken1 / totalToken1) * 100 : 0;
    const reservedToken0Percentage = totalToken0 > 0 ? (userReservedToken0 / totalToken0) * 100 : 0;
    const reservedToken1Percentage = totalToken1 > 0 ? (userReservedToken1 / totalToken1) * 100 : 0;
    
    return {
      activeLiquidity: { 
        token0: userActiveToken0, 
        token1: userActiveToken1, 
        usdValue: activeUSDValue,
        token0Percentage: activeToken0Percentage,
        token1Percentage: activeToken1Percentage
      },
      reservedLiquidity: { 
        token0: userReservedToken0, 
        token1: userReservedToken1, 
        usdValue: reservedUSDValue,
        token0Percentage: reservedToken0Percentage,
        token1Percentage: reservedToken1Percentage
      },
      totalLiquidity: { token0: totalToken0, token1: totalToken1 }
    };
  })();

  // Get preview amounts for queued withdrawal
  const { data: queuedPreviewAmounts } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: queuedWithdrawal ? [queuedWithdrawal] : undefined,
    query: {
      enabled: !!queuedWithdrawal && queuedWithdrawal > 0n,
    },
  });


  // Helper function to get token name from address
  const getTokenName = (tokenAddress: string): string => {
    const addr = tokenAddress.toLowerCase();
    if (addr === CONTRACTS.METRO.toLowerCase()) return 'Metro';
    if (addr === CONTRACTS.SHADOW.toLowerCase()) return 'Shadow';
    if (addr === CONTRACTS.xSHADOW.toLowerCase()) return 'xShadow';
    return 'Unknown';
  };

  // Simple check - show if user has shares, pending rewards, queued withdrawal, or claimable withdrawal
  const hasShares = !!(userShares && userShares > 0n);
const hasPendingRewards = !!(pendingRewards && pendingRewards.some((r: UserRewardStructOutput) => r.pendingRewards > 0n));
const hasQueuedWithdrawal = !!(queuedWithdrawal && queuedWithdrawal > 0n);
const hasClaimableWithdrawal = !!(claimableWithdrawals && claimableWithdrawals.length > 0);

  // Filter non-zero rewards for both Metro and Shadow vaults
  const nonZeroRewards = pendingRewards 
    ? pendingRewards.filter((reward: UserRewardStructOutput) => reward.pendingRewards > 0n)
    : [];

  // Don't render if user has no wallet connected
  if (!actualAddress) {
    return null;
  }
  
  // CRITICAL FIX: Wait for withdrawal data to load before hiding card
  // This prevents hiding cards with queued withdrawals when data hasn't loaded yet
  const isWithdrawalDataLoading = currentRound === undefined;
  
  // If user has no shares but withdrawal data is still loading, keep card visible
  // This ensures users with queued withdrawals can always see their cards
  if (!hasShares && !hasPendingRewards && isWithdrawalDataLoading) {
    // Show loading state while withdrawal data loads
    return (
      <div className="bg-black rounded-lg border border-arca-green/20 p-4">
        <div className="text-gray-400 text-sm text-center animate-pulse">
          Loading withdrawal data...
        </div>
      </div>
    );
  }
  
  // Only hide card after confirming no activity (shares, rewards, or withdrawals)
  if (!hasShares && !hasPendingRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal) {
    return null;
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5';
      case 'Premium': return 'text-purple-400 border-purple-400/20 bg-purple-400/5';
      case 'Active': return 'text-blue-400 border-blue-400/20 bg-blue-400/5';
      default: return 'text-gray-400 border-gray-400/20 bg-gray-400/5';
    }
  };

  return (
    <div className="bg-black rounded-lg border border-arca-green/20 hover:border-arca-green/50 transition-all shadow-[0_0_15px_rgba(0,255,163,0.15)] hover:shadow-[0_0_30px_rgba(0,255,163,0.3)] overflow-hidden">
      {/* Position Visualization */}
      <PositionVisualizationCard
        vaultAddress={vaultAddress}
        stratAddress={stratAddress}
        lbBookAddress={lbBookAddress}
        clpoolAddress={clpoolAddress}
        name={name}
        tier={tier}
        userAddress={actualAddress}
        tokenX={tokenX}
        tokenY={tokenY}
      />

      {/* Dashboard Card */}
      <div className="p-4 border-t border-arca-green/20">
        <div className="space-y-3">
        {/* User Shares & APY */}
        <div className="bg-black/50 rounded-lg p-3 border border-gray-700/50">
          {/* APR Display - Vault-wide 24h */}
          <div className="mb-3 pb-3 border-b border-gray-700/30">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1 text-center group relative">
              APR
              {apy30dMean !== null && (
                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-black border border-arca-green rounded-lg text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  30d Avg: {formatPercentage(apy30dMean)}
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-arca-green text-xl font-bold">
                {aprLoading ? '...' : formatPercentage(apy || 0)}
              </div>
              
            </div>
          </div>

          {/* Share Info - Compact */}
          <div className="mt-2 pt-2 border-t border-gray-700/30">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Share %:</span>
              <span className="text-white font-semibold text-sm">
                {sharePercentage?.toFixed(2) || '0.0000'}%
              </span>
            </div>
          </div>

          {/* Deposited Amounts */}
          {depositedAmounts && (
            <div className="mt-2 pt-2 border-t border-gray-700/30">
              {/* Total Balance - Keep in Green */}
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400 text-sm">Balance:</div>
                <div className="text-arca-green font-bold text-base">
                  ${(depositedAmounts.token0.usdValue + depositedAmounts.token1.usdValue).toFixed(2)}
                </div>
              </div>
              
              {/* Token Breakdown */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img 
                      src={getTokenLogo(tokenX)} 
                      alt={tokenX} 
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="text-gray-400 text-sm">{tokenX}:</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">
                      {depositedAmounts.token0.amount.toFixed(2)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      ${depositedAmounts.token0.usdValue.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <img 
                      src={getTokenLogo(tokenY)} 
                      alt={tokenY} 
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="text-gray-400 text-sm">{tokenY}:</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold text-sm">
                      {depositedAmounts.token1.amount.toFixed(2)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      ${depositedAmounts.token1.usdValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Liquidity Breakdown Dropdowns */}
              {balances && idleBalances && (
                <>
                  <div className="border-t border-gray-700/20 pt-2 mt-2">
                    <span className="text-gray-400 text-sm font-medium">Liquidity Breakdown</span>
                  </div>

                  {/* Active Liquidity Dropdown */}
                  <div className="pt-1 mt-1">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setShowActiveBreakdown(!showActiveBreakdown)}
                        className="flex justify-between items-center text-left hover:bg-black/20 p-1 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm font-medium">Active</span>
                          <span className="text-white text-xs">({liquidityPercentages.activePercentage.toFixed(1)}%)</span>
                          <div className="text-gray-400 text-xs">
                            {showActiveBreakdown ? '▼' : '▶'}
                          </div>
                        </div>
                      </button>
                      {showActiveBreakdown && (
                        <div className="text-white font-semibold text-xs">
                          ${userLiquidityBreakdown.activeLiquidity.usdValue.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {showActiveBreakdown && (
                      <div className="px-2 pb-2 mt-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getTokenLogo(tokenX)} 
                              alt={tokenX} 
                              className="w-4 h-4 rounded-full"
                            />
                            <div>
                              <div className="text-white font-medium text-xs">
                                {userLiquidityBreakdown.activeLiquidity.token0.toFixed(4)} <span className="text-gray-400 text-xs">({userLiquidityBreakdown.activeLiquidity.token0Percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="text-gray-400 text-xs">
                                ${(userLiquidityBreakdown.activeLiquidity.token0 * (tokenX.toUpperCase() === 'USDC' ? 1 : (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH' ? (prices?.weth || 0) : (sonicPrice || 0)))).toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <img 
                              src={getTokenLogo(tokenY)} 
                              alt={tokenY} 
                              className="w-4 h-4 rounded-full"
                            />
                            <div>
                              <div className="text-white font-medium text-xs">
                                {userLiquidityBreakdown.activeLiquidity.token1.toFixed(4)} <span className="text-gray-400 text-xs">({userLiquidityBreakdown.activeLiquidity.token1Percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="text-gray-400 text-xs">
                                ${(userLiquidityBreakdown.activeLiquidity.token1 * (tokenY.toUpperCase() === 'USDC' ? 1 : (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH' ? (prices?.weth || 0) : (sonicPrice || 0)))).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reserved Liquidity Dropdown */}
                  <div className="pt-1">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setShowReservedBreakdown(!showReservedBreakdown)}
                        className="flex justify-between items-center text-left hover:bg-black/20 p-1 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm font-medium">Reserved</span>
                          <span className="text-white text-xs">({liquidityPercentages.reservedPercentage.toFixed(1)}%)</span>
                          <div className="text-gray-400 text-xs">
                            {showReservedBreakdown ? '▼' : '▶'}
                          </div>
                        </div>
                      </button>
                      {showReservedBreakdown && (
                        <div className="text-white font-semibold text-xs">
                          ${userLiquidityBreakdown.reservedLiquidity.usdValue.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {showReservedBreakdown && (
                      <div className="px-2 pb-2 mt-1">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getTokenLogo(tokenX)} 
                              alt={tokenX} 
                              className="w-4 h-4 rounded-full"
                            />
                            <div>
                              <div className="text-white font-medium text-xs">
                                {userLiquidityBreakdown.reservedLiquidity.token0.toFixed(4)} <span className="text-gray-400 text-xs">({userLiquidityBreakdown.reservedLiquidity.token0Percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="text-gray-400 text-xs">
                                ${(userLiquidityBreakdown.reservedLiquidity.token0 * (tokenX.toUpperCase() === 'USDC' ? 1 : (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH' ? (prices?.weth || 0) : (sonicPrice || 0)))).toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <img 
                              src={getTokenLogo(tokenY)} 
                              alt={tokenY} 
                              className="w-4 h-4 rounded-full"
                            />
                            <div>
                              <div className="text-white font-medium text-xs">
                                {userLiquidityBreakdown.reservedLiquidity.token1.toFixed(4)} <span className="text-gray-400 text-xs">({userLiquidityBreakdown.reservedLiquidity.token1Percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="text-gray-400 text-xs">
                                ${(userLiquidityBreakdown.reservedLiquidity.token1 * (tokenY.toUpperCase() === 'USDC' ? 1 : (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH' ? (prices?.weth || 0) : (sonicPrice || 0)))).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Rewards Section - Shows only non-zero rewards (works for both Metro and Shadow) */}
        {hasPendingRewards && (
          <div className="bg-black/50 rounded-lg p-3 border border-gray-700/50">
            <div className="space-y-2 mb-2">
              {nonZeroRewards.map((reward: UserRewardStructOutput, index: number) => {
                const tokenName = getTokenName(reward.token);
                const tokenAmount = Number(formatUnits(reward.pendingRewards, 18));

                // Get token price based on token name
                let tokenPrice = 0;
                if (tokenName === 'Metro' && prices?.metro) {
                  tokenPrice = prices.metro;
                } else if (tokenName === 'Shadow' && prices?.shadow) {
                  tokenPrice = prices.shadow;
                } else if (tokenName === 'xShadow' && prices?.xShadow) {
                  tokenPrice = prices.xShadow;
                }

                const usdValue = tokenAmount * tokenPrice;

                // Format USD with appropriate precision for small values
                let usdDisplay = '';
                if (tokenPrice > 0) {
                  if (usdValue < 0.01) {
                    // For very small values, show more decimals
                    usdDisplay = `($${usdValue.toFixed(4)})`;
                  } else {
                    usdDisplay = `(${formatUSD(usdValue)})`;
                  }
                }

                return (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Rewards:</span>
                    <span className="text-arca-green font-semibold">
                      {tokenAmount.toFixed(4)} {tokenName} {usdDisplay}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleClaimRewards}
              disabled={isClaimingRewards || nonZeroRewards.length === 0}
              className={`w-full py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                isClaimingRewards || nonZeroRewards.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-arca-green text-black hover:bg-arca-green/90'
              }`}
            >
              {isClaimingRewards ? 'Claiming...' : 'Claim Rewards'}
            </button>
          </div>
        )}

        {/* Queued Withdrawal Section - Shows withdrawal in current round (not claimable yet) */}
        {hasQueuedWithdrawal && (
          <div className="bg-black/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-400">Queued Withdrawal:</span>
              <span className="text-yellow-400 font-semibold">
                {queuedWithdrawal ? (Number(queuedWithdrawal) / 1e12).toFixed(2) : '0.00'} shares
              </span>
            </div>
            
            {/* Preview amounts */}
            {queuedPreviewAmounts && (
              <div className="bg-arca-dark/50 rounded-lg p-2 mb-2 space-y-1">
                <div className="text-xs text-gray-400 mb-2">Estimated withdrawal:</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{isShadowVault ? 'WS' : 'S'}:</span>
                  <span className="text-white font-medium">
                    {Number(formatUnits(queuedPreviewAmounts[0], 18)).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">USDC:</span>
                  <span className="text-white font-medium">
                    {Number(formatUnits(queuedPreviewAmounts[1], 6)).toFixed(4)}
                  </span>
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-400 mb-2">
              Round: {currentRound !== undefined ? Number(currentRound) : 'Loading...'}
            </div>
            <div className="text-sm text-orange-400 text-center py-2">
              Withdrawal will be claimable in the next round
            </div>
          </div>
        )}

        {/* Claimable Withdrawal Section - Shows all withdrawals from past rounds (can claim now) */}
        {hasClaimableWithdrawal && (
          <div className="bg-black/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Claimable Withdrawal{claimableWithdrawals && claimableWithdrawals.length > 1 ? 's' : ''}:</span>
              <span className="text-arca-green font-semibold">
                {claimableWithdrawals ? (Number(claimableWithdrawals) / 1e12).toFixed(2) : '0.00'} shares
              </span>
            </div>
            
            {/* Show all rounds with claimable withdrawals */}
            {claimableWithdrawals && claimableWithdrawals.map((withdrawal) => (
              <div key={Number(withdrawal.round)} className="mb-3">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-500">Round {Number(withdrawal.round)}:</span>
                  <span className="text-gray-300">{(Number(withdrawal.amount) / 1e12).toFixed(2)} shares</span>
                </div>
                <button
                  onClick={() => handleRedeemWithdrawal(withdrawal.round)}
                  disabled={isRedeemingWithdrawal}
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${
                    isRedeemingWithdrawal
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-arca-green text-black hover:bg-arca-green/90'
                  }`}
                >
                  {isRedeemingWithdrawal ? 'Claiming...' : `Claim from Round ${Number(withdrawal.round)}`}
                </button>
              </div>
            ))}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

export default DashboardVaultCard;
