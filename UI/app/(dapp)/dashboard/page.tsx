'use client';

import { useAccount } from 'wagmi';
import { PageShell } from '@/components/PageShell';
import { PositionsTable } from '@/components/vaults/PositionsTable';
import { PortfolioChart } from '@/components/vaults/PortfolioChart';
import { Card, ConnectWalletButton, Skeleton } from '@/components/ui';
import { useVaultsOverview } from '@/hooks/useVaultsOverview';
import { useSubgraphUserHarvested } from '@/hooks/useSubgraphUserHarvested';
import { usePoints } from '@/hooks/usePoints';
import { cn, formatApr, formatUSD } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <PageShell>
      <DashboardContent />
    </PageShell>
  );
}

function HeaderStat({ label, value, accent = false }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-arca-text-secondary">{label}</div>
      {value === null ? (
        <Skeleton className="ml-auto mt-1 h-5 w-16" />
      ) : (
        <div className={cn('text-lg font-semibold tabular-nums', accent ? 'text-arca-green' : 'text-arca-text')}>{value}</div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { address, isConnected } = useAccount();
  const { vaults, isLoading } = useVaultsOverview(address);
  const harvested = useSubgraphUserHarvested(address);
  const points = usePoints(address);

  if (!isConnected) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-arca-text">Dashboard</h1>
        <Card className="flex flex-col items-center p-12 text-center">
          <p className="mb-5 text-sm text-arca-text-secondary">Connect your wallet to see your deposits and rewards.</p>
          <ConnectWalletButton />
        </Card>
      </>
    );
  }

  // Current worth of the user's shares (not the amount originally deposited)
  const totalValue = vaults.reduce((s, v) => s + v.userUsd, 0);
  // Value-weighted APR across the user's vaults
  const weightedApr =
    totalValue > 0 ? vaults.reduce((s, v) => s + (v.apr ?? 0) * v.userUsd, 0) / totalValue : null;
  const hasDeposits = totalValue > 0.01;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-arca-text">Dashboard</h1>
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <HeaderStat label="Total value" value={isLoading ? null : formatUSD(totalValue)} />
          <HeaderStat label="Average APR" value={isLoading ? null : formatApr(weightedApr)} accent />
          <HeaderStat label="Rewards claimed" value={harvested.isLoading ? null : formatUSD(harvested.totalHarvestedUSD)} />
          {points && <HeaderStat label="Points" value={Math.floor(points.total).toLocaleString()} />}
        </div>
      </div>

      {points && (
        <p className="-mt-3 mb-6 text-right text-[11px] text-arca-text-tertiary">
          1 point per $1 per day · early withdrawals remove points · a future airdrop is not guaranteed
        </p>
      )}

      <div className="mb-6">
        <PositionsTable vaults={vaults} emptyHint={!isLoading && !hasDeposits} />
      </div>

      {(hasDeposits || harvested.cumulative.length > 0) && (
        <PortfolioChart vaults={vaults} claimed={harvested.cumulative} claimedLoading={harvested.isLoading} />
      )}
    </>
  );
}
