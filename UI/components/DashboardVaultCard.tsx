'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useVaultData } from '@/hooks/useVaultData';
import { useTokenPrices, useAPYCalculation } from '@/hooks/useAPYCalculation';
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

  // Determine vault type for reward display
  const isShadowVault = name.includes('Shadow');

  const vaultData = useVaultData(config, actualAddress);
  const dashboardData = useDashboardData(config, actualAddress);
  
  // Fetch token prices for APY calculation
  const { prices, isLoading: pricesLoading } = useTokenPrices();

  const {
    userShares,
    pendingRewards,
    shadowPosition,
    shadowTokenId,
    xShadowEarned,
    shadowEarned,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
  } = dashboardData;

  // Simple check - show if user has shares, pending rewards, queued withdrawal, or claimable withdrawal
  const hasShares = vaultData.userShares && vaultData.userShares > 0n;
  const hasPendingRewards = !isShadowVault && pendingRewards && pendingRewards.length > 0;
  const hasQueuedWithdrawal = queuedWithdrawal && queuedWithdrawal > 0n;
  const hasClaimableWithdrawal = claimableWithdrawal && claimableWithdrawal > 0n;

  // Calculate deposited value in USD (simplified calculation)
  const depositedValueUSD = vaultData.balances ? 
    Number(vaultData.balances[1]) / (10 ** 6) + // USDC amount in USD (6 decimals, 1 USDC = $1)
    (Number(vaultData.balances[0]) / (10 ** 18)) * 1 : 0; // S amount * $1 assumption

  // Calculate APY using actual rewards data
  // For Metro vaults: use pendingRewards structure (pendingRewards[0].pendingRewards)
  // For Shadow vaults: use shadowEarned (Shadow tokens)
  const actualRewardsToken = isShadowVault 
    ? Number(shadowEarned || 0n) / (10 ** 18) // Shadow tokens have 18 decimals
    : (pendingRewards && pendingRewards.length > 0 
        ? Number(pendingRewards[0].pendingRewards) / (10 ** 18) // Metro tokens structure: pendingRewards[0].pendingRewards
        : 0);
  
  const tokenPrice = isShadowVault ? (prices?.shadow || 0) : (prices?.metro || 0);
  
  const { apy: calculatedAPY, isLoading: apyLoading } = useAPYCalculation(
    name,
    depositedValueUSD,
    actualRewardsToken,
    tokenPrice
  );

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
        {/* User Shares */}
        <div className="bg-arca-light-gray/30 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Your Shares:</span>
            <span className="text-white font-semibold">
              {vaultData.userShares?.toString() || '0'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Share %:</span>
            <span className="text-arca-green">
              {vaultData.sharePercentage?.toFixed(4) || '0.0000'}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">APY:</span>
            <span className="text-arca-green font-semibold">
              {apyLoading || pricesLoading ? '...' : formatPercentage(calculatedAPY || 0)}
            </span>
          </div>
        </div>


        {/* Rewards Section - Metro or xShadow */}
        {(isShadowVault ? hasShadowRewards : hasPendingRewards) && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">{isShadowVault ? 'Shadow' : 'Metro'} Rewards:</span>
              <span className={`font-semibold ${
                isShadowVault 
                  ? (shadowHasActivePosition ? 'text-arca-green' : 'text-red-400')
                  : 'text-arca-green'
              }`}>
                {isShadowVault 
                  ? (shadowHasActivePosition ? 'Available' : 'Not Available')
                  : 'Available'
                }
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {isShadowVault ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">xShadow tokens:</span>
                    <span className="text-white">
                      {shadowRewards ? Number(formatUnits(shadowRewards.xShadowEarned, 18)).toFixed(8) : '0.00000000'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Shadow tokens:</span>
                    <span className="text-white">
                      {shadowRewards ? Number(formatUnits(shadowRewards.shadowEarned, 18)).toFixed(8) : '0.00000000'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-gray-600 pt-2">
                    <span className="text-gray-300">Total:</span>
                    <span className="text-arca-green">
                      {shadowRewards ? Number(formatUnits(shadowRewards.totalEarned, 18)).toFixed(8) : '0.00000000'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Metro tokens:</span>
                  <span className="text-white">
                    {dashboardData.pendingRewards && dashboardData.pendingRewards.length > 0
                      ? Number(formatUnits(dashboardData.pendingRewards[0].pendingRewards, 18)).toFixed(8)
                      : '0.00000000'
                    }
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                console.log('🔥 CLAIM BUTTON CLICKED:', {
                  isShadowVault,
                  shadowHasActivePosition,
                  hasShadowRewards,
                  isClaimingRewards: dashboardData.isClaimingRewards
                });
                dashboardData.handleClaimRewards();
              }}
              disabled={isShadowVault ? (!shadowHasActivePosition || !hasShadowRewards) : (!hasPendingRewards || dashboardData.isClaimingRewards)}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                (isShadowVault ? (shadowHasActivePosition && hasShadowRewards) : (hasPendingRewards && !dashboardData.isClaimingRewards))
                  ? 'bg-arca-green text-black hover:bg-arca-green/90'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {dashboardData.isClaimingRewards ? 'Claiming...' : 'Claim Rewards'}
            </button>
          </div>
        )}

        {/* Queued Withdrawal Section - Shows withdrawal in current round (not claimable yet) */}
        {hasQueuedWithdrawal && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Queued Withdrawal:</span>
              <span className="text-yellow-400 font-semibold">
                {dashboardData.queuedWithdrawal?.toString() || '0'} shares
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              Round: {dashboardData.currentRound !== undefined ? Number(dashboardData.currentRound) : 'Loading...'}
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
                {dashboardData.claimableWithdrawal?.toString() || '0'} shares
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              From Round: {dashboardData.currentRound !== undefined ? Number(dashboardData.currentRound) - 1 : 'Loading...'}
            </div>
            <button
              onClick={dashboardData.handleRedeemWithdrawal}
              disabled={dashboardData.isRedeemingWithdrawal}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                dashboardData.isRedeemingWithdrawal
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-arca-green text-black hover:bg-arca-green/90'
              }`}
            >
              {dashboardData.isRedeemingWithdrawal ? 'Claiming...' : 'Claim Withdrawal'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default DashboardVaultCard;
