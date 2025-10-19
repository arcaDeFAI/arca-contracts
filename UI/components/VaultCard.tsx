'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { CONTRACTS } from '@/lib/contracts';
import { formatUSD, formatPercentage } from '@/lib/utils';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';

interface VaultCardProps {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
  apy: number;
}

export function VaultCard({ vaultAddress, stratAddress, name, tier, apy }: VaultCardProps) {
  const { address, isConnected } = useAccount();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Use actual wallet address for testing
  const testAddress = '0x10dF75c83571b5dAA9638a84BB7490177A8E5816' as `0x${string}`;
  const actualAddress = address || testAddress;

  // Use unified metrics hook - eliminates duplication
  const vaultConfig = { vaultAddress, stratAddress, name, tier };
  const metrics = useVaultMetrics(vaultConfig, actualAddress);

  const {
    userShares,
    totalSupply,
    sharePercentage,
    balances,
    depositedValueUSD,
    vaultTVL,
    apr: calculatedAPR,
    dailyApr: calculatedDailyAPR,
    aprLoading,
    pendingRewards,
    isLoading,
    isError,
    prices,
    sonicPrice,
    isShadowVault,
  } = metrics;

  // Fetch token balances for deposit/withdraw
  const sonicBalance = useTokenBalance(CONTRACTS.SONIC, isShadowVault ? undefined : actualAddress);
  const wsBalance = useTokenBalance(CONTRACTS.WS, isShadowVault ? actualAddress : undefined);
  const usdcBalance = useTokenBalance(CONTRACTS.USDC, actualAddress);

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
      <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray hover:border-arca-green/30 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getTierIcon(tier)}</div>
            <div>
              <h3 className="text-white font-semibold">{name}</h3>
              <span className={`text-sm ${getTierColor(tier)}`}>{tier}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {/* Vault Stats */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">TVL :</span>
              <span className="text-white font-semibold">
                {isLoading ? '...' : formatUSD(vaultTVL)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Deposited :</span>
              <span className="text-white">
                {isLoading ? '...' : formatUSD(depositedValueUSD)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Shares (%) :</span>
              <span className="text-arca-green font-semibold">
                {isLoading ? '...' : `${sharePercentage.toFixed(4)}%`}
              </span>
            </div>
          </div>

          {/* APY Display */}
          <div className="bg-arca-light-gray/20 rounded-lg p-4 border border-gray-700/50">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3 text-center">APY</div>
            <div className="grid grid-cols-2 gap-3">
              {/* Instant APY */}
              <div className="text-center">
                <div className="text-gray-500 text-xs mb-1">Instant</div>
                <div className="text-arca-green text-xl font-semibold">
                  {aprLoading || isLoading ? '...' : formatPercentage(calculatedAPR)}
                </div>
              </div>

              {/* 24h Average APY */}
              <div className="text-center">
                <div className="text-gray-500 text-xs mb-1">24h Avg</div>
                <div className="text-blue-400 text-xl font-semibold">
                  {aprLoading || isLoading ? '...' : formatPercentage(calculatedDailyAPR)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowDepositModal(true)}
            disabled={!address}
            className="flex-1 bg-arca-green text-black font-semibold py-3 px-4 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!address || !userShares || userShares === 0n}
            className="flex-1 bg-transparent border border-gray-600 text-white font-semibold py-3 px-4 rounded-lg hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          onClose={() => setShowDepositModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          vaultAddress={vaultAddress}
          vaultName={name}
          userShares={userShares || 0n}
          userSBalance={0n}
          userUsdcBalance={0n}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </>
  );
}
