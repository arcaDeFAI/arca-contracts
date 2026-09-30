'use client';

import { Skeleton } from '@/components/ui';
import { useCompetitorPerformance } from '@/hooks/useCompetitorPerformance';
import { formatSignedPct, useVaultPerformance } from '@/hooks/useVaultPerformance';
import { useVaultFees } from '@/hooks/useVaultFees';
import { getCompetitors } from '@/lib/competitors';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { cn } from '@/lib/utils';

/**
 * Vaults table cell: how far this vault is ahead of the best other vault on
 * the same pair, since it started (net vs keeping the initial tokens, rewards
 * included — the same numbers as the vault page). "—" when there is none.
 */
export function CompetitorEdgeCell({ config }: { config: VaultConfig }) {
  if (getCompetitors(config.vaultAddress).length === 0) return <span className="text-arca-text-tertiary">—</span>;
  return <EdgeValue config={config} />;
}

function EdgeValue({ config }: { config: VaultConfig }) {
  const { aumFeePct } = useVaultFees(config);
  const { windows, bounds, isLoading } = useVaultPerformance(config, aumFeePct);
  const others = useCompetitorPerformance(config, bounds.all.first, bounds.all.last);
  const ours = windows.all;

  if (isLoading || others.isLoading) return <Skeleton className="ml-auto h-4 w-12" />;
  if (!ours || !others.data || others.data.length === 0) return <span className="text-arca-text-tertiary">—</span>;

  const best = Math.max(...others.data.map((o) => o.vsHold));
  const lead = (ours.vsHold - best) * 100;
  const detail = [`Arca ${formatSignedPct(ours.vsHold)}`, ...others.data.map((o) => `${o.name} ${formatSignedPct(o.vsHold)}`)].join(
    ' · ',
  );
  return (
    <span
      className={cn('cursor-help tabular-nums', lead >= 0 ? 'text-arca-green' : 'text-red-400')}
      title={`Since start, vs keeping the initial tokens: ${detail}`}
    >
      {lead >= 0 ? '+' : '−'}
      {Math.abs(lead).toFixed(1)} pts
    </span>
  );
}
