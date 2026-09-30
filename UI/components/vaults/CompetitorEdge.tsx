'use client';

import Link from 'next/link';
import { Card, Skeleton } from '@/components/ui';
import { useCompetitorPerformance } from '@/hooks/useCompetitorPerformance';
import { formatSignedPct, useVaultPerformance } from '@/hooks/useVaultPerformance';
import { useVaultFees } from '@/hooks/useVaultFees';
import { vaultsWithCompetitors } from '@/lib/competitors';
import { getVaultByAddress, type VaultConfig } from '@/lib/vaultConfigs';
import { cn } from '@/lib/utils';

/**
 * Vaults list: "us vs other vault managers on the same pairs", net vs
 * holding since our vault started (same numbers as each vault's page).
 */
export function CompetitorEdge() {
  const configs = vaultsWithCompetitors()
    .map((a) => getVaultByAddress(a))
    .filter((c): c is VaultConfig => c !== undefined);
  if (configs.length === 0) return null;

  return (
    <Card className="mb-6 p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-arca-text">Compared with other vaults on the same pairs</h2>
        <p className="text-xs text-arca-text-secondary">
          Net result vs just keeping your initial tokens, since each Arca vault started. Rewards included.
        </p>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {configs.map((c) => (
          <EdgeRow key={c.vaultAddress} config={c} />
        ))}
      </div>
    </Card>
  );
}

function EdgeRow({ config }: { config: VaultConfig }) {
  const { aumFeePct } = useVaultFees(config);
  const { windows, bounds, isLoading } = useVaultPerformance(config, aumFeePct);
  const others = useCompetitorPerformance(config, bounds.all.first, bounds.all.last);
  const ours = windows.all;

  return (
    <Link
      href={`/vaults/${config.vaultAddress}`}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2.5 text-sm hover:opacity-80"
    >
      <span className="font-medium text-arca-text">{config.name}</span>
      {isLoading || others.isLoading || !ours ? (
        <Skeleton className="h-4 w-64" />
      ) : (
        <span className="flex flex-wrap gap-x-5 tabular-nums">
          <Value label="Arca" value={ours.vsHold} strong />
          {(others.data ?? []).map((o) => (
            <Value key={o.name} label={o.name.replace(/ \(.*\)$/, '')} value={o.vsHold} />
          ))}
        </span>
      )}
    </Link>
  );
}

function Value({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <span>
      <span className="mr-1.5 text-arca-text-secondary">{label}</span>
      <span
        className={cn(
          strong ? 'font-semibold' : 'font-medium',
          strong ? (value >= 0 ? 'text-arca-green' : 'text-red-400') : 'text-arca-text-secondary',
        )}
      >
        {formatSignedPct(value)}
      </span>
    </span>
  );
}
