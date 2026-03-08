'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAccount } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { CONTRACTS } from '@/lib/contracts';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { getTokenLogo } from '@/lib/tokenUtils';
import { TokenPairLogos } from './TokenPairLogos';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { Skeleton } from './Skeleton';

// Lazy load modals for better initial page load performance
const DepositModal = dynamic(
  () => import('./DepositModal').then(mod => ({ default: mod.DepositModal })),
  { ssr: false }
);

const WithdrawModal = dynamic(
  () => import('./WithdrawModal').then(mod => ({ default: mod.WithdrawModal })),
  { ssr: false }
);

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
      <div className="bg-arca-card backdrop-blur-sm rounded-xl p-5 border border-arca-border h-[320px] flex flex-col justify-between shimmer">
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-arca-border rounded-full" />
          <div className="h-10 w-10 bg-arca-border rounded-full" />
        </div>
        <div className="space-y-4">
          <div className="h-4 w-1/2 bg-arca-border rounded" />
          <div className="h-4 w-3/4 bg-arca-border rounded" />
        </div>
        <div className="h-10 w-full bg-arca-border rounded" />
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative bg-arca-card backdrop-blur-sm rounded-xl p-5 border border-arca-border transition-all duration-300 hover:border-arca-green/50 hover:bg-arca-card-hover hover:shadow-[0_0_25px_rgba(0,255,136,0.12)] w-full flex flex-col h-full hover-lift card-glow animate-fadeIn"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* DEX Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-arca-dark/80 border border-arca-border rounded-full pl-1.5 pr-2.5 py-1 pointer-events-none">
          {name.includes('Metropolis') ? (
            <>
              <img src="/MetropolisLogo.png" alt="Metro" className="w-4 h-4 object-contain" />
              <span className="text-[10px] font-semibold text-arca-text-secondary tracking-wide uppercase">Metropolis</span>
            </>
          ) : (
            <>
              <img src="/SHadowLogo.jpg" alt="Shadow" className="w-4 h-4 rounded-full object-contain" />
              <span className="text-[10px] font-semibold text-arca-text-secondary tracking-wide uppercase">Shadow</span>
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
          <p className="text-xs text-arca-text-muted font-medium">
            {name.includes('Metropolis') ? 'Algorithmic Rebalancing' : 'Algorithmic Rebalancing'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 space-y-4">

          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-arca-text-muted text-xs font-semibold uppercase tracking-wider">APY</span>
              <div className="text-2xl font-bold text-arca-green tracking-tight">
                {isLoading || aprLoading ? <Skeleton width={60} height={24} className="mt-1" /> : formatPercentage(apy)}
              </div>
              {apy30dMean !== null && (
                <div className="text-[10px] text-arca-text-muted mt-0.5">
                  30d Avg: {formatPercentage(apy30dMean)}
                </div>
              )}
            </div>

            <div>
              <span className="text-arca-text-muted text-xs font-semibold uppercase tracking-wider">TVL</span>
              <div className="text-xl font-bold text-white">
                {isLoading ? <Skeleton width={60} height={24} className="mt-1" /> : formatUSD(vaultTVL)}
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="pt-4 border-t border-arca-border space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-arca-text-secondary font-medium">Your Deposit</span>
              <span className="text-white font-semibold">
                {isLoading ? <Skeleton width={50} height={20} /> : formatUSD(depositedValueUSD)}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-arca-text-secondary font-medium">Share of Pool</span>
              <span className="text-arca-text-secondary">
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
            className="bg-arca-green text-black font-extrabold py-3 px-4 rounded-lg hover:bg-white hover:scale-[1.02] transition-all btn-press disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(0,255,136,0.2)] hover:shadow-[0_6px_20px_rgba(0,255,136,0.3)]"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!address || !userShares || userShares === 0n}
            className="bg-transparent border border-arca-border text-arca-text-secondary font-semibold py-3 px-4 rounded-lg hover:border-arca-border-light hover:text-white hover:bg-arca-card-hover transition-all btn-press disabled:opacity-40 disabled:cursor-not-allowed"
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
