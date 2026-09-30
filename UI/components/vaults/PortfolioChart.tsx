'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { useAllVaultHistories, type HistoryPoint } from '@/hooks/useVaultHistory';
import { querySubgraph } from '@/lib/subgraph';
import { getTokenDecimals } from '@/lib/tokenHelpers';
import { cn, formatApr, formatUSD, formatUSDCompact } from '@/lib/utils';
import { Card, Segmented, Skeleton } from '@/components/ui';
import { COMPARE_COLOR, SERIES_COLOR, TimeSeriesChart, type SeriesPoint } from '@/components/TimeSeriesChart';
import { ChartPlaceholder, RANGE_OPTIONS, sliceRange } from './VaultHistoryChart';

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

type Metric = 'value' | 'apr' | 'claimed';
type Range = (typeof RANGE_OPTIONS)[number]['value'];

const METRIC_OPTIONS = [
  { value: 'value', label: 'Value' },
  { value: 'apr', label: 'My APR' },
  { value: 'claimed', label: 'Rewards claimed' },
] as const;

const DAY = 86_400;
const SHARE_UNIT = 1e24; // VaultDayData.ppsUsd is the USD value of 1e24 raw shares

/**
 * Tokens per 1e24 shares at each held vault's first priced rebalance on/after `date`, keyed by
 * lowercase vault address — the "if you had held" basket. One batched request.
 */
function useStartBaskets(held: VaultOverview[], date: number | null) {
  const ids = held.map((v) => v.config.vaultAddress.toLowerCase());
  const { data } = useQuery({
    queryKey: ['subgraph', 'startBaskets', ids.join(','), date],
    queryFn: () =>
      querySubgraph<Record<string, Array<{ amountXPerShare: string; amountYPerShare: string }>>>(`{
        ${ids
          .map(
            (id) => `v${id.slice(2)}: snapshots(where: { vault: "${id}", timestamp_gte: "${date}", priceXUsd_not: null, priceYUsd_not: null, amountXPerShare_gt: "0" },
              orderBy: timestamp, orderDirection: asc, first: 1) { amountXPerShare amountYPerShare }`,
          )
          .join('\n')}
      }`),
    enabled: date !== null && ids.length > 0,
    staleTime: Infinity,
  });
  if (!data) return null;
  const out = new Map<string, { x: number; y: number }>();
  for (const v of held) {
    const id = v.config.vaultAddress.toLowerCase();
    const s = data[`v${id.slice(2)}`]?.[0];
    if (s) {
      out.set(id, {
        x: Number(s.amountXPerShare) / 10 ** getTokenDecimals(v.config.tokenX),
        y: Number(s.amountYPerShare) / 10 ** getTokenDecimals(v.config.tokenY),
      });
    }
  }
  return out;
}

const NOTES: Record<Metric, string> = {
  value:
    'Your current vault shares each day, plus the rewards they earned since the start of the period, vs holding the tokens those shares had on day one. Your own deposits and withdrawals are left out, so it shows only how the vaults performed.',
  apr: 'APR of the vaults you hold, weighted by how much you have in each today.',
  claimed: 'Claimed rewards, valued at today’s token prices.',
};

/**
 * Dashboard chart: the user's position value from strategy performance alone, their blended
 * APR, and their running total of claimed rewards.
 */
