'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { CONTRACTS } from '@/lib/contracts';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { getTokenLogo } from '@/lib/tokenUtils';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { TokenPairLogos } from './TokenPairLogos';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { Skeleton } from './Skeleton';

interface VaultCardProps {
  config: VaultConfig;
}

export function VaultCard({ config }: VaultCardProps) {
  const { vaultAddress, stratAddress, name, tier, tokenX, tokenY } = config;
  const { address, isConnected } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Use unified metrics hook
  const metrics = useVaultMetrics(config, address);

  const {
    userShares,
    sharePercentage,
    balances,
    depositedValueUSD,
    vaultTVL,
    apy,
    apy30dMean,
    aprLoading,
    isLoading,
    isShadowVault,
  } = metrics;

  // Fetch token balances for deposit/withdraw
  const sonicBalance = useTokenBalance(CONTRACTS.SONIC, isShadowVault ? undefined : address);
  const wsBalance = useTokenBalance(CONTRACTS.WS, isShadowVault ? address : undefined);
  const usdcBalance = useTokenBalance(CONTRACTS.USDC, address);
  const wethBalance = useTokenBalance(CONTRACTS.WETH, address);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Active': return 'text-arca-green';
      case 'Premium': return 'text-blue-400';
      case 'Elite': return 'text-purple-400';
      default: return 'text-arca-green';
    }
  };

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
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">APY</span>
              <div className="text-2xl font-bold text-arca-green tracking-tight">
                {isLoading || aprLoading ? <Skeleton width={60} height={24} className="mt-1" /> : formatPercentage(apy)}
              </div>
              {apy30dMean !== null && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  30d Avg: {formatPercentage(apy30dMean)}
                </div>
              )}
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
          sonicBalance={(sonicBalance?.data as bigint) || 0n}
          wsBalance={(wsBalance?.data as bigint) || 0n}
          usdcBalance={(usdcBalance?.data as bigint) || 0n}
          wethBalance={(wethBalance?.data as bigint) || 0n}
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
