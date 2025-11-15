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
import PositionVisualizationCard from './PositionVisualizationCard';

interface DashboardVaultCardProps {
  vaultAddress: string;
  stratAddress: string;
  lbBookAddress?: string;
  clpoolAddress?: string;
  rewardsAddress?: string;
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
  name, 
  tier, 
  userAddress,
  tokenX = 'S',
  tokenY = 'USDC'
}: DashboardVaultCardProps) {
  const config = { vaultAddress, stratAddress, rewardsAddress, name, tier, tokenX, tokenY };
  
  // Use the connected wallet address
  const actualAddress = userAddress;

  // Use unified metrics hook
  const metrics = useVaultMetrics(config, actualAddress);
  const { prices } = usePrices();

  const {
    userShares,
    sharePercentage,
    balances,
    totalSupply,
    apy,
    aprLoading,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    handleRedeemWithdrawal,
    isClaimingRewards,
    isRedeemingWithdrawal,
    sonicPrice,
    isShadowVault,
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
const hasClaimableWithdrawal = !!(claimableWithdrawal && claimableWithdrawal > 0n);

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
          {/* APY Display - Vault-wide 24h */}
          <div className="mb-3 pb-3 border-b border-gray-700/30">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1 text-center">APY</div>
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
              <div className="flex justify-between items-center mb-2">
                <div className="text-gray-400 text-sm">Deposited:</div>
                <div className="text-arca-green font-bold text-base">
                  ${(depositedAmounts.token0.usdValue + depositedAmounts.token1.usdValue).toFixed(2)}
                </div>
              </div>
              <div className="space-y-2">
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

        {/* Claimable Withdrawal Section - Shows withdrawal from previous round (can claim now) */}
        {hasClaimableWithdrawal && (
          <div className="bg-black/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400">Claimable Withdrawal:</span>
              <span className="text-arca-green font-semibold">
                {claimableWithdrawal ? (Number(claimableWithdrawal) / 1e12).toFixed(2) : '0.00'} shares
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
    </div>
  );
}

export default DashboardVaultCard;
