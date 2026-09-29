'use client';

import { useMemo, useState } from 'react';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { useAllVaultHistories } from '@/hooks/useVaultHistory';
import { cn, formatApr, formatUSD, formatUSDCompact } from '@/lib/utils';
import { Card, Segmented, Skeleton } from '@/components/ui';
import { TimeSeriesChart, type SeriesPoint } from '@/components/TimeSeriesChart';
import { ChartPlaceholder, RANGE_OPTIONS, sliceRange } from './VaultHistoryChart';

type Metric = 'value' | 'apr' | 'claimed';
type Range = (typeof RANGE_OPTIONS)[number]['value'];

const METRIC_OPTIONS = [
  { value: 'value', label: 'Value' },
  { value: 'apr', label: 'My APR' },
  { value: 'claimed', label: 'Rewards claimed' },
] as const;

const DAY = 86_400;
const SHARE_UNIT = 1e24; // VaultDayData.ppsUsd is the USD value of 1e24 raw shares

const NOTES: Record<Metric, string> = {
  value:
    'What your current vault shares were worth each day. Your own deposits and withdrawals are left out, so the line shows only how the vaults performed (including token price moves). Rewards are separate.',
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

  const valueSeries = useMemo<SeriesPoint[]>(() => {
    if (!histories || held.length === 0) return [];
    // date → summed value of the user's current shares, and how many held vaults were priced that day
    const byDate = new Map<number, { usd: number; count: number }>();
    for (const v of held) {
      const shares = Number(v.userShares) / SHARE_UNIT;
      for (const p of histories.get(v.config.vaultAddress.toLowerCase()) ?? []) {
        if (p.ppsUsd === null) continue;
        const acc = byDate.get(p.date) ?? { usd: 0, count: 0 };
        acc.usd += shares * p.ppsUsd;
        acc.count += 1;
        byDate.set(p.date, acc);
      }
    }
    const points = [...byDate.entries()]
      .filter(([, acc]) => acc.count === held.length) // only days where every held vault has a price
      .sort(([a], [b]) => a - b)
      .map(([date, acc]) => ({ date, value: acc.usd }));

    // End on today's live value so the chart matches the "Total value" stat
    const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
    const live = held.reduce((s, v) => s + v.userUsd, 0);
    if (points.at(-1)?.date === today) points[points.length - 1] = { date: today, value: live };
    else if (points.length > 0) points.push({ date: today, value: live });
    return points;
  }, [histories, held]);

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
    const first = series[0]?.value ?? null;
    const last = series.at(-1)?.value ?? null;
    headline = {
      label: `Position value · change over ${rangeLabel}`,
      value: formatUSD(last ?? 0),
      change:
        first !== null && last !== null && first > 0
          ? { usd: last - first, pct: ((last - first) / first) * 100 }
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
                {headline.change.pct.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} size="sm" />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} size="sm" />
        </div>
      </div>

      <div className="h-56">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : empty ? (
          <ChartPlaceholder>{emptyMessage}</ChartPlaceholder>
        ) : metric === 'value' ? (
          <TimeSeriesChart points={series} name="value" format={(v) => formatUSD(v ?? 0)} axisFormat={formatUSDCompact} />
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
