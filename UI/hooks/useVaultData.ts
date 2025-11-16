'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { METRO_VAULT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';

interface VaultConfig {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
}

export function useVaultData(config: VaultConfig, userAddress?: string) {
  // Get user's vault shares
  const { data: userShares, isLoading: sharesLoading } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  // Get total supply of vault shares
  const { data: totalSupply, isLoading: totalSupplyLoading } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'totalSupply',
    args: [],
    query: {
      enabled: !!config.vaultAddress,
    },
  });

  // Get strategy balances (S and USDC amounts)
  const { data: balances } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: METRO_STRAT_ABI,
    functionName: 'getBalances',
    query: {
      enabled: !!config.stratAddress,
    },
  });

  // Get strategy idle balances (tokens not in LP)
  const { data: idleBalances } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: METRO_STRAT_ABI,
    functionName: 'getIdleBalances',
    query: {
      enabled: !!config.stratAddress,
    },
  });

  // Calculate user's percentage share of vault
  const sharePercentage = userShares && totalSupply && totalSupply > 0n
    ? (Number(userShares) / Number(totalSupply)) * 100
    : 0;

  // Debug contract call results - RAW VALUES
  if (userShares !== undefined || totalSupply !== undefined) {
    console.log('🔍 RAW CONTRACT VALUES:', {
      vault: config.name,
      vaultAddress: config.vaultAddress,
      userAddress,
      userShares_RAW: userShares,
      userShares_STRING: userShares?.toString(),
      userShares_DECIMAL: userShares ? Number(userShares) : 0,
      totalSupply_RAW: totalSupply,
      totalSupply_STRING: totalSupply?.toString(),
      totalSupply_DECIMAL: totalSupply ? Number(totalSupply) : 0,
      sharePercentage: sharePercentage.toFixed(8),
      sharesLoading,
      totalSupplyLoading,
      calculation: userShares && totalSupply ? `${userShares.toString()} / ${totalSupply.toString()} = ${sharePercentage}%` : 'N/A',
      manualCalc: userShares && totalSupply ? `${Number(userShares)} / ${Number(totalSupply)} * 100 = ${(Number(userShares) / Number(totalSupply) * 100).toFixed(6)}%` : 'N/A',
      WARNING: userShares === totalSupply ? '⚠️ userShares equals totalSupply - check contract' : 'OK'
    });
  }

  return {
    userShares,
    totalSupply,
    sharePercentage,
    balances: balances as [bigint, bigint] | undefined,
    idleBalances: idleBalances as [bigint, bigint] | undefined,
    isLoading: sharesLoading || totalSupplyLoading,
    isError: false,
    config,
  };
}
