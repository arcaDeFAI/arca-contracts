'use client';

import { Skeleton } from '@/components/ui';
import { useCompetitorPerformance } from '@/hooks/useCompetitorPerformance';
import { formatSignedPct, useVaultPerformance } from '@/hooks/useVaultPerformance';
import { useVaultFees } from '@/hooks/useVaultFees';
import { getCompetitors, type Competitor } from '@/lib/competitors';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { cn } from '@/lib/utils';

/**
 * Vaults table cell: how far this vault is ahead of `manager`'s vault on the
 * same pair, since it started (net vs keeping the initial tokens, rewards
 * included — the same numbers as the vault page). "—" when there is none.
 */
export function CompetitorEdgeCell({ config, manager }: { config: VaultConfig; manager: Competitor['manager'] }) {
  if (!getCompetitors(config.vaultAddress).some((c) => c.manager === manager)) {
    return <span className="text-arca-text-tertiary">—</span>;
  }
  return <EdgeValue config={config} manager={manager} />;
}

function EdgeValue({ config, manager }: { config: VaultConfig; manager: Competitor['manager'] }) {
  const { aumFeePct } = useVaultFees(config);
  const { windows, bounds, isLoading } = useVaultPerformance(config, aumFeePct);
  const others = useCompetitorPerformance(config, bounds.all.first, bounds.all.last);
  const ours = windows.all;
  const other = others.data?.find((o) => o.manager === manager);

  if (isLoading || others.isLoading) return <Skeleton className="ml-auto h-4 w-12" />;
  if (!ours || !other) return <span className="text-arca-text-tertiary">—</span>;

  const lead = (ours.vsHold - other.vsHold) * 100;
  return (
    <span
      className={cn('cursor-help tabular-nums', lead >= 0 ? 'text-arca-green' : 'text-red-400')}
      title={`Since start, vs keeping the initial tokens: Arca ${formatSignedPct(ours.vsHold)}, ${other.name} ${formatSignedPct(other.vsHold)}`}
    >
      {lead >= 0 ? '+' : '−'}
      {Math.abs(lead).toFixed(1)} pts
    </span>
  );
}
