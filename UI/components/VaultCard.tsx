'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useVaultData } from '@/hooks/useVaultData';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useSonicPrice } from '@/hooks/useSonicPrice';
import { useTokenPrices, useAPYCalculation } from '@/hooks/useAPYCalculation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { CONTRACTS } from '@/lib/contracts';
import { formatTokenAmount, formatUSD, formatPercentage, formatShares } from '@/lib/utils';
import { METRO_VAULT_ABI } from '@/lib/typechain';
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

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const vaultConfig = { vaultAddress, stratAddress, name, tier };
  const { userShares, totalSupply, sharePercentage, balances, isLoading, isError } = useVaultData(vaultConfig, actualAddress);
  
  // Determine if this is a Shadow vault
  const isShadowVault = name.includes('Shadow');
  
  // Fetch appropriate token balance based on vault type
  // For Shadow vaults: fetch wS (ERC20), for Metro vaults: fetch S (native)
  const sonicBalance = useTokenBalance(CONTRACTS.SONIC, isShadowVault ? undefined : actualAddress);
  const wsBalance = useTokenBalance(CONTRACTS.WS, isShadowVault ? actualAddress : undefined);
  const usdcBalance = useTokenBalance(CONTRACTS.USDC, actualAddress);
  const { price: sonicPrice, isLoading: priceLoading } = useSonicPrice();
  
  // Fetch token prices for APY calculation
  const { prices, isLoading: pricesLoading } = useTokenPrices();

  // Get actual rewards data for APY calculation
  const { pendingRewards, shadowEarned } = useDashboardData(vaultConfig, actualAddress);

  // Get preview amounts for user shares to show deposited S and USDC
  const { data: previewData } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'previewAmounts',
    args: [userShares || 0n],
    query: { enabled: !!userShares && userShares > 0n }
  });

  const depositedS = previewData ? previewData[0] : 0n;
  const depositedUsdc = previewData ? previewData[1] : 0n;

  // Calculate total deposited value in USD
  const depositedValueUSD = previewData ? 
    Number(depositedUsdc) / (10 ** 6) + // USDC amount in USD (6 decimals, 1 USDC = $1)
    (Number(depositedS) / (10 ** 18)) * sonicPrice : 0; // S amount * real market price

  // Calculate APY using actual rewards data
  // For Metro vaults: use pendingRewards structure like DashboardVaultCard
  // For Shadow vaults: use shadowEarned (Shadow tokens)
  const actualRewardsToken = isShadowVault 
    ? Number(shadowEarned || 0n) / (10 ** 18) // Shadow tokens have 18 decimals
    : (pendingRewards && pendingRewards.length > 0 
        ? Number(pendingRewards[0].pendingRewards) / (10 ** 18) // Metro tokens structure: pendingRewards[0].pendingRewards
        : 0);
  
  const tokenPrice = isShadowVault ? (prices?.shadow || 0) : (prices?.metro || 0);
  
  const { apy: calculatedAPY, isLoading: apyLoading } = useAPYCalculation(
    name,
    depositedValueUSD,
    actualRewardsToken,
    tokenPrice
  );

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

  // Calculate TVL from strategy balances (S + USDC in USD)
  const calculatedTVL = balances ? 
    Number(balances[1]) / (10 ** 6) + // USDC amount in USD (6 decimals, 1 USDC = $1)
    (Number(balances[0]) / (10 ** 18)) * sonicPrice : 0; // S amount * real market price

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

        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">TVL :</span>
            <span className="text-white font-semibold">
              {isLoading ? '...' : formatUSD(calculatedTVL)}
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
          
          <div className="flex justify-between">
            <span className="text-gray-400">APY :</span>
            <span className="text-arca-green font-semibold">
              {apyLoading || pricesLoading ? '...' : formatPercentage(calculatedAPY)}
            </span>
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
