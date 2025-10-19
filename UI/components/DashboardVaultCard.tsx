'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { CONTRACTS } from '@/lib/contracts';
import { type UserRewardStructOutput } from '@/lib/typechain';

interface DashboardVaultCardProps {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
  userAddress?: string;
}

export function DashboardVaultCard({ 
  vaultAddress, 
  stratAddress, 
  name, 
  tier, 
  userAddress 
}: DashboardVaultCardProps) {
  const config = { vaultAddress, stratAddress, name, tier };
  
  // Use only the connected wallet address - no test fallback
  const actualAddress = userAddress;

  // Use unified metrics hook
  const metrics = useVaultMetrics(config, actualAddress);

  const {
    userShares,
    sharePercentage,
    depositedValueUSD,
    apr: calculatedAPR,
    dailyApr: calculatedDailyAPR,
    aprLoading,
    pendingRewards,
    shadowEarned,
    xShadowEarned,
    shadowTokenId,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
    prices,
    isShadowVault,
  } = metrics;

  // Simple check - show if user has shares, pending rewards, queued withdrawal, or claimable withdrawal
  const hasShares = userShares && userShares > 0n;
  const hasPendingRewards = !isShadowVault && pendingRewards && pendingRewards.length > 0;
  const hasQueuedWithdrawal = queuedWithdrawal && queuedWithdrawal > 0n;
  const hasClaimableWithdrawal = claimableWithdrawal && claimableWithdrawal > 0n;

  // Process Shadow vault rewards from earned() calls
  let shadowRewards: {
    xShadowEarned: bigint;
    shadowEarned: bigint;
    totalEarned: bigint;
  } | null = null;
  let shadowHasActivePosition = false;

  if (isShadowVault && shadowTokenId) {
    const xShadowAmount = xShadowEarned || 0n;
    const shadowAmount = shadowEarned || 0n;
    const totalEarned = xShadowAmount + shadowAmount;
    
    shadowRewards = {
      xShadowEarned: xShadowAmount,
      shadowEarned: shadowAmount,
      totalEarned,
    };
    shadowHasActivePosition = !!shadowTokenId;
  }

  // For Shadow vaults, check if there are any rewards from getRewardStatus
  const hasShadowRewards = isShadowVault && shadowRewards && shadowRewards.totalEarned > 0n;

  // Debug Shadow vault rendering logic
  if (isShadowVault) {
    console.log('🔍 SHADOW VAULT RENDERING:', {
      actualAddress: !!actualAddress,
      hasShares,
      hasShadowRewards,
      shadowHasActivePosition,
      shadowTokenId: shadowTokenId?.toString(),
      shadowRewards: shadowRewards ? {
        xShadowEarned: shadowRewards.xShadowEarned.toString(),
        shadowEarned: shadowRewards.shadowEarned.toString(),
        totalEarned: shadowRewards.totalEarned.toString()
      } : null,
      buttonShouldBeEnabled: shadowHasActivePosition && hasShadowRewards,
      buttonDisabled: !shadowHasActivePosition || !hasShadowRewards,
      willRender: !!actualAddress && (hasShares || hasShadowRewards || hasQueuedWithdrawal || hasClaimableWithdrawal)
    });
  }

  // Filter non-zero rewards for Metro vaults
  const nonZeroRewards = !isShadowVault && pendingRewards 
    ? pendingRewards.filter((reward: UserRewardStructOutput) => reward.pendingRewards > 0n)
    : [];

  // Helper function to get token name from address
  const getTokenName = (tokenAddress: string): string => {
    const addr = tokenAddress.toLowerCase();
    if (addr === CONTRACTS.METRO.toLowerCase()) return 'Metro';
    if (addr === CONTRACTS.SHADOW.toLowerCase()) return 'Shadow';
    if (addr === CONTRACTS.xSHADOW.toLowerCase()) return 'xShadow';
    return 'Unknown';
  };

  // Don't render if user has no activity or no wallet connected
  if (!actualAddress || (!hasShares && !hasPendingRewards && !hasShadowRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal)) {
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

  const formatMetroAmount = (rewards: UserRewardStructOutput[] | undefined) => {
    if (!rewards || !Array.isArray(rewards) || rewards.length === 0) return '0';
    // Sum up all pending rewards from the array
    const totalRewards = rewards.reduce((sum: bigint, reward: UserRewardStructOutput) => {
      return sum + (reward.pendingRewards || 0n);
    }, 0n);
    return parseFloat(formatUnits(totalRewards, 18)).toFixed(4);
  };

  const formatTokenAmount = (amount: bigint | undefined, decimals: number) => {
    if (!amount) return '0';
    return parseFloat(formatUnits(amount, decimals)).toFixed(4);
  };

  return (
    <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-white font-semibold">{name}</h3>
            <span className={`text-sm px-2 py-1 rounded-full border ${getTierColor(tier)}`}>
              {tier}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* User Shares & APY */}
        <div className="bg-arca-light-gray/30 rounded-lg p-4">
          {/* APY Display - Dual metrics */}
          <div className="mb-4 pb-4 border-b border-gray-700/30">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3 text-center">APY</div>
            <div className="grid grid-cols-2 gap-3">
              {/* Instant APY - Based on 5-minute intervals */}
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">Instant</div>
                <div className="text-arca-green text-lg font-semibold">
                  {aprLoading ? '...' : formatPercentage(calculatedAPR || 0)}
                </div>
              </div>

              {/* 24h Average APY - Based on harvests over last 24 hours */}
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">24h Avg</div>
                <div className="text-blue-400 text-lg font-semibold">
                  {aprLoading ? '...' : formatPercentage(calculatedDailyAPR || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Share Info - Compact */}
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Share %:</span>
              <span className="text-arca-green font-semibold">
                {sharePercentage?.toFixed(4) || '0.0000'}%
              </span>
            </div>
          </div>
        </div>


        {/* Rewards Section - Shows only non-zero rewards */}
        {hasPendingRewards && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="space-y-2 mb-3">
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

                console.log(`💰 Rewards Display - ${tokenName}:`, {
                  tokenAmount,
                  tokenPrice,
                  usdValue,
                  usdDisplay
                });

                return (
                  <div key={index} className="flex justify-between items-center">
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
              disabled={isClaimingRewards}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isClaimingRewards
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
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Queued Withdrawal:</span>
              <span className="text-yellow-400 font-semibold">
                {queuedWithdrawal?.toString() || '0'} shares
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              Round: {currentRound !== undefined ? Number(currentRound) : 'Loading...'}
            </div>
            <div className="text-sm text-orange-400 text-center py-2">
              Withdrawal will be claimable in the next round
            </div>
          </div>
        )}

        {/* Claimable Withdrawal Section - Shows withdrawal from previous round (can claim now) */}
        {hasClaimableWithdrawal && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Claimable Withdrawal:</span>
              <span className="text-arca-green font-semibold">
                {claimableWithdrawal?.toString() || '0'} shares
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              From Round: {currentRound !== undefined ? Number(currentRound) - 1 : 'Loading...'}
            </div>
            <button
              onClick={handleRedeemWithdrawal}
              disabled={isRedeemingWithdrawal}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isRedeemingWithdrawal
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-arca-green text-black hover:bg-arca-green/90'
              }`}
            >
              {isRedeemingWithdrawal ? 'Claiming...' : 'Claim Withdrawal'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default DashboardVaultCard;