export function PortfolioChart({
  vaults,
  claimed,
  claimedLoading,
}: {
  vaults: VaultOverview[];
  claimed: Array<{ date: number; usd: number }>;
  claimedLoading: boolean;
}) {
  const { histories, isLoading: historiesLoading } = useAllVaultHistories();
  const [metric, setMetric] = useState<Metric>('value');
  const [range, setRange] = useState<Range>('30');

  const held = useMemo(() => vaults.filter((v) => v.userUsd > 0.01), [vaults]);

  // Days where every held vault has a share price and token prices, with each vault's data that day
  const valueDays = useMemo(() => {
    if (!histories || held.length === 0) return [];
    const byVault = held.map((v) => new Map((histories.get(v.config.vaultAddress.toLowerCase()) ?? []).map((p) => [p.date, p])));
    const dates = [...new Set(byVault.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
    const out: Array<{ date: number; vaults: HistoryPoint[] }> = [];
    for (const date of dates) {
      const day = byVault.map((m) => m.get(date));
      if (day.every((p): p is HistoryPoint => !!p && p.ppsUsd !== null && p.priceXUsd !== null && p.priceYUsd !== null)) {
        out.push({ date, vaults: day });
      }
    }
    return out;
  }, [histories, held]);

  const visibleValueDays = useMemo(() => sliceRange(valueDays, range), [valueDays, range]);
  const baskets = useStartBaskets(held, metric === 'value' ? (visibleValueDays[0]?.date ?? null) : null);

  const valueSeries = useMemo<SeriesPoint[]>(() => {
    if (visibleValueDays.length === 0 || !baskets) return [];
    const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
    const live = held.reduce((s, v) => s + v.userUsd, 0);
    const rewards = held.map(() => 0);
    let holdScale = 1;

    return visibleValueDays.map(({ date, vaults: day }, i) => {
      let position = 0;
      let hold = 0;
      held.forEach((v, k) => {
        const shares = Number(v.userShares) / SHARE_UNIT;
        const p = day[k];
        const value = shares * p.ppsUsd!;
        // Rewards these shares earned that day (valued the day they were paid); none before the start
        if (i > 0 && p.tvlUsd) rewards[k] += value * (p.rewardsUsd / p.tvlUsd);
        const b = baskets.get(v.config.vaultAddress.toLowerCase());
        hold += b ? shares * (b.x * p.priceXUsd! + b.y * p.priceYUsd!) : value;
        position += value;
      });
      // Both lines start at the same value (the basket comes from the first rebalance in the range)
      if (i === 0 && hold > 0) holdScale = position / hold;
      // End on today's live value so the chart matches the "Total value" stat
      if (date === today) position = live;
      return { date, value: position + rewards.reduce((s, r) => s + r, 0), compare: hold * holdScale };
    });
  }, [visibleValueDays, baskets, held]);

  const aprSeries = useMemo<SeriesPoint[]>(() => {
    if (!histories) return [];
    const byDate = new Map<number, { weighted: number; weight: number }>();
    for (const v of held) {
      for (const p of histories.get(v.config.vaultAddress.toLowerCase()) ?? []) {
        if (p.apr === null) continue;
        const acc = byDate.get(p.date) ?? { weighted: 0, weight: 0 };
        acc.weighted += p.apr * v.userUsd;
        acc.weight += v.userUsd;
        byDate.set(p.date, acc);
      }
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a - b)
      .map(([date, { weighted, weight }]) => ({ date, value: weight > 0 ? weighted / weight : null }));
  }, [histories, held]);

  const claimedSeries = useMemo<SeriesPoint[]>(() => {
    if (claimed.length === 0) return [];
    // Extend the staircase to today so the latest total stays visible on the right edge
    const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
    const points = claimed.map((c) => ({ date: c.date, value: c.usd }));
    if (points.at(-1)!.date < today) points.push({ date: today, value: points.at(-1)!.value });
    return points;
  }, [claimed]);

  const all = metric === 'value' ? valueSeries : metric === 'apr' ? aprSeries : claimedSeries;
  const series = sliceRange(all, range);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '';

  let headline: { label: string; value: string; change?: { usd: number; pct: number } };
  if (metric === 'value') {
    const last = series.at(-1);
    const hold = last?.compare ?? null;
    headline = {
      label: `Your position + rewards · ${rangeLabel}`,
      value: formatUSD(last?.value ?? 0),
      change:
        last?.value != null && hold !== null && hold > 0
          ? { usd: last.value - hold, pct: ((last.value - hold) / hold) * 100 }
          : undefined,
    };
  } else if (metric === 'apr') {
    const values = series.map((p) => p.value).filter((v): v is number => v !== null);
    headline = {
      label: `My average APR · ${rangeLabel}`,
      value: formatApr(values.length ? values.reduce((s, v) => s + v, 0) / values.length : null),
    };
  } else {
    headline = { label: 'Total rewards claimed', value: formatUSD(claimed.at(-1)?.usd ?? 0) };
  }

  const loading = metric === 'claimed' ? claimedLoading : historiesLoading;
  const empty = series.length === 0;

  const emptyMessage =
    metric === 'claimed'
      ? "You haven't claimed any rewards yet."
      : histories === null
        ? 'History is being indexed. It will appear here shortly.'
        : held.length === 0
          ? 'Deposit into a vault to see this chart.'
          : 'Not enough history yet for your vaults.';

  return (
    <Card className="mb-8 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-arca-text-secondary">{headline.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-arca-text">{empty ? '—' : headline.value}</span>
            {!empty && headline.change && (
              <span className={cn('text-sm font-medium tabular-nums', headline.change.usd >= 0 ? 'text-arca-green' : 'text-red-400')}>
                {headline.change.usd >= 0 ? '+' : '−'}
                {formatUSD(Math.abs(headline.change.usd))} ({headline.change.pct >= 0 ? '+' : ''}
                {headline.change.pct.toFixed(1)}%){metric === 'value' && ' vs holding'}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} size="sm" />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} size="sm" />
        </div>
      </div>

      {metric === 'value' && !empty && (
        <div className="-mt-2 mb-3 flex gap-4 text-xs text-arca-text-secondary">
          <LegendItem color={SERIES_COLOR} label="Your position + rewards" />
          <LegendItem color={COMPARE_COLOR} label="If you had held" />
        </div>
      )}

      <div className="h-40">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : empty ? (
          <ChartPlaceholder>{emptyMessage}</ChartPlaceholder>
        ) : metric === 'value' ? (
          <TimeSeriesChart
            points={series}
            name="your position"
            compareName="if held"
            format={(v) => formatUSD(v ?? 0)}
            axisFormat={formatUSDCompact}
          />
        ) : metric === 'apr' ? (
          <TimeSeriesChart points={series} name="APR" format={formatApr} axisFormat={(v) => `${Math.round(v)}%`} />
        ) : (
          <TimeSeriesChart points={series} name="claimed" format={(v) => formatUSD(v ?? 0)} axisFormat={formatUSDCompact} step />
        )}
      </div>

      <p className="mt-3 text-xs text-arca-text-tertiary">{NOTES[metric]}</p>
    </Card>
  );
}
