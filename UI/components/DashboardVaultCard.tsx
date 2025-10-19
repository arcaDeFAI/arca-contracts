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
    apy,
    aprLoading,
    pendingRewards,
    shadowEarned,
    xShadowEarned,
    shadowTokenId,
    shadowRewardStatus,
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

  // Helper function to get token name from address
  const getTokenName = (tokenAddress: string): string => {
    const addr = tokenAddress.toLowerCase();
    if (addr === CONTRACTS.METRO.toLowerCase()) return 'Metro';
    if (addr === CONTRACTS.SHADOW.toLowerCase()) return 'Shadow';
    if (addr === CONTRACTS.xSHADOW.toLowerCase()) return 'xShadow';
    return 'Unknown';
  };

  // Simple check - show if user has shares, pending rewards, queued withdrawal, or claimable withdrawal
  const hasShares = userShares && userShares > 0n;
  const hasPendingRewards = !isShadowVault && pendingRewards && pendingRewards.length > 0;
  const hasQueuedWithdrawal = queuedWithdrawal && queuedWithdrawal > 0n;
  const hasClaimableWithdrawal = claimableWithdrawal && claimableWithdrawal > 0n;

  // Process Shadow vault rewards from getRewardStatus (6 tokens array)
  let shadowRewards: Array<{
    token: string;
    tokenName: string;
    amount: bigint;
    amountFormatted: string;
  }> = [];
  let shadowHasActivePosition = false;
  let shadowTotalRewards = 0n;

  if (isShadowVault && shadowRewardStatus) {
    shadowHasActivePosition = shadowRewardStatus.hasActivePosition;
    
    // Process all 6 tokens from the rewards array
    shadowRewards = shadowRewardStatus.tokens.map((tokenAddress: string, index: number) => {
      const amount = shadowRewardStatus.earned[index] || 0n;
      shadowTotalRewards += amount;
      
      return {
        token: tokenAddress,
        tokenName: getTokenName(tokenAddress),
        amount,
        amountFormatted: (Number(amount) / (10 ** 18)).toFixed(4),
      };
    }).filter((reward: { token: string; tokenName: string; amount: bigint; amountFormatted: string }) => reward.amount > 0n);
  }

  // For Shadow vaults, check if there are any rewards
  const hasShadowRewards = isShadowVault && shadowRewards.length > 0 && shadowTotalRewards > 0n;

  // Debug Shadow vault rendering logic
  if (isShadowVault) {
    console.log('🔍 SHADOW VAULT RENDERING:', {
      actualAddress: !!actualAddress,
      hasShares,
      hasShadowRewards,
      shadowHasActivePosition,
      shadowTokenId: shadowTokenId?.toString(),
      shadowRewards: shadowRewards.map(r => ({
        token: r.tokenName,
        amount: r.amountFormatted
      })),
      shadowTotalRewards: shadowTotalRewards.toString(),
      buttonShouldBeEnabled: shadowHasActivePosition && hasShadowRewards,
      buttonDisabled: !shadowHasActivePosition || !hasShadowRewards,
      willRender: !!actualAddress && (hasShares || hasShadowRewards || hasQueuedWithdrawal || hasClaimableWithdrawal)
    });
  }

  // Filter non-zero rewards for Metro vaults
  const nonZeroRewards = !isShadowVault && pendingRewards 
    ? pendingRewards.filter((reward: UserRewardStructOutput) => reward.pendingRewards > 0n)
    : [];

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
          {/* APY Display - Vault-wide 24h */}
          <div className="mb-4 pb-4 border-b border-gray-700/30">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 text-center">APY</div>
            <div className="text-center">
              <div className="text-arca-green text-2xl font-bold">
                {aprLoading ? '...' : formatPercentage(apy || 0)}
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
              disabled={isClaimingRewards || nonZeroRewards.length === 0}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isClaimingRewards || nonZeroRewards.length === 0
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-arca-green text-black hover:bg-arca-green/90'
              }`}
            >
              {isClaimingRewards ? 'Claiming...' : 'Claim Rewards'}
            </button>
          </div>
        )}

        {/* Shadow Rewards Section - Shows rewards from 6-token array */}
        {hasShadowRewards && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="space-y-2 mb-3">
              {shadowRewards.map((reward, index: number) => {
                const tokenAmount = Number(reward.amount) / (10 ** 18);

                // Get token price based on token name
                let tokenPrice = 0;
                if (reward.tokenName === 'Metro' && prices?.metro) {
                  tokenPrice = prices.metro;
                } else if (reward.tokenName === 'Shadow' && prices?.shadow) {
                  tokenPrice = prices.shadow;
                } else if (reward.tokenName === 'xShadow' && prices?.xShadow) {
                  tokenPrice = prices.xShadow;
                }

                const usdValue = tokenAmount * tokenPrice;

                // Format USD with appropriate precision for small values
                let usdDisplay = '';
                if (tokenPrice > 0) {
                  if (usdValue < 0.01) {
                    usdDisplay = `($${usdValue.toFixed(4)})`;
                  } else {
                    usdDisplay = `(${formatUSD(usdValue)})`;
                  }
                }

                return (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-400">Rewards:</span>
                    <span className="text-arca-green font-semibold">
                      {reward.amountFormatted} {reward.tokenName} {usdDisplay}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleClaimRewards}
              disabled={isClaimingRewards || !shadowHasActivePosition || shadowRewards.length === 0}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                isClaimingRewards || !shadowHasActivePosition || shadowRewards.length === 0
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
