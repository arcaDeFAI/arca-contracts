'use client';

import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { useAllVaultHistories } from '@/hooks/useVaultHistory';
import { useUserShareEvents } from '@/hooks/useUserShareEvents';
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
  { value: 'value', label: 'Performance' },
  { value: 'apr', label: 'My APR' },
  { value: 'claimed', label: 'Rewards claimed' },
] as const;

const DAY = 86_400;
const SHARE_UNIT = 1e24; // VaultDayData.ppsUsd is the USD value of 1e24 raw shares

const INCOMING = new Set(['deposit', 'cancel', 'transferIn']);

const NOTES: Record<Metric, string> = {
  value:
    'Performance per dollar invested, like a fund: your vaults (share price plus the rewards you claimed) vs the same deposits split 50/50 into each vault’s two tokens and held. Deposits and withdrawals do not move the lines. Below: the same comparison in dollars today.',
  apr: 'APR of the vaults you hold, weighted by how much you have in each today.',
  claimed: 'Claimed rewards, valued at the time of each claim (today’s price when unknown).',
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

  const { address } = useAccount();
  const shareEvents = useUserShareEvents(address);

  // The wallet's real history: shares actually held each day (from its share movements), the
  // rewards they earned, and the same deposits held 50/50 in the vault's two tokens.
  const { valueSeries, gapUsd } = useMemo(() => {
    const events = shareEvents.data;
    const none = { valueSeries: [] as SeriesPoint[], gapUsd: 0 };
    if (!histories || !events || events.length === 0) return none;
    const today = Math.floor(Date.now() / 1000 / DAY) * DAY;
    let deposited = 0;
    const state = [...new Set(events.map((e) => e.vault))].map((id) => {
      const days = histories.get(id) ?? [];
      const priced = days.filter((d) => d.ppsUsd !== null && d.priceXUsd !== null && d.priceYUsd !== null);
      // Moves from before the vault had USD prices (until early April 2026) are valued at the
      // first priced day on or after them, so they still count in the 50/50 basket and deposits.
      const vaultEvents = events
        .filter((e) => e.vault === id)
        .map((e) => {
          if (e.valueUsd !== null && e.priceXUsd !== null && e.priceYUsd !== null) return e;
          const d = priced.find((p) => p.date + DAY > e.timestamp);
          if (!d) return e;
          return {
            ...e,
            timestamp: Math.max(e.timestamp, d.date),
            valueUsd: e.valueUsd ?? (Number(e.shares) / SHARE_UNIT) * d.ppsUsd!,
            priceXUsd: e.priceXUsd ?? d.priceXUsd,
            priceYUsd: e.priceYUsd ?? d.priceYUsd,
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
      return { id, priced, days, vaultEvents };
    }).map(({ id, days, vaultEvents }) => ({
      live: vaults.find((v) => v.config.vaultAddress.toLowerCase() === id)?.userUsd ?? 0,
      days,
      events: vaultEvents,
      dayIndex: 0,
      eventIndex: 0,
      // last known share price and token prices (a day can exist without them)
      pps: null as number | null,
      px: null as number | null,
      py: null as number | null,
      shares: 0,
      basketX: 0,
      basketY: 0,
    }));
    // Rewards the wallet actually claimed, cumulative by day (valued at claim time)
    let claimIndex = 0;
    let claimedSoFar = 0;
    // claims up to the first day count as history before the chart, not as gain on it
    let claimBase: number | null = null;

    // start at the first day the wallet held a priced position
    const firstMove = Math.min(...state.map((v) => v.events[0]?.timestamp ?? Infinity));
    const firstPriced = Math.min(...state.map((v) => v.days.find((d) => d.ppsUsd !== null)?.date ?? Infinity));
    const start = Math.floor(Math.max(firstMove, firstPriced) / DAY) * DAY;
    if (!Number.isFinite(start)) return none;

    // daily amounts, then performance in % (time-weighted: deposits and withdrawals are flows,
    // not returns, so only how the money performed moves the lines)
    const days: Array<{ date: number; mine: number; hold: number; flow: number }> = [];
    for (let date = start; date <= today; date += DAY) {
      const depositedBefore = deposited;
      let position = 0;
      let hold = 0;
      while (claimIndex < claimed.length && claimed[claimIndex].date <= date) claimedSoFar = claimed[claimIndex++].usd;
      if (claimBase === null) claimBase = claimedSoFar;
      for (const v of state) {
        // share price and token prices carried forward from the last day that had them
        while (v.dayIndex < v.days.length && v.days[v.dayIndex].date <= date) {
          const d = v.days[v.dayIndex++];
          if (d.ppsUsd !== null) v.pps = d.ppsUsd;
          if (d.priceXUsd !== null && d.priceYUsd !== null) {
            v.px = d.priceXUsd;
            v.py = d.priceYUsd;
          }
        }
        while (v.eventIndex < v.events.length && v.events[v.eventIndex].timestamp < date + DAY) {
          const e = v.events[v.eventIndex++];
          const shares = Number(e.shares);
          // a move valued when it happened also tells the price, until the vault's history has one
          if (v.pps === null && e.valueUsd !== null && shares > 0) v.pps = (e.valueUsd * SHARE_UNIT) / shares;
          if (v.px === null && e.priceXUsd !== null && e.priceYUsd !== null) {
            v.px = e.priceXUsd;
            v.py = e.priceYUsd;
          }
          const pps = v.pps;
          const px = v.px;
          const py = v.py;
          const usd = e.valueUsd ?? (pps !== null ? (shares / SHARE_UNIT) * pps : 0);
          if (INCOMING.has(e.kind)) {
            const ex = e.priceXUsd ?? px;
            const ey = e.priceYUsd ?? py;
            if (ex && ey) {
              v.basketX += usd / 2 / ex;
              v.basketY += usd / 2 / ey;
            }
            v.shares += shares;
            deposited += usd;
          } else {
            const fraction = v.shares > 0 ? Math.min(1, shares / v.shares) : 1;
            v.basketX *= 1 - fraction;
            v.basketY *= 1 - fraction;
            v.shares = Math.max(0, v.shares - shares);
            deposited -= usd;
          }
        }
        const value = v.pps !== null ? (v.shares / SHARE_UNIT) * v.pps : 0;
        position += date === today ? v.live : value;
        hold += v.px && v.py ? v.basketX * v.px + v.basketY * v.py : value;
      }
      days.push({ date, mine: position + (claimedSoFar - claimBase), hold, flow: deposited - depositedBefore });
    }

    const out: SeriesPoint[] = [];
    let mineIndex = 1;
    let holdIndex = 1;
    days.forEach((d, i) => {
      if (i > 0) {
        const prev = days[i - 1];
        // Modified Dietz: a deposit is invested for the whole day, a withdrawal leaves at its end
        const mineBase = prev.mine + Math.max(d.flow, 0);
        const holdBase = prev.hold + Math.max(d.flow, 0);
        if (mineBase > 1) mineIndex *= 1 + (d.mine - prev.mine - d.flow) / mineBase;
        if (holdBase > 1) holdIndex *= 1 + (d.hold - prev.hold - d.flow) / holdBase;
      }
      out.push({ date: d.date, value: (mineIndex - 1) * 100, compare: (holdIndex - 1) * 100 });
    });
    const last = days.at(-1);
    return { valueSeries: out, gapUsd: last ? last.mine - last.hold : 0 };
  }, [shareEvents.data, histories, vaults, claimed]);

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
  const sliced = sliceRange(all, range);
  // performance restarts at 0% on the first day of the selected period
  const base = metric === 'value' ? sliced[0] : undefined;
  const rebase = (v: number | null | undefined, b: number | null | undefined) =>
    v == null || b == null ? null : ((1 + v / 100) / (1 + b / 100) - 1) * 100;
  const series = base
    ? sliced.map((p) => ({ ...p, value: rebase(p.value, base.value), compare: rebase(p.compare, base.compare) }))
    : sliced;
  const pct = (v: number | null) => (v === null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? '';

  let headline: { label: string; value: string; change?: { usd: number; pct: number } };
  if (metric === 'value') {
    const last = series.at(-1);
    const hold = last?.compare ?? null;
    headline = {
      label: `Your performance · ${rangeLabel}`,
      value: pct(last?.value ?? null),
      change: last?.value != null && hold !== null ? { usd: 0, pct: last.value - hold } : undefined,
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

  const loading = metric === 'claimed' ? claimedLoading : historiesLoading || (metric === 'value' && shareEvents.isLoading);
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
            {!empty && headline.change && metric === 'value' && (
              <span className={cn('text-sm font-medium tabular-nums', headline.change.pct >= 0 ? 'text-arca-green' : 'text-red-400')}>
                {headline.change.pct >= 0 ? '+' : '−'}
                {Math.abs(headline.change.pct).toFixed(2)}% vs held 50/50
              </span>
            )}
            {!empty && headline.change && metric !== 'value' && (
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

      {metric === 'value' && !empty && (
        <div className="-mt-2 mb-3 flex gap-4 text-xs text-arca-text-secondary">
          <LegendItem color={SERIES_COLOR} label="Your vaults (with rewards)" />
          <LegendItem color={COMPARE_COLOR} label="Held 50/50" />
        </div>
      )}

      {metric === 'value' && !empty && (
        <div className="-mt-1 mb-3 text-xs text-arca-text-secondary">
          In dollars today:{' '}
          <span className={cn('font-medium tabular-nums', gapUsd >= 0 ? 'text-arca-green' : 'text-red-400')}>
            {gapUsd >= 0 ? '+' : '−'}
            {formatUSD(Math.abs(gapUsd))} {gapUsd >= 0 ? 'better' : 'worse'} than holding 50/50
          </span>
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
            name="your vaults"
            compareName="held 50/50"
            format={pct}
            axisFormat={(v) => `${Math.round(v)}%`}
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
