'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useVaultData } from '@/hooks/useVaultData';
import { formatUSD } from '@/lib/utils';
import { CONTRACTS } from '@/lib/contracts';

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

  const vaultData = useVaultData(config, actualAddress);
  const dashboardData = useDashboardData(config, actualAddress);

  // Simple check - show if user has shares, pending rewards, or queued withdrawal
  const hasShares = vaultData.userShares && vaultData.userShares > 0n;
  const hasPendingRewards = dashboardData.pendingRewards && dashboardData.pendingRewards.length > 0;
  const hasQueuedWithdrawal = dashboardData.queuedWithdrawal && dashboardData.queuedWithdrawal > 0n;
  
  // Don't render if user has no activity or no wallet connected
  if (!actualAddress || (!hasShares && !hasPendingRewards && !hasQueuedWithdrawal)) {
    return null;
  }

  console.log(`🔍 VAULT DEBUG - ${name}:`, {
    userShares: vaultData.userShares?.toString(),
    hasShares,
    pendingRewards: dashboardData.pendingRewards,
    hasPendingRewards,
    currentRound: dashboardData.currentRound?.toString(),
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5';
      case 'Premium': return 'text-purple-400 border-purple-400/20 bg-purple-400/5';
      case 'Active': return 'text-blue-400 border-blue-400/20 bg-blue-400/5';
      default: return 'text-gray-400 border-gray-400/20 bg-gray-400/5';
    }
  };

  const formatMetroAmount = (rewards: any) => {
    if (!rewards || !Array.isArray(rewards) || rewards.length === 0) return '0';
    // Sum up all pending rewards from the array
    const totalRewards = rewards.reduce((sum: bigint, reward: any) => {
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
        </div>

        {/* Metro Rewards Section */}
        {hasPendingRewards && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Metro Rewards:</span>
              <span className="text-arca-green font-semibold">Available</span>
            </div>
            <div className="space-y-2 mb-3">
              {dashboardData.pendingRewards?.map((reward, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    {reward.token === CONTRACTS.METRO ? 'METRO' : 'Token'}:
                  </span>
                  <span className="text-white">
                    {formatUnits(reward.pendingRewards, 18)}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={dashboardData.handleClaimRewards}
              disabled={!hasPendingRewards || dashboardData.isClaimingRewards}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                hasPendingRewards && !dashboardData.isClaimingRewards
                  ? 'bg-arca-green text-black hover:bg-arca-green/90'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {dashboardData.isClaimingRewards ? 'Claiming...' : 'Claim Rewards'}
            </button>
          </div>
        )}

        {/* Queued Withdrawal Section */}
        {hasQueuedWithdrawal && (
          <div className="bg-arca-light-gray/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Queued Withdrawal:</span>
              <span className="text-yellow-400 font-semibold">
                {dashboardData.queuedWithdrawal?.toString() || '0'} shares
              </span>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              Round: {dashboardData.withdrawalRound?.toString() || 'Loading...'}
            </div>
            <button
              onClick={dashboardData.handleRedeemWithdrawal}
              disabled={!dashboardData.queuedWithdrawal || dashboardData.withdrawalRound === undefined || dashboardData.isRedeemingWithdrawal}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                dashboardData.queuedWithdrawal && dashboardData.withdrawalRound !== undefined && !dashboardData.isRedeemingWithdrawal
                  ? 'bg-arca-green text-black hover:bg-arca-green/90'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
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
