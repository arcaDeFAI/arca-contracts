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

interface VaultCardProps {
  vaultAddress: string;
  stratAddress: string;
  poolSymbol?: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
  tokenX?: string;
  tokenY?: string;
}

export function VaultCard({ vaultAddress, stratAddress, poolSymbol, name, tier, tokenX = 'S', tokenY = 'USDC' }: VaultCardProps) {
  const { address, isConnected } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Use unified metrics hook - eliminates duplication
  const vaultConfig = { vaultAddress, stratAddress, poolSymbol, name, tier, tokenX, tokenY };
  const metrics = useVaultMetrics(vaultConfig, address);

  const {
    userShares,
    totalSupply,
    sharePercentage,
    balances,
    depositedValueUSD,
    vaultTVL,
    apy,
    apy30dMean,
    aprLoading,
    pendingRewards,
    isLoading,
    isError,
    prices,
    sonicPrice,
    isShadowVault,
  } = metrics;

  // Fetch token balances for deposit/withdraw
  const sonicBalance = useTokenBalance(CONTRACTS.SONIC, isShadowVault ? undefined : address);
  const wsBalance = useTokenBalance(CONTRACTS.WS, isShadowVault ? address : undefined);
  const usdcBalance = useTokenBalance(CONTRACTS.USDC, address);
  const wethBalance = useTokenBalance(CONTRACTS.WETH, address);

  // Calculate deposited amounts for display
  const depositedS = balances ? balances[0] : 0n;
  const depositedUsdc = balances ? balances[1] : 0n;

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Active': return 'text-arca-green';
      case 'Premium': return 'text-blue-400';
      case 'Elite': return 'text-purple-400';
      default: return 'text-arca-green';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Active': return '';
      case 'Premium': return '';
      case 'Elite': return '';
      default: return '';
    }
  };

  return (
    <>
      <div className="bg-black rounded-lg p-5 border border-arca-green/20 hover:border-arca-green/50 transition-all shadow-[0_0_15px_rgba(0,255,163,0.15)] hover:shadow-[0_0_30px_rgba(0,255,163,0.3)] w-full flex flex-col">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <TokenPairLogos 
              token0Logo={getTokenLogo(tokenX)} 
              token1Logo={getTokenLogo(tokenY)} 
              size={42}
            />
            <h3 className="text-white font-semibold text-sm">{name}</h3>
          </div>
          <span className={`text-xs ${getTierColor(tier)}`}>{tier}</span>
        </div>

        <div className="flex-1">
          <div className="space-y-2">
            {/* Vault Stats */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">TVL:</span>
                <span className="text-white font-semibold">
                  {isLoading ? '...' : formatUSD(vaultTVL)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Deposited:</span>
                <span className="text-white">
                  {isLoading ? '...' : formatUSD(depositedValueUSD)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shares (%):</span>
                <span className="text-arca-green font-semibold">
                  {isLoading ? '...' : `${sharePercentage.toFixed(4)}%`}
                </span>
              </div>
            </div>

            {/* APR Display */}
            <div className="bg-black/50 rounded-lg p-2.5 border border-gray-800/60">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-0.5 text-center group relative">
                APR
                {apy30dMean !== null && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-black border border-arca-green rounded-lg text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    30d Avg: {formatPercentage(apy30dMean)}
                  </div>
                )}
              </div>
              <div className="text-center">
                <div className="text-arca-green text-lg font-semibold">
                  {aprLoading || isLoading ? '...' : formatPercentage(apy)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons inside the same card */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowDepositModal(true)}
            disabled={!address}
            className="flex-1 bg-arca-green text-black font-semibold py-2.5 px-4 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!address || !userShares || userShares === 0n}
            className="flex-1 bg-transparent border border-gray-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
