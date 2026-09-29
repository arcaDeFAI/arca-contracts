'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { getPairName, PLATFORMS } from '@/lib/vaultConfigs';
import { getTokenLogo } from '@/lib/tokenHelpers';
import { cn, formatApr, formatUSDCompact } from '@/lib/utils';
import { Card, PairIcons, Segmented, Skeleton } from '@/components/ui';

type SortKey = 'apr' | 'tvl' | 'deposit';
type PlatformFilter = 'all' | 'shadow' | 'metropolis';

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'metropolis', label: 'Metropolis' },
] as const;

interface VaultListProps {
  vaults: VaultOverview[];
  isLoading: boolean;
  aprLoading: boolean;
  isConnected: boolean;
}

export function VaultList({ vaults, isLoading, aprLoading, isConnected }: VaultListProps) {
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<SortKey>('apr');

  const rows = useMemo(() => {
    const filtered = vaults.filter(
      (v) => (platform === 'all' || v.config.protocol === platform) && (!onlyMine || v.userUsd > 0.01),
    );
    const value = (v: VaultOverview) => (sort === 'apr' ? (v.apr ?? -1) : sort === 'tvl' ? v.tvlUsd : v.userUsd);
    return [...filtered].sort((a, b) => value(b) - value(a));
  }, [vaults, platform, onlyMine, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
        {isConnected && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-arca-text-secondary">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="h-4 w-4 accent-[#00ff88]"
            />
            My vaults
          </label>
        )}
      </div>

      <Card className="overflow-hidden">
        {/* Column headers (desktop) */}
        <div className="hidden grid-cols-[1fr_120px_120px_140px_24px] gap-4 border-b border-white/[0.06] px-5 py-3 text-xs text-arca-text-secondary md:grid">
          <span>Vault</span>
          <SortHeader label="APR" active={sort === 'apr'} onClick={() => setSort('apr')} />
          <SortHeader label="TVL" active={sort === 'tvl'} onClick={() => setSort('tvl')} />
          <SortHeader label="Your deposit" active={sort === 'deposit'} onClick={() => setSort('deposit')} />
          <span />
        </div>

        {rows.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-arca-text-secondary">
            {onlyMine ? "You don't have a deposit in any vault yet." : 'No vaults match this filter.'}
          </div>
        )}

        {rows.map((v) => (
          <VaultRow key={v.config.vaultAddress} vault={v} isLoading={isLoading} aprLoading={aprLoading} isConnected={isConnected} />
        ))}
      </Card>
    </div>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center justify-end gap-0.5 text-right', active ? 'text-arca-text' : 'hover:text-arca-text')}
    >
      {label}
      <ChevronUpDownIcon className="h-4 w-4 opacity-60" />
    </button>
  );
}

function VaultRow({
  vault,
  isLoading,
  aprLoading,
  isConnected,
}: {
  vault: VaultOverview;
  isLoading: boolean;
  aprLoading: boolean;
  isConnected: boolean;
}) {
  const { config, apr, tvlUsd, userUsd } = vault;

  const aprCell = aprLoading ? <Skeleton className="ml-auto h-5 w-14" /> : formatApr(apr);
  const tvlCell = isLoading ? <Skeleton className="ml-auto h-5 w-16" /> : formatUSDCompact(tvlUsd);
  const depositCell = !isConnected ? '—' : isLoading ? <Skeleton className="ml-auto h-5 w-14" /> : userUsd > 0.01 ? formatUSDCompact(userUsd) : '—';

  return (
    <Link
      href={`/vaults/${config.vaultAddress}`}
      className="group block border-b border-white/[0.04] px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02]"
    >
      {/* Desktop */}
      <div className="hidden grid-cols-[1fr_120px_120px_140px_24px] items-center gap-4 md:grid">
        <VaultIdentity vault={vault} />
        <span className="text-right text-base font-semibold tabular-nums text-arca-green">{aprCell}</span>
        <span className="text-right tabular-nums text-arca-text">{tvlCell}</span>
        <span className="text-right tabular-nums text-arca-text">{depositCell}</span>
        <ChevronRightIcon className="h-5 w-5 text-arca-text-tertiary transition-transform group-hover:translate-x-0.5" />
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <VaultIdentity vault={vault} />
          <ChevronRightIcon className="h-5 w-5 text-arca-text-tertiary" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <MobileCell label="APR" value={aprCell} accent />
          <MobileCell label="TVL" value={tvlCell} />
          <MobileCell label="Deposit" value={depositCell} />
        </div>
      </div>
    </Link>
  );
}

export function VaultIdentity({ vault, large = false }: { vault: Pick<VaultOverview, 'config'>; large?: boolean }) {
  const { config } = vault;
  const platform = PLATFORMS[config.protocol];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PairIcons logoX={getTokenLogo(config.tokenX)} logoY={getTokenLogo(config.tokenY)} size={large ? 44 : 36} />
      <div className="min-w-0">
        <div className={cn('truncate font-semibold text-arca-text', large && 'text-2xl')}>{getPairName(config)}</div>
        <div className="flex items-center gap-1.5 text-xs text-arca-text-secondary">
          <img src={platform.logo} alt="" className="h-3.5 w-3.5 rounded-full object-contain" />
          {platform.name}
        </div>
      </div>
    </div>
  );
}

function MobileCell({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-arca-text-secondary">{label}</div>
      <div className={cn('font-semibold tabular-nums', accent ? 'text-arca-green' : 'text-arca-text')}>{value}</div>
    </div>
  );
}
