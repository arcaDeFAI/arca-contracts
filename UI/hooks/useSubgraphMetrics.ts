'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';
import { usePrices, type TokenPrices } from '@/contexts/PriceContext';
import { getTokenPrice, getTokenDecimals } from '@/lib/tokenHelpers';
import { getTokenByAddress } from '@/lib/tokenRegistry';
import { VAULT_CONFIGS, type VaultConfig } from '@/lib/vaultConfigs';

// ---- Raw subgraph response types ----

interface ILSnapshotRaw {
  firstAmountXPerShare: string;
  firstAmountYPerShare: string;
  firstTimestamp: string;
  latestAmountXPerShare: string;
  latestAmountYPerShare: string;
  latestTimestamp: string;
  snapshotCount: string;
  totalBalanceXSum: string;
  totalBalanceYSum: string;
  firstSqrtPriceX96: string;
  latestSqrtPriceX96: string;
  firstLBPrice: string;
  latestLBPrice: string;
  firstPriceXUsd: string | null;
  firstPriceYUsd: string | null;
  vault: { id: string };
}

interface SnapshotRaw {
  amountXPerShare: string;
  amountYPerShare: string;
  sqrtPriceX96: string;
  lbPrice: string;
  timestamp: string;
}

interface RewardEventRaw {
  amount: string;
  timestamp: string;
  rewardToken: string;
  vault: { id: string };
}

type BatchQueryResult = Record<string, ILSnapshotRaw | null | SnapshotRaw[] | RewardEventRaw[]>;

// ---- GraphQL query ----
// One request covers every vault (aliased per vault) instead of one request each â€”
// also means every vault's metrics resolve together instead of popping in staggered.
// window30d / window7d: oldest snapshot within 30d / 7d of now â†’ window start point.
// fee_apr window: 30d if available, else 7d, else all-time (ILSnapshot firstâ†’latest).

const ILSNAPSHOT_FIELDS = `
  firstAmountXPerShare
  firstAmountYPerShare
  firstTimestamp
  latestAmountXPerShare
  latestAmountYPerShare
  latestTimestamp
  snapshotCount
  totalBalanceXSum
  totalBalanceYSum
  firstSqrtPriceX96
  latestSqrtPriceX96
  firstLBPrice
  latestLBPrice
  firstPriceXUsd
  firstPriceYUsd
`;
const SNAPSHOT_WINDOW_FIELDS = `amountXPerShare amountYPerShare sqrtPriceX96 lbPrice timestamp`;

function vaultAliasKeys(vaultAddress: string) {
  const base = 'v' + vaultAddress.toLowerCase().replace(/^0x/, '');
  return { ils: `${base}_ils`, w30: `${base}_w30`, w7: `${base}_w7`, rw: `${base}_rw` };
}

const buildBatchQuery = (vaultAddresses: string[], ts30d: number, ts7d: number) => {
  const parts = vaultAddresses.map((address) => {
    const id = address.toLowerCase();
    const { ils, w30, w7, rw } = vaultAliasKeys(address);
    return `
      ${ils}: ilsnapshot(id: "${id}") { ${ILSNAPSHOT_FIELDS} }
      ${w30}: snapshots(
        where: { vault: "${id}", timestamp_gte: "${ts30d}" }
        orderBy: timestamp
        orderDirection: asc
        first: 1
      ) { ${SNAPSHOT_WINDOW_FIELDS} }
      ${w7}: snapshots(
        where: { vault: "${id}", timestamp_gte: "${ts7d}" }
        orderBy: timestamp
        orderDirection: asc
        first: 1
      ) { ${SNAPSHOT_WINDOW_FIELDS} }
      # timestamp_gte keeps this within the 1000-item cap â€” without it, high-frequency
      # vaults exhaust the cap on old events before the recent window is ever reached.
      ${rw}: rewardEvents(
        where: { vault: "${id}", timestamp_gte: "${ts30d}" }
        orderBy: timestamp
        orderDirection: asc
        first: 1000
      ) { amount timestamp rewardToken }
    `;
  });

  return `query GetAllVaultMetrics {\n${parts.join('\n')}\n}`;
};

const ALL_VAULT_ADDRESSES = VAULT_CONFIGS.map((v) => v.vaultAddress);

