'use client';

import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';
import { getTokenDecimals } from '@/lib/tokenHelpers';
import { type VaultConfig } from '@/lib/vaultConfigs';

const DAY = 86_400;

export interface SnapshotRaw {
  amountXPerShare: string;
  amountYPerShare: string;
  priceXUsd: string;
  priceYUsd: string;
  timestamp: string;
  blockNumber: string;
}
interface DayRaw {
  date: number;
  rewardsUsd: string;
  tvlUsd: string | null;
}

export interface PerformanceWindow {
  days: number;
  /** All values are fractions (0.1 = +10%) over the window, not annualised */
  shareReturn: number;   // USD value of one share: price moves + rebalancing IL − AUM fee (no fees: gauge LPs earn emissions only)
  rewardReturn: number;  // rewards paid per $1 held (sum of daily rewards ÷ that day's TVL)
  vaultReturn: number;   // shareReturn + rewardReturn — what a depositor actually got
  holdReturn: number;    // holding the exact tokens one share held at the start
  vsHold: number;        // vaultReturn − holdReturn
  aumFeeCost: number;    // AUM fee over the window (≈ fee% × days/365)
  rebalancingIl: number; // what's left: shareReturn − holdReturn + aumFeeCost (≤ 0 means IL)
}

export type WindowKey = '30d' | 'all';

const snapshotFields = 'amountXPerShare amountYPerShare priceXUsd priceYUsd timestamp blockNumber';
const priced = 'priceXUsd_not: null, priceYUsd_not: null, amountXPerShare_gt: "0"';

/**
 * Depositor performance vs simply holding the tokens, per window. Computed from rebalance
 * snapshots (share composition + USD prices) and daily rewards in the subgraph.
 */
export function useVaultPerformance(config: VaultConfig, aumFeePct: number | null) {
  const id = config.vaultAddress.toLowerCase();
  const since30 = Math.floor(Date.now() / 1000 / DAY) * DAY - 30 * DAY;

  const { data, isLoading } = useQuery({
    queryKey: ['subgraph', 'performance', id],
    queryFn: () =>
      querySubgraph<{ first30: SnapshotRaw[]; firstAll: SnapshotRaw[]; last: SnapshotRaw[]; days: DayRaw[] }>(`{
        first30: snapshots(where: { vault: "${id}", timestamp_gte: "${since30}", ${priced} }, orderBy: timestamp, orderDirection: asc, first: 1) { ${snapshotFields} }
        firstAll: snapshots(where: { vault: "${id}", ${priced} }, orderBy: timestamp, orderDirection: asc, first: 1) { ${snapshotFields} }
        last: snapshots(where: { vault: "${id}", ${priced} }, orderBy: timestamp, orderDirection: desc, first: 1) { ${snapshotFields} }
        days: vaultDayDatas(where: { vault: "${id}" }, orderBy: date, first: 1000) { date rewardsUsd tvlUsd }
      }`),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const dX = getTokenDecimals(config.tokenX);
  const dY = getTokenDecimals(config.tokenY);

  function compute(first: SnapshotRaw | undefined): PerformanceWindow | null {
    const last = data?.last[0];
    if (!first || !last || Number(last.timestamp) <= Number(first.timestamp)) return null;
    const start = Number(first.timestamp);
    const end = Number(last.timestamp);
    const days = (end - start) / DAY;
    if (days < 1) return null;

    const ax0 = Number(first.amountXPerShare) / 10 ** dX;
    const ay0 = Number(first.amountYPerShare) / 10 ** dY;
    const ax1 = Number(last.amountXPerShare) / 10 ** dX;
    const ay1 = Number(last.amountYPerShare) / 10 ** dY;
    const px0 = Number(first.priceXUsd), py0 = Number(first.priceYUsd);
    const px1 = Number(last.priceXUsd), py1 = Number(last.priceYUsd);

    const pps0 = ax0 * px0 + ay0 * py0;
    if (pps0 <= 0) return null;
    const shareReturn = (ax1 * px1 + ay1 * py1) / pps0 - 1;
    const holdReturn = (ax0 * px1 + ay0 * py1) / pps0 - 1;

    let rewardReturn = 0;
    let tvl: number | null = null;
    for (const day of data?.days ?? []) {
      if (day.tvlUsd) tvl = Number(day.tvlUsd);
      if (day.date >= start - DAY && day.date <= end && tvl) rewardReturn += Number(day.rewardsUsd) / tvl;
    }

    const aumFeeCost = ((aumFeePct ?? 0) / 100) * (days / 365);
    const vaultReturn = shareReturn + rewardReturn;
    return {
      days,
      shareReturn,
      rewardReturn,
      vaultReturn,
      holdReturn,
      vsHold: vaultReturn - holdReturn,
      aumFeeCost,
      rebalancingIl: shareReturn - holdReturn + aumFeeCost,
    };
  }

  return {
    isLoading,
    windows: {
      '30d': compute(data?.first30[0]),
      all: compute(data?.firstAll[0]),
    } satisfies Record<WindowKey, PerformanceWindow | null>,
    /** Start and end rebalance snapshot of each window (for comparing other vaults on the same moments) */
    bounds: {
      '30d': { first: data?.first30[0], last: data?.last[0] },
      all: { first: data?.firstAll[0], last: data?.last[0] },
    } satisfies Record<WindowKey, { first?: SnapshotRaw; last?: SnapshotRaw }>,
  };
}

export function formatSignedPct(fraction: number): string {
  const v = fraction * 100;
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
}
