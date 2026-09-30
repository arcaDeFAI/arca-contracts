'use client';

import { useAccount } from 'wagmi';
import { PageShell } from '@/components/PageShell';
import { VaultList } from '@/components/vaults/VaultList';
import { CompetitorEdge } from '@/components/vaults/CompetitorEdge';
import { Skeleton } from '@/components/ui';
import { useVaultsOverview } from '@/hooks/useVaultsOverview';
import { isVaultListed } from '@/lib/vaultConfigs';
import { formatUSDCompact } from '@/lib/utils';

export default function VaultsPage() {
  return (
    <PageShell>
      <VaultsContent />
    </PageShell>
  );
}

function HeaderStat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-arca-text-secondary">{label}</div>
      {value === null ? <Skeleton className="ml-auto mt-1 h-5 w-16" /> : <div className="text-lg font-semibold tabular-nums text-arca-text">{value}</div>}
    </div>
  );
}

function VaultsContent() {
  const { address, isConnected } = useAccount();
  const { vaults, isLoading, aprLoading } = useVaultsOverview(address);

  // Deposits in unlisted (retired) vaults still count toward the user's total and stay reachable via "My vaults".
  const listed = vaults.filter((v) => isVaultListed(v.config) || v.userUsd > 0.01);
  const totalTvl = vaults.reduce((s, v) => s + v.tvlUsd, 0);
  const userTotal = vaults.reduce((s, v) => s + v.userUsd, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-arca-text">Vaults</h1>
          <p className="text-sm text-arca-text-secondary">Automated liquidity that rebalances and earns rewards for you.</p>
        </div>
        <div className="flex gap-8">
          <HeaderStat label="Total value locked" value={isLoading ? null : formatUSDCompact(totalTvl)} />
          {isConnected && <HeaderStat label="Your deposits" value={isLoading ? null : formatUSDCompact(userTotal)} />}
        </div>
      </div>

      <CompetitorEdge />

      <VaultList vaults={listed} isLoading={isLoading} aprLoading={aprLoading} isConnected={isConnected} />
    </>
  );
}
