'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';
import { VAULT_CONFIGS } from '@/lib/vaultConfigs';

export interface VaultDayDataRaw {
  date: number;
  rewardsUsd: string;
  tvlUsd: string | null;
  ppsUsd: string | null;
  unpricedRewardEvents: number;
}

export interface HistoryPoint {
  /** unix seconds, 00:00 UTC */
  date: number;
  /** 7-day trailing reward APR in % (smooths out the day-to-day lumpiness of reward forwards) */
  apr: number | null;
  tvlUsd: number | null;
  /** USD value of 1e24 raw vault shares at the day's last rebalance (carried forward) */
  ppsUsd: number | null;
  rewardsUsd: number;
}

export type HistoryStatus = 'loading' | 'ready' | 'empty' | 'unavailable';

const DAY = 86_400;
const SMOOTHING_DAYS = 7;

/**
 * Daily APR / TVL history for one vault from the subgraph's VaultDayData entity.
 * Rewards are priced by the subgraph at the time they were forwarded, so past APR does
 * not move when reward-token prices change.
 *
 * Status 'unavailable' means the deployed subgraph predates VaultDayData (v1.0.18).
 */
export function useVaultHistory(vaultAddress: string) {
  const { histories, unpriced, isLoading } = useAllVaultHistories();
  const id = vaultAddress.toLowerCase();
  const points = histories?.get(id) ?? [];

  const status: HistoryStatus = isLoading
    ? 'loading'
    : histories === null
      ? 'unavailable'
      : points.length === 0
        ? 'empty'
        : 'ready';

  return { points, status, unpricedRewardEvents: unpriced.get(id) ?? 0 };
}

/**
 * History for every configured vault in one request (shared by the list, vault page and
 * dashboard), keyed by lowercase vault address. `histories` stays null when the deployed
 * subgraph predates VaultDayData.
 */
export function useAllVaultHistories() {
  const { data, isLoading } = useQuery({
    queryKey: ['subgraph', 'allVaultHistories'],
    queryFn: () => {
      const parts = VAULT_CONFIGS.map((c) => {
        const id = c.vaultAddress.toLowerCase();
        return `v${id.slice(2)}: vaultDayDatas(where: { vault: "${id}" }, orderBy: date, orderDirection: asc, first: 1000) {
          date rewardsUsd tvlUsd ppsUsd unpricedRewardEvents
        }`;
      });
      return querySubgraph<Record<string, VaultDayDataRaw[]>>(`query AllVaultHistories {\n${parts.join('\n')}\n}`);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { histories, unpriced } = useMemo(() => {
    const unpriced = new Map<string, number>();
    if (!data) return { histories: null, unpriced };
    const histories = new Map<string, HistoryPoint[]>();
    for (const c of VAULT_CONFIGS) {
      const id = c.vaultAddress.toLowerCase();
      const rows = data[`v${id.slice(2)}`] ?? [];
      histories.set(id, buildHistory(rows));
      unpriced.set(id, rows.reduce((s, r) => s + r.unpricedRewardEvents, 0));
    }
    return { histories, unpriced };
  }, [data]);

  return { histories, unpriced, isLoading };
}

/** Minimum days of history before the day-data APR replaces the fallback estimate. */
export const MIN_APR_HISTORY_DAYS = 7;

/**
 * Daily series from VaultDayData rows. Every day from the first row to today is filled in;
 * a day without a row had no rewards and no rebalance, so its TVL carries forward.
 */
export function buildHistory(rows: VaultDayDataRaw[]): HistoryPoint[] {
  if (rows.length === 0) return [];

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
  const daily: Array<{ date: number; rewardsUsd: number; tvlUsd: number | null; ppsUsd: number | null }> = [];
  let lastTvl: number | null = null;
  let lastPps: number | null = null;
  for (let d = rows[0].date; d <= today; d += DAY) {
    const row = byDate.get(d);
    if (row?.tvlUsd) lastTvl = Number(row.tvlUsd);
    if (row?.ppsUsd && Number(row.ppsUsd) > 0) lastPps = Number(row.ppsUsd);
    daily.push({ date: d, rewardsUsd: row ? Number(row.rewardsUsd) : 0, tvlUsd: lastTvl, ppsUsd: lastPps });
  }

  return daily.map((day, i) => {
    const window = daily.slice(Math.max(0, i - SMOOTHING_DAYS + 1), i + 1);
    const withTvl = window.filter((w) => w.tvlUsd !== null && w.tvlUsd > 0);
    let apr: number | null = null;
    if (withTvl.length > 0) {
      const rewards = window.reduce((s, w) => s + w.rewardsUsd, 0);
      const avgTvl = withTvl.reduce((s, w) => s + (w.tvlUsd ?? 0), 0) / withTvl.length;
      apr = (rewards / avgTvl) * (365 / window.length) * 100;
    }
    return { date: day.date, apr, tvlUsd: day.tvlUsd, ppsUsd: day.ppsUsd, rewardsUsd: day.rewardsUsd };
  });
}

/** Average APR over a range: total rewards ÷ average TVL, annualised. */
export function averageApr(points: HistoryPoint[]): number | null {
  const withTvl = points.filter((p) => p.tvlUsd !== null && p.tvlUsd > 0);
  if (withTvl.length === 0) return null;
  const rewards = points.reduce((s, p) => s + p.rewardsUsd, 0);
  const avgTvl = withTvl.reduce((s, p) => s + (p.tvlUsd ?? 0), 0) / withTvl.length;
  return (rewards / avgTvl) * (365 / points.length) * 100;
}
