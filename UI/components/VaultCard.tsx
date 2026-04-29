'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccount } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { getToken } from '@/lib/tokenRegistry';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { getTokenLogo } from '@/lib/tokenUtils';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { TokenPairLogos } from './TokenPairLogos';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { Skeleton } from './Skeleton';
import { useVaultPositionData } from '@/hooks/useVaultPositionData';
import { RangeBar } from './RangeBar';
import { Tooltip } from './Tooltip';
import { getAPYCalculationExplanation } from '@/hooks/useSubgraphMetrics';
import { DexBadge } from './DexBadge';

interface VaultCardProps {
  config: VaultConfig;
}

export function VaultCard({ config }: VaultCardProps) {
  const { vaultAddress, stratAddress, name, tokenX, tokenY } = config;
  const { address } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  const metrics = useVaultMetrics(config, address);

  const {
    userShares,
    sharePercentage,
    depositedValueUSD,
    vaultTVL,
    aprLoading,
    isLoading,
    activePercentage,
    subgraphMetrics,
  } = metrics;

  const rewardApr = subgraphMetrics.rewardApr;

  const position = useVaultPositionData({
    vaultAddress,
    stratAddress,
    lbBookAddress: config.lbBookAddress,
    clpoolAddress: config.clpoolAddress,
    name,
    tokenX,
    tokenY,
  });

  const tokenXDef = getToken(tokenX);
  const tokenYDef = getToken(tokenY);
  const tokenXBalance = useTokenBalance(tokenXDef?.address ?? null, address);
  const tokenYBalance = useTokenBalance(tokenYDef?.address ?? null, address);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-arca-gray/80 rounded-2xl p-6 border border-white/[0.04] shadow-card h-[360px] animate-pulse flex flex-col justify-between">
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-white/[0.04] rounded-full" />
          <div className="h-10 w-10 bg-white/[0.04] rounded-full -ml-4" />
        </div>
        <div className="space-y-3 mt-6">
          <div className="h-5 w-2/3 bg-white/[0.04] rounded-lg" />
          <div className="h-4 w-1/2 bg-white/[0.04] rounded-lg" />
        </div>
        <div className="space-y-2 mt-auto">
          <div className="h-3 w-full bg-white/[0.04] rounded-lg" />
          <div className="h-10 w-full bg-white/[0.04] rounded-xl" />
        </div>
      </div>
    );
  }

  const cleanName = name.replace(' | Metropolis', '').replace(' | Shadow', '');
  const depositDisabledReason = !address ? 'Connect wallet to deposit' : undefined;
  const withdrawDisabledReason = !address
    ? 'Connect wallet to withdraw'
    : !userShares || userShares === 0n
      ? 'No deposited shares to withdraw'
      : undefined;

  return (
    <>
      <div className="vault-card-glow group relative flex h-full w-full flex-col rounded-2xl border border-white/[0.04] bg-arca-gray/80 p-6 shadow-card backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-[2px] hover:border-white/[0.07]">

        {/* DEX Badge — top right */}
        <DexBadge name={name} compact className="absolute right-5 top-5" />

        {/* Token pair + name */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <TokenPairLogos
              token0Logo={getTokenLogo(tokenX)}
              token1Logo={getTokenLogo(tokenY)}
              size={40}
            />
          </div>
          <h3 className="text-arca-text font-semibold text-lg tracking-tight group-hover:text-white transition-colors">
            {cleanName}
          </h3>
          <p className="text-xs text-arca-text-tertiary font-medium mt-0.5">
            Algorithmic Rebalancing
          </p>
        </div>

        {/* Key Metrics */}
        <div className="flex-1 space-y-4">

          {/* APR + TVL row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-arca-text-tertiary text-[11px] font-medium uppercase tracking-wider">APR</span>
                <Tooltip text={getAPYCalculationExplanation()} width="sm" ariaLabel="APR calculation explanation" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-arca-green tabular-nums">
                {isLoading || aprLoading ? <Skeleton width={60} height={24} /> : formatPercentage(rewardApr ?? 0)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-arca-text-tertiary text-[11px] font-medium uppercase tracking-wider">TVL</span>
              </div>
              <div className="text-2xl font-bold tracking-tight text-arca-text tabular-nums">
                {isLoading ? <Skeleton width={60} height={24} /> : formatUSD(vaultTVL)}
              </div>
            </div>
          </div>

          {/* Divider + secondary stats */}
          <div className="pt-4 border-t border-white/[0.04] space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-arca-text-tertiary">Your Deposit</span>
              <span className="font-medium text-arca-text tabular-nums">
                {isLoading ? <Skeleton width={50} height={18} /> : formatUSD(depositedValueUSD)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-arca-text-tertiary">Share of Pool</span>
              <span className="text-arca-text-secondary tabular-nums">
                {isLoading ? <Skeleton width={40} height={18} /> : `${sharePercentage.toFixed(2)}%`}
              </span>
            </div>

            {/* Range visualization */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-arca-text-tertiary text-[11px] font-medium uppercase tracking-wider">Range</span>
                {activePercentage !== undefined && activePercentage > 0 && (
                  <span className="text-[11px] font-medium text-arca-text-secondary tabular-nums">{activePercentage.toFixed(0)}% active</span>
                )}
              </div>
              <RangeBar position={position} tokenY={tokenY} compact />
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-1.5 bg-arca-green/50 rounded-sm" />
                  <span className="text-[10px] text-arca-text-tertiary">LP Range</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-[3px] h-2 bg-red-400 rounded-full" />
                  <span className="text-[10px] text-arca-text-tertiary">Price</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            onClick={() => setShowDepositModal(true)}
            disabled={!address}
            aria-label={depositDisabledReason ?? `Deposit into ${cleanName}`}
            title={depositDisabledReason}
            className="arca-focus rounded-xl bg-arca-green px-4 py-2.5 text-sm font-semibold text-arca-dark transition-[background-color,box-shadow,transform,opacity] duration-200 hover:scale-[1.02] hover:bg-white hover:shadow-glow-green active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!address || !userShares || userShares === 0n}
            aria-label={withdrawDisabledReason ?? `Withdraw from ${cleanName}`}
            title={withdrawDisabledReason}
            className="arca-focus rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-arca-text-secondary transition-[background-color,border-color,color,opacity,transform] duration-200 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-arca-text active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-25 disabled:active:scale-100"
          >
            Withdraw
          </button>
        </div>
      </div>

      {mounted && showDepositModal && createPortal(
        <DepositModal
          vaultAddress={vaultAddress}
          stratAddress={stratAddress}
          vaultName={name}
          tokenXBalance={(tokenXBalance?.data as bigint) || 0n}
          tokenYBalance={(tokenYBalance?.data as bigint) || 0n}
          tokenX={tokenX}
          tokenY={tokenY}
          onClose={() => setShowDepositModal(false)}
        />,
        document.body
      )}

      {mounted && showWithdrawModal && createPortal(
        <WithdrawModal
          vaultAddress={vaultAddress}
          vaultName={name}
          userShares={userShares || 0n}
          tokenX={tokenX}
          tokenY={tokenY}
          onClose={() => setShowWithdrawModal(false)}
        />,
        document.body
      )}
    </>
  );
}
