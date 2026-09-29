'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { PageShell } from '@/components/PageShell';
import { PositionCard } from '@/components/vaults/PositionCard';
import { PortfolioChart } from '@/components/vaults/PortfolioChart';
import { Card, ConnectWalletButton, Stat } from '@/components/ui';
import { useVaultsOverview } from '@/hooks/useVaultsOverview';
import { useSubgraphUserHarvested } from '@/hooks/useSubgraphUserHarvested';
import { usePoints } from '@/hooks/usePoints';
import { formatApr, formatUSD } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <PageShell>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-arca-text">Dashboard</h1>
      <DashboardContent />
    </PageShell>
  );
}

function DashboardContent() {
  const { address, isConnected } = useAccount();
  const { vaults, isLoading } = useVaultsOverview(address);
  const harvested = useSubgraphUserHarvested(address);
  const points = usePoints(address);

  if (!isConnected) {
    return (
      <Card className="flex flex-col items-center p-12 text-center">
        <p className="mb-5 text-sm text-arca-text-secondary">Connect your wallet to see your deposits and rewards.</p>
        <ConnectWalletButton />
      </Card>
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
      <Card className="mb-8 p-5">
        <div className={`grid grid-cols-2 gap-6 ${points ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <Stat label="Total value" value={formatUSD(totalValue)} loading={isLoading} />
          <Stat label="Average APR" value={formatApr(weightedApr)} accent loading={isLoading} />
          <Stat label="Rewards claimed (all time)" value={formatUSD(harvested.totalHarvestedUSD)} loading={harvested.isLoading} />
          {points && <Stat label="Points" value={Math.floor(points.total).toLocaleString()} />}
        </div>
        {points && (
          <p className="mt-4 text-xs text-arca-text-tertiary">
            1 point per $1 held per day. Withdrawing early removes some points (all within 7 days, half within 30,
            a quarter within 90). Points may be used for a future airdrop; no airdrop is guaranteed.
          </p>
        )}
      </Card>

      {(hasDeposits || harvested.cumulative.length > 0) && (
        <PortfolioChart vaults={vaults} claimed={harvested.cumulative} claimedLoading={harvested.isLoading} />
      )}

      {!isLoading && !hasDeposits && (
        <Card className="mb-6 flex flex-col items-center p-10 text-center">
          <p className="mb-4 text-sm text-arca-text-secondary">You don&apos;t have any deposits yet.</p>
          <Link
            href="/vaults"
            className="rounded-xl bg-arca-green px-4 py-2.5 text-sm font-semibold text-arca-dark transition-colors hover:bg-arca-green/90"
          >
            Browse vaults
          </Link>
        </Card>
      )}

      {/* One card per vault; a card hides itself unless there is a deposit, rewards or a withdrawal to claim. */}
      <div className="grid gap-4 md:grid-cols-2">
        {[...vaults]
          .sort((a, b) => b.userUsd - a.userUsd)
          .map((v) => (
            <PositionCard
              key={v.config.vaultAddress}
              config={v.config}
              depositUsd={v.userUsd}
              shareRatio={v.totalSupply > 0n ? Number(v.userShares) / Number(v.totalSupply) : 0}
              apr={v.apr}
              showVault
            />
          ))}
      </div>
    </>
  );
}
