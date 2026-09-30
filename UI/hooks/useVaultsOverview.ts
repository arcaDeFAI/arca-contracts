'use client';

import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { METRO_STRAT_ABI, METRO_VAULT_ABI } from '@/lib/typechain';
import { VAULT_CONFIGS, type VaultConfig } from '@/lib/vaultConfigs';
import { usePrices } from '@/contexts/PriceContext';
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers';
import { useAllSubgraphMetrics, type SubgraphMetrics } from './useSubgraphMetrics';
import { averageApr, MIN_APR_HISTORY_DAYS, useAllVaultHistories } from './useVaultHistory';

export interface VaultOverview {
  config: VaultConfig;
  tvlUsd: number;
  /** Reward APR shown to users (never negative); null while unknown */
  apr: number | null;
  /** Annual AUM fee in % (e.g. 10); null while loading */
  aumFeePct: number | null;
  metrics: SubgraphMetrics | undefined;
  userShares: bigint;
  totalSupply: bigint;
  userUsd: number;
}

/**
 * TVL, APR and the connected user's position for every vault — three multicalls total,
 * instead of a set of hooks per vault. Safe to call from a list page.
 */
export function useVaultsOverview(userAddress?: string) {
  const { prices, isLoading: pricesLoading } = usePrices();
  const metricsByVault = useAllSubgraphMetrics();
  const { histories } = useAllVaultHistories();

  const balancesQ = useReadContracts({
    contracts: VAULT_CONFIGS.map((c) => ({
      address: c.stratAddress as `0x${string}`,
      abi: METRO_STRAT_ABI,
      functionName: 'getBalances' as const,
    })),
  });

  // AUM fee in basis points (strategy.getAumAnnualFee), same call on both protocols
  const feeQ = useReadContracts({
    contracts: VAULT_CONFIGS.map((c) => ({
      address: c.stratAddress as `0x${string}`,
      abi: METRO_STRAT_ABI,
      functionName: 'getAumAnnualFee' as const,
    })),
    query: { staleTime: 10 * 60 * 1000 },
  });

  const supplyQ = useReadContracts({
    contracts: VAULT_CONFIGS.map((c) => ({
      address: c.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'totalSupply' as const,
    })),
  });

  const userQ = useReadContracts({
    contracts: VAULT_CONFIGS.map((c) => ({
      address: c.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'balanceOf' as const,
      args: [(userAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`] as const,
    })),
    query: { enabled: !!userAddress },
  });

  const vaults = useMemo<VaultOverview[]>(() => {
    return VAULT_CONFIGS.map((config, i) => {
      const balances = balancesQ.data?.[i]?.result;
      const totalSupply = supplyQ.data?.[i]?.result ?? 0n;
      const userShares = (userAddress ? userQ.data?.[i]?.result : undefined) ?? 0n;

      let tvlUsd = 0;
      if (balances) {
        const [amountX, amountY] = balances;
        tvlUsd =
          (Number(amountX) / 10 ** getTokenDecimals(config.tokenX)) * getTokenPrice(config.tokenX, prices) +
          (Number(amountY) / 10 ** getTokenDecimals(config.tokenY)) * getTokenPrice(config.tokenY, prices);
      }

      const userUsd = totalSupply > 0n ? tvlUsd * (Number(userShares) / Number(totalSupply)) : 0;

      // Preferred: last 30 days of VaultDayData (rewards priced on the day paid ÷ average daily TVL).
      // Fallback until the subgraph has that history: snapshot-based estimate from useSubgraphMetrics.
      const metrics = metricsByVault.get(config.vaultAddress.toLowerCase());
      const history = histories?.get(config.vaultAddress.toLowerCase()) ?? [];
      let apr: number | null = null;
      if (history.length >= MIN_APR_HISTORY_DAYS) {
        apr = averageApr(history.slice(-30));
      } else if (metrics && !metrics.isLoading && metrics.rewardApr !== null) {
        apr = metrics.rewardApr;
      }
      if (apr !== null) apr = Math.max(0, apr);

      const feeBps = feeQ.data?.[i]?.result;
      const aumFeePct = feeBps !== undefined ? Number(feeBps) / 100 : null;

      return { config, tvlUsd, apr, aumFeePct, metrics, userShares, totalSupply, userUsd };
    });
  }, [balancesQ.data, supplyQ.data, userQ.data, feeQ.data, userAddress, prices, metricsByVault, histories]);

  const isLoading = balancesQ.isLoading || supplyQ.isLoading || pricesLoading;
  const aprLoading = [...metricsByVault.values()].some((m) => m.isLoading);

  return { vaults, isLoading, aprLoading };
}
