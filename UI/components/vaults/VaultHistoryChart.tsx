'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { averageApr, useVaultHistory, type HistoryPoint } from '@/hooks/useVaultHistory';
import { querySubgraph } from '@/lib/subgraph';
import { getTokenDecimals } from '@/lib/tokenHelpers';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { cn, formatApr, formatUSD, formatUSDCompact } from '@/lib/utils';
import { Card, Segmented, Skeleton } from '@/components/ui';
import { COMPARE_COLOR, SERIES_COLOR, TimeSeriesChart, type ExtraLine, type SeriesPoint } from '@/components/TimeSeriesChart';
import { isStablecoin } from '@/lib/tokenUtils';

type Metric = 'apr' | 'tvl' | 'hold';
type Range = '7' | '30' | '90' | 'all';

const METRIC_OPTIONS = [
  { value: 'apr', label: 'APR' },
  { value: 'tvl', label: 'TVL' },
  { value: 'hold', label: 'vs Holding' },
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

const START = 100;
/** Dashed "$100 in one token" lines; stablecoins are left out (flat at $100). */
const TOKEN_COLORS = ['#60a5fa', '#f59e0b'];

/** Token amounts one share held at the first priced rebalance on/after `date` (the "holding" basket). */
function useStartBasket(config: VaultConfig, date: number | null) {
  const id = config.vaultAddress.toLowerCase();
  const { data } = useQuery({
    queryKey: ['subgraph', 'startBasket', id, date],
    queryFn: () =>
      querySubgraph<{ snapshots: Array<{ amountXPerShare: string; amountYPerShare: string }> }>(`{
        snapshots(where: { vault: "${id}", timestamp_gte: "${date}", priceXUsd_not: null, priceYUsd_not: null, amountXPerShare_gt: "0" },
          orderBy: timestamp, orderDirection: asc, first: 1) { amountXPerShare amountYPerShare }
      }`),
    enabled: date !== null,
    staleTime: Infinity,
  });
  const s = data?.snapshots[0];
  if (!s) return null;
  return {
    x: Number(s.amountXPerShare) / 10 ** getTokenDecimals(config.tokenX),
    y: Number(s.amountYPerShare) / 10 ** getTokenDecimals(config.tokenY),
  };
}

/**
 * Growth of $100 from the first day of the range: the vault (share value + rewards collected,
 * rewards valued the day they were paid) vs holding the tokens one share held on that day.
 */
function buildHoldSeries(
  visible: HistoryPoint[],
  basket: { x: number; y: number } | null,
  tokens: { x: boolean; y: boolean },
): SeriesPoint[] {
  const start = visible.findIndex((p) => p.ppsUsd !== null && p.priceXUsd !== null && p.priceYUsd !== null);
  if (start < 0 || !basket) return [];
  const p0 = visible[start];
  const basket0 = basket.x * p0.priceXUsd! + basket.y * p0.priceYUsd!;
  if (basket0 <= 0) return [];

  let rewards = 0;
  return visible.slice(start).map((p, i) => {
    if (i > 0 && p.tvlUsd) rewards += p.rewardsUsd / p.tvlUsd;
    const hold = p.priceXUsd !== null && p.priceYUsd !== null ? (basket.x * p.priceXUsd + basket.y * p.priceYUsd) / basket0 : null;
    const vault = p.ppsUsd !== null ? p.ppsUsd / p0.ppsUsd! + rewards : null;
    const lines: (number | null)[] = [];
    if (tokens.x) lines.push(p.priceXUsd !== null ? (START * p.priceXUsd) / p0.priceXUsd! : null);
    if (tokens.y) lines.push(p.priceYUsd !== null ? (START * p.priceYUsd) / p0.priceYUsd! : null);
    return { date: p.date, value: vault === null ? null : START * vault, compare: hold === null ? null : START * hold, lines };
  });
}

export function VaultHistoryChart({ config }: { config: VaultConfig }) {
  const { points, status } = useVaultHistory(config.vaultAddress);
  const [metric, setMetric] = useState<Metric>('apr');
  const [range, setRange] = useState<Range>('30');

  const visible = useMemo(() => sliceRange(points, range), [points, range]);
  const startDate = metric === 'hold' ? (visible.find((p) => p.ppsUsd !== null)?.date ?? null) : null;
  const basket = useStartBasket(config, startDate);
  const tokenLines = useMemo(() => {
    const shown = { x: !isStablecoin(config.tokenX), y: !isStablecoin(config.tokenY) };
    const lines: ExtraLine[] = [];
    if (shown.x) lines.push({ name: `$100 in ${config.tokenX}`, color: TOKEN_COLORS[0] });
    if (shown.y) lines.push({ name: `$100 in ${config.tokenY}`, color: TOKEN_COLORS[1] });
    return { shown, lines };
  }, [config.tokenX, config.tokenY]);

  const series = useMemo<SeriesPoint[]>(() => {
    if (metric === 'hold') return buildHoldSeries(visible, basket, tokenLines.shown);
    return visible.map((p) => ({ date: p.date, value: metric === 'apr' ? p.apr : p.tvlUsd }));
  }, [visible, metric, basket, tokenLines]);

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '';
  const last = series.at(-1);

  let headline: ReactNode;
  if (metric === 'apr') {
    headline = <Headline label={`Average APR · ${rangeLabel}`} value={formatApr(averageApr(visible))} />;
  } else if (metric === 'tvl') {
    headline = <Headline label="TVL" value={formatUSDCompact(visible.at(-1)?.tvlUsd ?? 0)} />;
  } else {
    const diff = last && last.value !== null && last.compare != null ? last.value - last.compare : null;
    headline = (
      <div>
        <div className="text-xs text-arca-text-secondary">$100 invested · {rangeLabel}</div>
        <div className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tabular-nums text-arca-text">
          {last?.value != null ? formatUSD(last.value) : '—'}
          {diff !== null && (
            <span className={cn('text-sm font-medium', diff >= 0 ? 'text-arca-green' : 'text-red-400')}>
              {diff >= 0 ? '+' : '−'}
              {formatUSD(Math.abs(diff))} vs holding
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        {status === 'ready' ? headline : <Headline label="" value="—" />}
        <div className="flex flex-wrap gap-2">
          <Segmented options={METRIC_OPTIONS} value={metric} onChange={setMetric} size="sm" />
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} size="sm" />
        </div>
      </div>

      {status === 'ready' && metric === 'hold' && (
        <div className="-mt-2 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-arca-text-secondary">
          <LegendItem color={SERIES_COLOR} label="This vault, rewards included" />
          <LegendItem color={COMPARE_COLOR} label="Holding the same tokens" />
          {tokenLines.lines.map((l) => (
            <LegendItem key={l.name} color={l.color} label={l.name} dashed />
          ))}
        </div>
      )}

      <div className="h-64">
        {status === 'loading' && <Skeleton className="h-full w-full" />}
        {(status === 'unavailable' || status === 'empty') && (
          <ChartPlaceholder>
            {status === 'unavailable'
              ? 'History is being indexed. Charts will appear here shortly.'
              : 'No history yet — this vault has not been rebalanced since indexing started.'}
          </ChartPlaceholder>
        )}
        {status === 'ready' && metric === 'apr' && (
          <TimeSeriesChart points={series} name="APR" format={formatApr} axisFormat={(v) => `${Math.round(v)}%`} />
        )}
        {status === 'ready' && metric === 'tvl' && (
          <TimeSeriesChart points={series} name="TVL" format={(v) => formatUSDCompact(v ?? 0)} />
        )}
        {status === 'ready' &&
          metric === 'hold' &&
          (series.length === 0 ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <TimeSeriesChart
              points={series}
              name="vault"
              compareName="holding"
              lines={tokenLines.lines}
              format={(v) => (v === null ? '—' : formatUSD(v))}
              axisFormat={(v) => `$${Math.round(v)}`}
            />
          ))}
      </div>

      {status === 'ready' && (
        <p className="mt-3 text-xs text-arca-text-tertiary">
          {metric === 'hold'
            ? 'Growth of $100 from the start of the period: share value plus rewards collected (valued the day they were paid), vs keeping the tokens instead. Dashed lines: $100 kept in a single token.'
            : metric === 'apr'
              ? 'Each point is the APR over the previous 7 days, which smooths out day-to-day swings in rewards.'
              : 'Total value in the vault.'}
        </p>
      )}
    </Card>
  );
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-arca-text-secondary">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-arca-text">{value}</div>
    </div>
  );
}

function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-0.5 w-4 rounded"
        style={dashed ? { background: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` } : { background: color }}
      />
      {label}
    </span>
  );
}

export function ChartPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-white/[0.02] px-6 text-center text-sm text-arca-text-secondary">
      {children}
    </div>
  );
}
