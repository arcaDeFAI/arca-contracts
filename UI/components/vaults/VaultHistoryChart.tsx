'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { averageApr, useVaultHistory } from '@/hooks/useVaultHistory';
import { formatApr, formatUSDCompact } from '@/lib/utils';
import { Card, Segmented, Skeleton } from '@/components/ui';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';

type Metric = 'apr' | 'tvl';
type Range = '7' | '30' | '90' | 'all';

const METRIC_OPTIONS = [
  { value: 'apr', label: 'APR' },
  { value: 'tvl', label: 'TVL' },
] as const;

export const RANGE_OPTIONS = [
  { value: '7', label: '1W' },
  { value: '30', label: '1M' },
  { value: '90', label: '3M' },
  { value: 'all', label: 'All' },
] as const;

export function sliceRange<T>(points: T[], range: Range): T[] {
  return range === 'all' ? points : points.slice(-Number(range));
}

export function VaultHistoryChart({ vaultAddress }: { vaultAddress: string }) {
  const { points, status } = useVaultHistory(vaultAddress);
  const [metric, setMetric] = useState<Metric>('apr');
  const [range, setRange] = useState<Range>('30');

  const visible = useMemo(() => sliceRange(points, range), [points, range]);
  const series = useMemo(
    () => visible.map((p) => ({ date: p.date, value: metric === 'apr' ? p.apr : p.tvlUsd })),
    [visible, metric],
  );

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '';
  const headline =
    metric === 'apr'
      ? { label: `Average APR · ${rangeLabel}`, value: formatApr(averageApr(visible)) }
      : { label: 'TVL', value: formatUSDCompact(visible.at(-1)?.tvlUsd ?? 0) };

  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-arca-text-secondary">{headline.label}</div>
          <div className="text-2xl font-semibold tabular-nums text-arca-text">
            {status === 'ready' ? headline.value : '—'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} size="sm" />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} size="sm" />
        </div>
      </div>

      <div className="h-64">
        {status === 'loading' && <Skeleton className="h-full w-full" />}
        {(status === 'unavailable' || status === 'empty') && (
          <ChartPlaceholder>
            {status === 'unavailable'
              ? 'History is being indexed. Charts will appear here shortly.'
              : 'No history yet — this vault has not been rebalanced since indexing started.'}
          </ChartPlaceholder>
        )}
        {status === 'ready' &&
          (metric === 'apr' ? (
            <TimeSeriesChart points={series} name="APR" format={formatApr} axisFormat={(v) => `${Math.round(v)}%`} />
          ) : (
            <TimeSeriesChart points={series} name="TVL" format={(v) => formatUSDCompact(v ?? 0)} />
          ))}
      </div>

      {status === 'ready' && metric === 'apr' && (
        <p className="mt-3 text-xs text-arca-text-tertiary">
          Each point is the APR over the previous 7 days, which smooths out day-to-day swings in rewards.
        </p>
      )}
    </Card>
  );
}

export function ChartPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-white/[0.02] px-6 text-center text-sm text-arca-text-secondary">
      {children}
    </div>
  );
}