function useBatchedVaultSubgraphData() {
  const nowSec = Math.floor(Date.now() / 1000);
  const ts30d = nowSec - 30 * 86400;
  const ts7d = nowSec - 7 * 86400;

  return useQuery({
    queryKey: ['subgraph-metrics-batch', ALL_VAULT_ADDRESSES.join(',')],
    queryFn: () =>
      querySubgraph<BatchQueryResult>(buildBatchQuery(ALL_VAULT_ADDRESSES, ts30d, ts7d)),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// ---- Public result type ----
// Performance vs holding (IL, net return) lives in useVaultPerformance; this hook only supplies
// the reward-APR fallback for vaults without enough VaultDayData history yet.

export interface SubgraphMetrics {
  rewardApr: number | null;
  snapshotCount: number;
  isLoading: boolean;
  error: string | null;
}

// ---- Hook ----

export function useSubgraphMetrics(config: VaultConfig): SubgraphMetrics {
  const { prices } = usePrices();
  const { data, isLoading, error } = useBatchedVaultSubgraphData();
  return computeSubgraphMetrics(config, data, prices, isLoading, error);
}

/** Metrics for every configured vault from the one batched query, keyed by lowercase vault address. */
export function useAllSubgraphMetrics(): Map<string, SubgraphMetrics> {
  const { prices } = usePrices();
  const { data, isLoading, error } = useBatchedVaultSubgraphData();
  return useMemo(() => {
    const out = new Map<string, SubgraphMetrics>();
    for (const config of VAULT_CONFIGS) {
      out.set(config.vaultAddress.toLowerCase(), computeSubgraphMetrics(config, data, prices, isLoading, error));
    }
    return out;
  }, [data, prices, isLoading, error]);
}

function computeSubgraphMetrics(
  config: VaultConfig,
  data: BatchQueryResult | undefined,
  prices: TokenPrices,
  isLoading: boolean,
  error: Error | null,
): SubgraphMetrics {
  const { tokenX = 'S', tokenY = 'USDC', vaultAddress } = config;
  const empty: SubgraphMetrics = { rewardApr: null, snapshotCount: 0, isLoading, error: error ? String(error) : null };
  if (isLoading || !data) return empty;

  const { ils, w30, w7, rw } = vaultAliasKeys(vaultAddress);
  const ilSnapshot = data[ils] as ILSnapshotRaw | null;
  const window30d = data[w30] as SnapshotRaw[];
  const window7d = data[w7] as SnapshotRaw[];
  const rewardEvents = data[rw] as RewardEventRaw[];
  const snapshotCount = Number(ilSnapshot?.snapshotCount ?? 0);
  if (!ilSnapshot || snapshotCount < 2) return { ...empty, isLoading: false, snapshotCount };

  // Window start: 30d if the history spans â‰¥25 days, else 7d if â‰¥5 days, else since the first snapshot
  const latestTs = Number(ilSnapshot.latestTimestamp);
  const snap30d = window30d?.[0];
  const snap7d = window7d?.[0];
  const startTs =
    snap30d && latestTs - Number(snap30d.timestamp) >= 25 * 86400 ? Number(snap30d.timestamp)
    : snap7d && latestTs - Number(snap7d.timestamp) >= 5 * 86400 ? Number(snap7d.timestamp)
    : Number(ilSnapshot.firstTimestamp);
  const days = Math.max((latestTs - startTs) / 86400, 0.01);

  // Reward APR = rewards in the window (at today's prices) Ã· average TVL at rebalances Ã— 365/days
  const priceX = getTokenPrice(tokenX, prices);
  const priceY = getTokenPrice(tokenY, prices);
  const avgBalX = Number(BigInt(ilSnapshot.totalBalanceXSum) / BigInt(snapshotCount)) / 10 ** getTokenDecimals(tokenX);
  const avgBalY = Number(BigInt(ilSnapshot.totalBalanceYSum) / BigInt(snapshotCount)) / 10 ** getTokenDecimals(tokenY);
  const avgTvl = avgBalX * priceX + avgBalY * priceY;

  let rewardApr: number | null = null;
  if (avgTvl > 0) {
    let rewardUsd = 0;
    for (const e of rewardEvents) {
      if (Number(e.timestamp) < startTs || Number(e.timestamp) > latestTs) continue;
      const def = getTokenByAddress(e.rewardToken);
      rewardUsd += (Number(e.amount) / 10 ** (def?.decimals ?? 18)) * (def ? getTokenPrice(def.symbol, prices) : 0);
    }
    if (rewardUsd > 0) rewardApr = (rewardUsd / avgTvl) * (365 / days) * 100;
  }

  return { rewardApr, snapshotCount, isLoading: false, error: null };
}
