'use client';

import { useAccount } from 'wagmi';
import { PageShell } from '@/components/PageShell';
import { VaultList } from '@/components/vaults/VaultList';
import { Card, Stat } from '@/components/ui';
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

function VaultsContent() {
  const { address, isConnected } = useAccount();
  const { vaults, isLoading, aprLoading } = useVaultsOverview(address);

  // Deposits in unlisted (retired) vaults still count toward the user's total and stay reachable via "My vaults".
  const listed = vaults.filter((v) => isVaultListed(v.config) || v.userUsd > 0.01);
  const totalTvl = vaults.reduce((s, v) => s + v.tvlUsd, 0);
  const userTotal = vaults.reduce((s, v) => s + v.userUsd, 0);

  return (
    <>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-arca-text">Vaults</h1>
        <p className="max-w-xl text-sm text-arca-text-secondary">
          Deposit into a vault and it provides liquidity for you, rebalancing automatically and collecting rewards.
        </p>
      </div>

      <Card className="mb-8 grid grid-cols-2 gap-6 p-5 sm:max-w-md">
        <Stat label="Total value locked" value={formatUSDCompact(totalTvl)} loading={isLoading} />
        <Stat label="Your deposits" value={isConnected ? formatUSDCompact(userTotal) : '—'} loading={isConnected && isLoading} />
      </Card>

      <VaultList vaults={listed} isLoading={isLoading} aprLoading={aprLoading} isConnected={isConnected} />
    </>
  );
}
