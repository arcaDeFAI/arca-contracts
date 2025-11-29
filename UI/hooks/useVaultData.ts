'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { METRO_VAULT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';
import { type VaultConfig } from '@/lib/vaultConfigs';

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
