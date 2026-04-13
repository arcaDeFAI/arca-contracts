'use client';

import { useState, useEffect } from 'react';
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

interface VaultCardProps {
  config: VaultConfig;
}

export function VaultCard({ config }: VaultCardProps) {
  const { vaultAddress, stratAddress, name, tokenX, tokenY } = config;
  const { address } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Use unified metrics hook
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
  const vsHodl = subgraphMetrics.vsHodl;
  const ilDays = subgraphMetrics.ilDays;

  const position = useVaultPositionData({
    vaultAddress,
    stratAddress,
    lbBookAddress: config.lbBookAddress,
    clpoolAddress: config.clpoolAddress,
    name,
    tokenX,
    tokenY,
  });

  // Fetch token balances dynamically based on vault tokens
  const tokenXDef = getToken(tokenX);
  const tokenYDef = getToken(tokenY);
  const tokenXBalance = useTokenBalance(tokenXDef?.address ?? null, address);
  const tokenYBalance = useTokenBalance(tokenYDef?.address ?? null, address);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-arca-gray/90 backdrop-blur-sm rounded-xl p-5 border border-gray-800/60 h-[320px] animate-pulse flex flex-col justify-between">
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-gray-800 rounded-full" />
          <div className="h-10 w-10 bg-gray-800 rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="h-4 w-1/2 bg-gray-800 rounded" />
          <div className="h-4 w-3/4 bg-gray-800 rounded" />
        </div>
        <div className="h-10 w-full bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative bg-arca-gray/95 backdrop-blur-sm rounded-xl p-5 border border-gray-800/60 transition-all duration-300 hover:border-arca-green/40 hover:shadow-[0_0_20px_rgba(0,255,163,0.1)] w-full flex flex-col h-full"
      >
        {/* DEX Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/40 border border-gray-700/50 rounded-full pl-1.5 pr-2.5 py-1 pointer-events-none">
          {name.includes('Metropolis') ? (
            <>
              <img src="/MetropolisLogo.png" alt="Metro" className="w-4 h-4 object-contain" />
              <span className="text-[10px] font-semibold text-gray-300 tracking-wide uppercase">Metropolis</span>
            </>
          ) : (
            <>
              <img src="/SHadowLogo.jpg" alt="Shadow" className="w-4 h-4 rounded-full object-contain" />
              <span className="text-[10px] font-semibold text-gray-300 tracking-wide uppercase">Shadow</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <TokenPairLogos
              token0Logo={getTokenLogo(tokenX)}
              token1Logo={getTokenLogo(tokenY)}
              size={42}
            />
          </div>
          <h3 className="text-white font-bold text-lg tracking-tight group-hover:text-arca-green transition-colors">
            {name.replace(' | Metropolis', '').replace(' | Shadow', '')}
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            {name.includes('Metropolis') ? 'Algorithmic Rebalancing' : 'Algorithmic Rebalancing'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 space-y-4">

          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">APR</span>
                <Tooltip text={getAPYCalculationExplanation()} width="sm" ariaLabel="APR calculation explanation" />
              </div>
              <div className="text-2xl font-bold text-arca-green tracking-tight">
                {isLoading || aprLoading ? <Skeleton width={60} height={24} className="mt-1" /> : formatPercentage(rewardApr ?? 0)}
              </div>
              {/* vs HODL bubble — hidden for now, re-enable when ready
              {vsHodl !== null && (
                <div className="relative group/iltooltip mt-2">
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    {vsHodl !== null && (
                      <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded-md border tracking-tight whitespace-nowrap ${
                        vsHodl >= 0
                          ? 'bg-arca-green/10 border-arca-green/25 text-arca-green'
                          : 'bg-red-500/10 border-red-500/25 text-red-400'
                      }`}>
                        vs HODL&nbsp;<span className="opacity-80">{vsHodl >= 0 ? '+' : ''}{vsHodl.toFixed(1)}%</span>
                      </span>
                    )}
                    <span className="text-gray-600 text-[11px] cursor-default select-none leading-none">ⓘ</span>
                  </div>
                  <div className="absolute bottom-full left-0 mb-2 z-50 hidden group-hover/iltooltip:block w-56">
                    <div className="bg-[#0e1117] border border-gray-700/60 rounded-xl p-3 shadow-2xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 font-medium">Data window</span>
                        <span className="text-white font-bold">{ilDays > 0 ? `${Math.round(ilDays)}d` : '—'}</span>
                      </div>
                      {vsHodl !== null && ilDays > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-medium">vs HODL annualized</span>
                          <span className={`font-bold ${vsHodl >= 0 ? 'text-arca-green' : 'text-red-400'}`}>
                            {(vsHodl * 365 / ilDays) >= 0 ? '+' : ''}{(vsHodl * 365 / ilDays).toFixed(1)}%/yr
                          </span>
                        </div>
                      )}
                      <div className="border-t border-gray-800 pt-2 text-[10px] text-gray-600 leading-relaxed">
                        Measured since vault inception. Positive = vault outperformed simply holding both tokens.
                      </div>
                    </div>
                  </div>
                </div>
              )}
              */}
            </div>

            <div>
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">TVL</span>
              <div className="text-xl font-bold text-white">
                {isLoading ? <Skeleton width={60} height={24} className="mt-1" /> : formatUSD(vaultTVL)}
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="pt-4 border-t border-gray-800/50 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Your Deposit</span>
              <span className="text-white font-semibold">
                {isLoading ? <Skeleton width={50} height={20} /> : formatUSD(depositedValueUSD)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Share of Pool</span>
              <span className="text-gray-300">
                {isLoading ? <Skeleton width={40} height={20} /> : `${sharePercentage.toFixed(2)}%`}
              </span>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Range</span>
                {activePercentage !== undefined && activePercentage > 0 && (
                  <span className="text-white text-[11px] font-medium">{activePercentage.toFixed(0)}% active liquidity</span>
                )}
              </div>
              <RangeBar position={position} tokenY={tokenY} compact />
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2 bg-arca-green/60 rounded-sm" />
                  <span className="text-[10px] text-white/70">LP Range</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-[3px] h-2.5 bg-red-400 rounded-full" />
                  <span className="text-[10px] text-white/70">Current Price</span>
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
            className="bg-arca-green text-black font-extrabold py-3 px-4 rounded-lg hover:bg-white hover:scale-[1.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_10px_rgba(0,255,163,0.15)]"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!address || !userShares || userShares === 0n}
            className="bg-transparent border border-gray-700 text-gray-300 font-semibold py-3 px-4 rounded-lg hover:border-gray-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
        </div>
      </div>

      {showDepositModal && (
        <DepositModal
          vaultAddress={vaultAddress}
          stratAddress={stratAddress}
          vaultName={name}
          tokenXBalance={(tokenXBalance?.data as bigint) || 0n}
          tokenYBalance={(tokenYBalance?.data as bigint) || 0n}
          tokenX={tokenX}
          tokenY={tokenY}
          onClose={() => setShowDepositModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          vaultAddress={vaultAddress}
          vaultName={name}
          userShares={userShares || 0n}
          tokenX={tokenX}
          tokenY={tokenY}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </>
  );
}
