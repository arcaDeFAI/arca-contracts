'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { formatUSD, formatPercentage } from '@/lib/utils';

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

  // Use unified metrics hook - same calculation as VaultCard
  const {
    userShares,
    sharePercentage,
    balances,
    depositedValueUSD,
    vaultTVL,
    apr: calculatedAPR,
    dailyApr: calculatedDailyAPR,
    aprLoading,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
    prices,
    isLoading: pricesLoading,
  } = useVaultMetrics(config, actualAddress);

  // Debug pending rewards
  console.log(`🔍 ${name} Pending Rewards:`, {
    pendingRewards,
    length: pendingRewards?.length,
    hasNonZeroRewards: pendingRewards?.some(r => r.pendingRewards > 0n),
    totalRewards: pendingRewards?.reduce((sum, r) => sum + r.pendingRewards, 0n).toString(),
    raw: JSON.stringify(pendingRewards, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  });

  // Token address to name mapping
  const TOKEN_NAMES: { [key: string]: string } = {
    '0x71e99522ead5e21cf57f1f542dc4ad2e841f7321': 'Metro',
    '0x3333b97138d4b086720b5ae8a7844b1345a33333': 'Shadow',
    '0x5050bc082FF4A74Fb6B0B04385dEfdDB114b2424': 'xShadow', 
    '0x3333111A391cC08fa51353E9195526A70b333333': 'x33', 
    '0x5555b2733602DEd58D47b8D3D989E631CBee5555': 'Shadow Gems', 
    '0x29219dd400f2Bf60E5a23d13Be72B486D4038894': 'USDC',   
    '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38': 'wS'     
  };

  // Helper function to get token name from address
  const getTokenName = (address: string): string => {
    return TOKEN_NAMES[address.toLowerCase()] || 'Unknown Token';
  };

  // Filter rewards to only show non-zero amounts
  const nonZeroRewards = pendingRewards?.filter((r: any) => r.pendingRewards > 0n) || [];
  
  // Simple check - show if user has shares, pending rewards, queued withdrawal, or claimable withdrawal
  const hasShares = userShares && userShares > 0n;
  const hasPendingRewards = nonZeroRewards.length > 0;
  const hasQueuedWithdrawal = queuedWithdrawal && queuedWithdrawal > 0n;
  const hasClaimableWithdrawal = claimableWithdrawal && claimableWithdrawal > 0n;

  // Debug: Log data before APR calculation
  console.log(`📋 DashboardVaultCard Data for ${name}:`, {
    vaultTotalS: balances ? (Number(balances[0]) / 10**18).toFixed(4) : '0',
    vaultTotalUsdc: balances ? (Number(balances[1]) / 10**6).toFixed(2) : '0',
    vaultTVL: `$${vaultTVL.toFixed(2)}`,
    userSharePercentage: `${sharePercentage.toFixed(4)}%`,
    userDepositedValueUSD: `$${depositedValueUSD.toFixed(4)}`,
    calculation: `$${vaultTVL.toFixed(2)} × ${sharePercentage.toFixed(4)}% = $${depositedValueUSD.toFixed(4)}`,
    pendingRewards: pendingRewards?.length || 0,
    isShadowVault,
  });

  console.log(`📈 APY Display for ${name}:`, {
    instantAPY: calculatedAPR,
    dailyAvgAPY: calculatedDailyAPR,
    depositedValueUSD: `$${depositedValueUSD.toFixed(4)}`,
  });

  // Don't render if user has no activity or no wallet connected
  if (!actualAddress || (!hasShares && !hasPendingRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal)) {
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
        {/* APY Display */}
        <div className="bg-arca-light-gray/20 rounded-lg p-4 border border-gray-700/50">
          <div className="text-gray-400 text-sm uppercase tracking-wider mb-3 text-center">APY</div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Instant APY - Based on most recent harvest */}
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">Instant</div>
              <div className="text-arca-green text-lg font-semibold">
                {aprLoading || pricesLoading ? '...' : formatPercentage(calculatedAPR || 0)}
              </div>
            </div>
            
            {/* 24h Average APY - Based on harvests over last 24 hours */}
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">24h Avg</div>
              <div className="text-blue-400 text-lg font-semibold">
                {aprLoading || pricesLoading ? '...' : formatPercentage(calculatedDailyAPR || 0)}
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
              {nonZeroRewards.map((reward, index) => {
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
