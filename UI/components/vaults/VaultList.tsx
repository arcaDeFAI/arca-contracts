'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { type VaultOverview } from '@/hooks/useVaultsOverview';
import { useAllVaultHistories } from '@/hooks/useVaultHistory';
import { getPairName, PLATFORMS } from '@/lib/vaultConfigs';
import { getTokenLogo } from '@/lib/tokenHelpers';
import { cn, formatApr, formatUSDCompact } from '@/lib/utils';
import { Card, PairIcons, Segmented, Skeleton, Sparkline } from '@/components/ui';
import { CompetitorEdgeCell } from '@/components/vaults/CompetitorEdge';

type SortKey = 'apr' | 'tvl' | 'deposit';
type PlatformFilter = 'all' | 'shadow' | 'metropolis';

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'metropolis', label: 'Metropolis' },
] as const;

const TREND_DAYS = 7;
// Vault | APR | 7D trend | vs others | AUM fee | TVL | Your deposit | action
const COLS = 'md:grid-cols-[minmax(0,1fr)_76px_92px_84px_68px_88px_104px_84px]';

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
  const { histories } = useAllVaultHistories();

  const rows = useMemo(() => {
    const filtered = vaults.filter(
      (v) => (platform === 'all' || v.config.protocol === platform) && (!onlyMine || v.userUsd > 0.01),
    );
    const value = (v: VaultOverview) => (sort === 'apr' ? (v.apr ?? -1) : sort === 'tvl' ? v.tvlUsd : v.userUsd);
    return [...filtered].sort((a, b) => value(b) - value(a));
  }, [vaults, platform, onlyMine, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} size="sm" />
        {isConnected && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-arca-text-secondary">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#00ff88]"
            />
            My vaults
          </label>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className={cn('hidden gap-4 border-b border-white/[0.06] px-4 py-2 text-[11px] text-arca-text-secondary md:grid', COLS)}>
          <span>Vault</span>
          <SortHeader label="APR" active={sort === 'apr'} onClick={() => setSort('apr')} />
          <span className="text-right">7D trend</span>
          <span
            className="cursor-help text-right underline decoration-dotted underline-offset-2"
            title="Lead over the best other vault on the same pair (Beefy, ICHI), since this vault started: net result vs keeping the initial tokens, rewards included. Hover a value for the detail."
          >
            vs others
          </span>
          <span
            className="cursor-help text-right underline decoration-dotted underline-offset-2"
            title="AUM fee: a yearly % of your whole deposit (not of profits), taken in small amounts at each rebalance. E.g. 10% on $1,000 ≈ $0.27 per day."
          >
            AUM fee
          </span>
          <SortHeader label="TVL" active={sort === 'tvl'} onClick={() => setSort('tvl')} />
          <SortHeader label="Your deposit" active={sort === 'deposit'} onClick={() => setSort('deposit')} />
          <span />
        </div>

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-arca-text-secondary">
            {onlyMine ? "You don't have a deposit in any vault yet." : 'No vaults match this filter.'}
          </div>
        )}

        {rows.map((v) => {
          const trend = (histories?.get(v.config.vaultAddress.toLowerCase()) ?? []).slice(-TREND_DAYS).map((p) => p.apr);
          return (
            <VaultRow
              key={v.config.vaultAddress}
              vault={v}
              trend={trend}
              isLoading={isLoading}
              aprLoading={aprLoading}
              isConnected={isConnected}
            />
          );
        })}
      </Card>
    </div>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center justify-end gap-0.5', active ? 'text-arca-text' : 'hover:text-arca-text')}
    >
      {label}
      <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}

function VaultRow({
  vault,
  trend,
  isLoading,
  aprLoading,
  isConnected,
}: {
  vault: VaultOverview;
  trend: Array<number | null>;
  isLoading: boolean;
  aprLoading: boolean;
  isConnected: boolean;
}) {
  const { config, apr, tvlUsd, userUsd } = vault;
  const held = isConnected && userUsd > 0.01;
  const pair = getPairName(config);

  const aprCell = aprLoading ? <Skeleton className="ml-auto h-4 w-12" /> : formatApr(apr);
  const tvlCell = isLoading ? <Skeleton className="ml-auto h-4 w-14" /> : formatUSDCompact(tvlUsd);
  const depositCell = !isConnected ? '—' : isLoading ? <Skeleton className="ml-auto h-4 w-12" /> : held ? formatUSDCompact(userUsd) : '—';

  return (
    // The whole row opens the vault page; "Deposit" is a visual cue inside the same link
    <Link
      href={`/vaults/${config.vaultAddress}`}
      className="group block border-b border-white/[0.04] px-4 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.025]"
    >
      <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm', COLS)}>
        <VaultIdentity vault={vault} held={held} />

        <span className="text-right font-semibold tabular-nums text-arca-green">{aprCell}</span>

        <span className="hidden justify-end md:flex">
          <Sparkline values={trend} label={`${pair} APR over the last ${TREND_DAYS} days`} />
        </span>
        <span className="hidden text-right md:block">
          <CompetitorEdgeCell config={config} />
        </span>
        <span className="hidden text-right tabular-nums text-arca-text-secondary md:block">
          {vault.aumFeePct === null ? '—' : `${vault.aumFeePct}%`}
        </span>
        <span className="hidden text-right tabular-nums text-arca-text md:block">{tvlCell}</span>
        <span className="hidden text-right tabular-nums text-arca-text md:block">{depositCell}</span>
        <span className="hidden justify-end md:flex">
          <span className="rounded-lg bg-white/[0.06] px-3 py-1 text-xs font-medium text-arca-text transition-colors group-hover:bg-arca-green group-hover:text-arca-dark">
            Deposit
          </span>
        </span>

        {/* Mobile: second line with TVL and deposit */}
        <span className="col-span-2 flex gap-4 pl-[50px] text-xs text-arca-text-secondary md:hidden">
          <span>TVL {tvlCell}</span>
          {vault.aumFeePct !== null && <span>AUM fee {vault.aumFeePct}%/yr</span>}
          {held && <span>You {depositCell}</span>}
        </span>
      </div>
    </Link>
  );
}

/**
 * Pair icons + name with the platform inline. `held` adds the green dot for vaults the user is in.
 */
export function VaultIdentity({
  vault,
  large = false,
  held = false,
}: {
  vault: Pick<VaultOverview, 'config'>;
  large?: boolean;
  held?: boolean;
}) {
  const { config } = vault;
  const platform = PLATFORMS[config.protocol];

  if (large) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <PairIcons logoX={getTokenLogo(config.tokenX)} logoY={getTokenLogo(config.tokenY)} size={44} />
        <div className="min-w-0">
          <div className="truncate text-2xl font-semibold text-arca-text">{getPairName(config)}</div>
          <div className="flex items-center gap-1.5 text-xs text-arca-text-secondary">
            <img src={platform.logo} alt="" className="h-3.5 w-3.5 rounded-full object-contain" />
            {platform.name}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PairIcons logoX={getTokenLogo(config.tokenX)} logoY={getTokenLogo(config.tokenY)} size={24} />
      <span className="truncate font-medium text-arca-text">{getPairName(config)}</span>
      {held && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-arca-green" aria-label="You have a deposit" />}
      <span className="hidden items-center gap-1 text-xs text-arca-text-tertiary sm:flex">
        <img src={platform.logo} alt="" className="h-3 w-3 rounded-full object-contain" />
        {platform.name}
      </span>
    </div>
  );
}
