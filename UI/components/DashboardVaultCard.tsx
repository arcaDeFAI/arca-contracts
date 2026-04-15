'use client';

import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { formatUSD, formatPercentage, formatShares } from '@/lib/utils';
import { type UserRewardStructOutput } from '@/lib/typechain';
import { getTokenByAddress } from '@/lib/tokenRegistry';
import { METRO_VAULT_ABI } from '@/lib/typechain';
import { getTokenLogo, getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { usePrices } from '@/contexts/PriceContext';
import { useState } from 'react';
import PositionVisualizationCard from './PositionVisualizationCard';
import { type VaultConfig } from '@/lib/vaultConfigs';

interface DashboardVaultCardProps {
  config: VaultConfig;
  userAddress?: string;
}

export function DashboardVaultCard({
  config,
  userAddress,
}: DashboardVaultCardProps) {
  const { vaultAddress, stratAddress, name, tier, tokenX, tokenY } = config;
  const lbBookAddress = config.protocol === 'metropolis' ? config.lbBookAddress : undefined;
  const clpoolAddress = config.protocol === 'shadow' ? config.clpoolAddress : undefined;

  const actualAddress = userAddress;

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
    handleCancelWithdrawal,
    isClaimingRewards,
    isRedeemingWithdrawal,
    isCancellingWithdrawal,
    sonicPrice,
    activeLiquidity,
    reservedLiquidity,
  } = metrics;

  const depositedAmounts = (() => {
    if (!balances || !userShares || !totalSupply || totalSupply === 0n) {
      return null;
    }

    const shareRatio = Number(userShares) / Number(totalSupply);

    const token0Decimals = getTokenDecimals(tokenX);
    const token0Amount = Number(formatUnits(balances[0], token0Decimals)) * shareRatio;
    const token0Price = getTokenPrice(tokenX, prices, sonicPrice);
    const token0Value = token0Amount * token0Price;

    const token1Decimals = getTokenDecimals(tokenY);
    const token1Amount = Number(formatUnits(balances[1], token1Decimals)) * shareRatio;
    const token1Price = getTokenPrice(tokenY, prices);
    const token1Value = token1Amount * token1Price;

    return {
      token0: { name: tokenX, amount: token0Amount, usdValue: token0Value },
      token1: { name: tokenY, amount: token1Amount, usdValue: token1Value }
    };
  })();

  const [showActiveBreakdown, setShowActiveBreakdown] = useState(false);
  const [showReservedBreakdown, setShowReservedBreakdown] = useState(false);

  const liquidityPercentages = (() => {
    if (!balances || !idleBalances) {
      return { activePercentage: 0, reservedPercentage: 0 };
    }

    const token0Price = getTokenPrice(tokenX, prices, sonicPrice);
    const token1Price = getTokenPrice(tokenY, prices);

    const totalToken0 = Number(formatUnits(balances[0], getTokenDecimals(tokenX)));
    const totalToken1 = Number(formatUnits(balances[1], getTokenDecimals(tokenY)));
    const idleToken0 = Number(formatUnits(idleBalances[0], getTokenDecimals(tokenX)));
    const idleToken1 = Number(formatUnits(idleBalances[1], getTokenDecimals(tokenY)));

    const totalValueUSD = (totalToken0 * token0Price) + (totalToken1 * token1Price);
    const idleValueUSD = (idleToken0 * token0Price) + (idleToken1 * token1Price);

    if (totalValueUSD === 0) {
      return { activePercentage: 0, reservedPercentage: 0 };
    }

    const reservedPercentage = (idleValueUSD / totalValueUSD) * 100;
    const activePercentage = 100 - reservedPercentage;

    return { activePercentage, reservedPercentage };
  })();

  const userLiquidityBreakdown = (() => {
    if (!balances || !idleBalances || !userShares || !totalSupply || totalSupply === 0n) {
      return {
        activeLiquidity: { token0: 0, token1: 0, usdValue: 0, token0Percentage: 0, token1Percentage: 0 },
        reservedLiquidity: { token0: 0, token1: 0, usdValue: 0, token0Percentage: 0, token1Percentage: 0 },
        totalLiquidity: { token0: 0, token1: 0 }
      };
    }

    const shareRatio = Number(userShares) / Number(totalSupply);

    const token0Price = getTokenPrice(tokenX, prices, sonicPrice);
    const token1Price = getTokenPrice(tokenY, prices);

    const totalToken0 = Number(formatUnits(balances[0], getTokenDecimals(tokenX))) * shareRatio;
    const totalToken1 = Number(formatUnits(balances[1], getTokenDecimals(tokenY))) * shareRatio;

    const userActiveToken0 = Number(formatUnits(activeLiquidity.token0, getTokenDecimals(tokenX))) * shareRatio;
    const userActiveToken1 = Number(formatUnits(activeLiquidity.token1, getTokenDecimals(tokenY))) * shareRatio;
    const activeUSDValue = (userActiveToken0 * token0Price) + (userActiveToken1 * token1Price);

    const userReservedToken0 = Number(formatUnits(reservedLiquidity.token0, getTokenDecimals(tokenX))) * shareRatio;
    const userReservedToken1 = Number(formatUnits(reservedLiquidity.token1, getTokenDecimals(tokenY))) * shareRatio;
    const reservedUSDValue = (userReservedToken0 * token0Price) + (userReservedToken1 * token1Price);

    const activeToken0Percentage = totalToken0 > 0 ? (userActiveToken0 / totalToken0) * 100 : 0;
    const activeToken1Percentage = totalToken1 > 0 ? (userActiveToken1 / totalToken1) * 100 : 0;
    const reservedToken0Percentage = totalToken0 > 0 ? (userReservedToken0 / totalToken0) * 100 : 0;
    const reservedToken1Percentage = totalToken1 > 0 ? (userReservedToken1 / totalToken1) * 100 : 0;

    return {
      activeLiquidity: {
        token0: userActiveToken0, token1: userActiveToken1, usdValue: activeUSDValue,
        token0Percentage: activeToken0Percentage, token1Percentage: activeToken1Percentage
      },
      reservedLiquidity: {
        token0: userReservedToken0, token1: userReservedToken1, usdValue: reservedUSDValue,
        token0Percentage: reservedToken0Percentage, token1Percentage: reservedToken1Percentage
      },
      totalLiquidity: { token0: totalToken0, token1: totalToken1 }
    };
  })();

  const { data: queuedPreviewAmounts } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: queuedWithdrawal ? [queuedWithdrawal] : undefined,
    query: {
      enabled: !!queuedWithdrawal && queuedWithdrawal > 0n,
    },
  });

  const hasShares = !!(userShares && userShares > 0n);
  const hasPendingRewards = !!(pendingRewards && pendingRewards.some((r: UserRewardStructOutput) => r.pendingRewards > 0n));
  const hasQueuedWithdrawal = !!(queuedWithdrawal && queuedWithdrawal > 0n);
  const hasClaimableWithdrawal = !!(claimableWithdrawals && claimableWithdrawals.length > 0);

  const nonZeroRewards = pendingRewards
    ? pendingRewards.filter((reward: UserRewardStructOutput) => reward.pendingRewards > 0n)
    : [];

  if (!actualAddress) return null;

  const isWithdrawalDataLoading = currentRound === undefined;

  if (!hasShares && !hasPendingRewards && isWithdrawalDataLoading) {
    return (
      <div className="bg-arca-gray/80 rounded-2xl border border-white/[0.04] p-4 shadow-card">
        <div className="text-arca-text-tertiary text-sm text-center animate-pulse">
          Loading withdrawal data...
        </div>
      </div>
    );
  }

  if (!hasShares && !hasPendingRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal) {
    return null;
  }

  // Liquidity breakdown toggle
  const LiquiditySection = ({ label, percentage, breakdown, isOpen, onToggle }: {
    label: string; percentage: number;
    breakdown: { token0: number; token1: number; usdValue: number; token0Percentage: number; token1Percentage: number };
    isOpen: boolean; onToggle: () => void;
  }) => (
    <div className="pt-1">
      <div className="flex justify-between items-center">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-left hover:bg-white/[0.02] p-1 rounded-lg transition-colors"
        >
          <span className="text-arca-text-secondary text-xs font-medium">{label}</span>
          <span className="text-arca-text-tertiary text-[12px]">({percentage.toFixed(1)}%)</span>
          <svg className={`w-3 h-3 text-arca-text-tertiary transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {isOpen && (
          <span className="text-arca-text text-xs font-medium">${breakdown.usdValue.toFixed(2)}</span>
        )}
      </div>

      {isOpen && (
        <div className="px-2 pb-2 mt-1.5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { token: tokenX, amount: breakdown.token0, pct: breakdown.token0Percentage, price: getTokenPrice(tokenX, prices, sonicPrice) },
              { token: tokenY, amount: breakdown.token1, pct: breakdown.token1Percentage, price: getTokenPrice(tokenY, prices, sonicPrice) },
            ].map(({ token, amount, pct, price }) => (
              <div key={token} className="flex items-center gap-2">
                <img src={getTokenLogo(token)} alt={token} className="w-4 h-4 rounded-full" />
                <div>
                  <div className="text-arca-text font-medium text-[12px]">
                    {amount.toFixed(4)} <span className="text-arca-text-tertiary">({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="text-arca-text-tertiary text-[11px]">
                    ${(amount * price).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-arca-gray/80 backdrop-blur-sm border border-white/[0.04] rounded-2xl shadow-card hover:shadow-card-hover transition-all overflow-hidden">
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

      {/* Card Content */}
      <div className="p-4 border-t border-white/[0.04]">
        <div className="space-y-3">
          {/* APR + Share Info */}
          <div className="bg-arca-surface rounded-xl p-3 border border-white/[0.03]">
            {/* APR */}
            <div className="mb-3 pb-3 border-b border-white/[0.04]">
              <div className="text-arca-text-tertiary text-[11px] uppercase tracking-wider mb-1 text-center font-medium group relative">
                APR
                {apy30dMean !== null && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-arca-gray border border-white/[0.08] rounded-lg text-arca-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-elevated">
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

            {/* Share % */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-arca-text-secondary text-xs">Share %:</span>
              <span className="text-arca-text font-medium text-xs">
                {sharePercentage?.toFixed(2) || '0.00'}%
              </span>
            </div>

            {/* Deposited Amounts */}
            {depositedAmounts && (
              <div className="mt-2 pt-2 border-t border-white/[0.04]">
                {/* Total Balance */}
                <div className="flex justify-between items-center mb-2">
                  <span className="text-arca-text-secondary text-xs">Balance:</span>
                  <span className="text-arca-green font-bold text-sm">
                    ${(depositedAmounts.token0.usdValue + depositedAmounts.token1.usdValue).toFixed(2)}
                  </span>
                </div>

                {/* Token Breakdown */}
                <div className="space-y-1.5 mb-3">
                  {[depositedAmounts.token0, depositedAmounts.token1].map((token, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <img src={getTokenLogo(i === 0 ? tokenX : tokenY)} alt={token.name} className="w-3.5 h-3.5 rounded-full" />
                        <span className="text-arca-text-secondary text-xs">{token.name}:</span>
                      </div>
                      <div className="text-right">
                        <span className="text-arca-text font-medium text-xs">{token.amount.toFixed(2)}</span>
                        <span className="text-arca-text-tertiary text-[12px] ml-1">(${token.usdValue.toFixed(2)})</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Liquidity Breakdown */}
                {balances && idleBalances && (
                  <>
                    <div className="border-t border-white/[0.04] pt-2 mt-2">
                      <span className="text-arca-text-secondary text-xs font-medium">Liquidity</span>
                    </div>

                    <LiquiditySection
                      label="Active"
                      percentage={liquidityPercentages.activePercentage}
                      breakdown={userLiquidityBreakdown.activeLiquidity}
                      isOpen={showActiveBreakdown}
                      onToggle={() => setShowActiveBreakdown(!showActiveBreakdown)}
                    />

                    <LiquiditySection
                      label="Reserved"
                      percentage={liquidityPercentages.reservedPercentage}
                      breakdown={userLiquidityBreakdown.reservedLiquidity}
                      isOpen={showReservedBreakdown}
                      onToggle={() => setShowReservedBreakdown(!showReservedBreakdown)}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Rewards Section */}
          {hasPendingRewards && (
            <div className="bg-arca-surface rounded-xl p-3 border border-white/[0.03]">
              <div className="space-y-1.5 mb-2">
                {nonZeroRewards.map((reward: UserRewardStructOutput, index: number) => {
                  const tokenDef = getTokenByAddress(reward.token);
                  const tokenName = tokenDef?.displayName ?? 'Unknown';
                  const tokenAmount = Number(formatUnits(reward.pendingRewards, 18));

                  const priceKey = tokenDef?.canonicalName.toLowerCase();
                  const tokenPrice = priceKey && prices ? (prices[priceKey] || 0) : 0;
                  const usdValue = tokenAmount * tokenPrice;

                  let usdDisplay = '';
                  if (tokenPrice > 0) {
                    usdDisplay = usdValue < 0.01 ? `($${usdValue.toFixed(4)})` : `(${formatUSD(usdValue)})`;
                  }

                  return (
                    <div key={index} className="flex justify-between items-center text-xs">
                      <span className="text-arca-text-secondary">Rewards:</span>
                      <span className="text-arca-green font-medium">
                        {tokenAmount.toFixed(4)} {tokenName} {usdDisplay}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleClaimRewards}
                disabled={isClaimingRewards || nonZeroRewards.length === 0}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all ${isClaimingRewards || nonZeroRewards.length === 0
                  ? 'bg-white/[0.04] text-arca-text-tertiary cursor-not-allowed'
                  : 'bg-arca-green text-arca-dark hover:bg-arca-green/90 hover:shadow-glow-green active:scale-[0.98]'
                  }`}
              >
                {isClaimingRewards ? 'Claiming...' : 'Claim Rewards'}
              </button>
            </div>
          )}

          {/* Queued Withdrawal */}
          {hasQueuedWithdrawal && (
            <div className="bg-arca-surface rounded-xl p-3 border border-white/[0.03]">
              <div className="flex justify-between items-center mb-2 text-xs">
                <span className="text-arca-text-secondary">Queued Withdrawal:</span>
                <span className="text-amber-400 font-medium">
                  {queuedWithdrawal ? formatShares(queuedWithdrawal, tokenX, tokenY) : '0.00'} shares
                </span>
              </div>

              {queuedPreviewAmounts && (
                <div className="bg-arca-dark/30 rounded-lg p-2 mb-2 space-y-1">
                  <div className="text-[10px] text-arca-text-tertiary mb-1">Estimated:</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-arca-text-secondary">{tokenX}:</span>
                    <span className="text-arca-text font-medium">
                      {Number(formatUnits(queuedPreviewAmounts[0], getTokenDecimals(tokenX))).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-arca-text-secondary">{tokenY}:</span>
                    <span className="text-arca-text font-medium">
                      {Number(formatUnits(queuedPreviewAmounts[1], getTokenDecimals(tokenY))).toFixed(4)}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-arca-text-tertiary mb-1">
                Round: {currentRound !== undefined ? Number(currentRound) : 'Loading...'}
              </div>
              <div className="text-[11px] text-amber-400/70 text-center py-1.5 mb-2">
                Claimable in the next round
              </div>

              <button
                onClick={() => queuedWithdrawal && handleCancelWithdrawal(queuedWithdrawal)}
                disabled={isCancellingWithdrawal || !queuedWithdrawal}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${isCancellingWithdrawal || !queuedWithdrawal
                  ? 'bg-white/[0.04] text-arca-text-tertiary cursor-not-allowed'
                  : 'bg-red-500/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 active:scale-[0.98]'
                  }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isCancellingWithdrawal ? 'Cancelling...' : 'Cancel Withdrawal'}
              </button>
            </div>
          )}

          {/* Claimable Withdrawal */}
          {hasClaimableWithdrawal && (
            <div className="bg-arca-surface rounded-xl p-3 border border-white/[0.03]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-arca-text-secondary text-xs">Claimable{claimableWithdrawals && claimableWithdrawals.length > 1 ? 's' : ''}:</span>
                <span className="text-arca-green font-medium text-xs">
                  {totalClaimableAmount ? formatShares(totalClaimableAmount, tokenX, tokenY) : '0.00'} shares
                </span>
              </div>

              {claimableWithdrawals && claimableWithdrawals.map((withdrawal) => (
                <div key={Number(withdrawal.round)} className="mb-2">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-arca-text-tertiary">Round {Number(withdrawal.round)}:</span>
                    <span className="text-arca-text-secondary">{formatShares(withdrawal.amount, tokenX, tokenY)} shares</span>
                  </div>
                  <button
                    onClick={() => handleRedeemWithdrawal(withdrawal.round)}
                    disabled={isRedeemingWithdrawal}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-all ${isRedeemingWithdrawal
                      ? 'bg-white/[0.04] text-arca-text-tertiary cursor-not-allowed'
                      : 'bg-arca-green text-arca-dark hover:bg-arca-green/90 hover:shadow-glow-green active:scale-[0.98]'
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
