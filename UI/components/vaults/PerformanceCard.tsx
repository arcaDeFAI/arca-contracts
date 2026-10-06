'use client';

import { useState } from 'react';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { cn } from '@/lib/utils';
import { formatSignedPct, useVaultPerformance, type WindowKey } from '@/hooks/useVaultPerformance';
import { useVaultFees } from '@/hooks/useVaultFees';
import { useCompetitorPerformance } from '@/hooks/useCompetitorPerformance';
import { Card, Segmented, Skeleton } from '@/components/ui';
import { dateLabel } from '@/components/TimeSeriesChart';

const WINDOW_OPTIONS = [
  { value: '30d', label: '30D' },
  { value: 'all', label: 'Since start' },
] as const;

/** Public "did the vault beat just holding the tokens?" block. */
export function PerformanceCard({ config }: { config: VaultConfig }) {
  const { aumFeePct } = useVaultFees(config);
  const { windows, bounds, isLoading } = useVaultPerformance(config, aumFeePct);
  const [key, setKey] = useState<WindowKey>('30d');
  const w = windows[key];
  const others = useCompetitorPerformance(config, bounds[key].first, bounds[key].last);
  const since = bounds[key].first ? dateLabel(Number(bounds[key].first.timestamp)) : null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-arca-text">Performance vs holding</h2>
        <Segmented options={WINDOW_OPTIONS} value={key} onChange={setKey} size="sm" />
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !w ? (
        <p className="text-sm text-arca-text-secondary">Not enough history for this period yet.</p>
      ) : (
        <>
          <dl className="space-y-2 text-sm">
            <Line label="This vault, rewards included" value={formatSignedPct(w.vaultReturn)} />
            <Line label={`If you had just kept your initial tokens (${since ?? 'start'})`} value={formatSignedPct(w.holdReturn)} muted />
            <div className="border-t border-white/[0.06] pt-2">
              <Line
                label="Difference"
                value={formatSignedPct(w.vsHold)}
                tone={w.vsHold >= 0 ? 'good' : 'bad'}
                strong
              />
            </div>
          </dl>
          {others.data && others.data.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <div className="mb-2 text-xs text-arca-text-secondary">Other vaults on this pair, same period, vs holding</div>
              <dl className="space-y-1.5 text-sm">
                <Line label="This vault" value={formatSignedPct(w.vsHold)} tone={w.vsHold >= 0 ? 'good' : 'bad'} />
                {others.data.map((o) => (
                  <Line key={o.name} label={o.name} value={formatSignedPct(o.vsHold)} muted />
                ))}
              </dl>
              <p className="mt-2 text-xs text-arca-text-tertiary">
                Read on-chain at the same moments and valued at the same prices, their compounded rewards included.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-arca-text-tertiary">
            Over {Math.round(w.days)} days, for $1 in the vault. Initial tokens: the {config.tokenX} / {config.tokenY} mix
            the vault held on {since ?? 'the first day'}, kept untouched. The vault earns rewards (no trading fees); its share
            value also moves with prices, rebalancing and the AUM fee. Past results don&apos;t guarantee future ones.
          </p>
        </>
      )}
    </Card>
  );
}

function Line({
  label,
  value,
  muted = false,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-arca-text-secondary' : 'text-arca-text'}>{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong && 'text-base font-semibold',
          tone === 'good' && 'text-arca-green',
          tone === 'bad' && 'text-red-400',
          !tone && (muted ? 'text-arca-text-secondary' : 'text-arca-text'),
        )}
      >
        {value}
      </dd>
    </div>
  );
}
