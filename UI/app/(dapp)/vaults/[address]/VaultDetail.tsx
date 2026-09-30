'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { PageShell } from '@/components/PageShell';
import { VaultIdentity } from '@/components/vaults/VaultList';
import { VaultHistoryChart } from '@/components/vaults/VaultHistoryChart';
import { DepositWithdrawPanel } from '@/components/vaults/DepositWithdrawPanel';
import { PositionCard } from '@/components/vaults/PositionCard';
import { AdminPanel } from '@/components/vaults/AdminPanel';
import { Card, Stat } from '@/components/ui';
import { useVaultsOverview } from '@/hooks/useVaultsOverview';
import { useVaultAdmin } from '@/hooks/useVaultAdmin';
import { useVaultFees } from '@/hooks/useVaultFees';
import { getVaultByAddress, PLATFORMS, type VaultConfig } from '@/lib/vaultConfigs';
import { formatApr, formatUSD, formatUSDCompact } from '@/lib/utils';
import { type ReactNode } from 'react';

function AboutRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <dt className="mb-0.5 font-medium text-arca-text">{title}</dt>
      <dd className="text-arca-text-secondary">{children}</dd>
    </div>
  );
}

export function VaultPageClient({ address }: { address: string }) {
  const config = getVaultByAddress(address);

  return (
    <PageShell>
      <Link href="/vaults" className="mb-6 inline-flex items-center gap-1.5 text-sm text-arca-text-secondary hover:text-arca-text">
        <ArrowLeftIcon className="h-4 w-4" />
        All vaults
      </Link>
      {config ? (
        <VaultDetail config={config} />
      ) : (
        <Card className="p-10 text-center text-sm text-arca-text-secondary">This vault doesn&apos;t exist.</Card>
      )}
    </PageShell>
  );
}

function VaultDetail({ config }: { config: VaultConfig }) {
  const { address, isConnected } = useAccount();
  const { vaults, isLoading, aprLoading } = useVaultsOverview(address);
  const { role } = useVaultAdmin(config, address);
  const { aumFeePct } = useVaultFees(config);
  const vault = vaults.find((v) => v.config.vaultAddress === config.vaultAddress);

  const shareRatio = vault && vault.totalSupply > 0n ? Number(vault.userShares) / Number(vault.totalSupply) : 0;
  const platform = PLATFORMS[config.protocol];
  const rewardToken = config.protocol === 'shadow' ? 'SHADOW' : 'METRO';

  return (
    <>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <VaultIdentity vault={{ config }} large />
        <div className="grid grid-cols-3 gap-6 sm:gap-10">
          <Stat label="APR" value={formatApr(vault?.apr ?? null)} accent loading={aprLoading} />
          <Stat label="TVL" value={formatUSDCompact(vault?.tvlUsd ?? 0)} loading={isLoading} />
          <Stat label="Your deposit" value={isConnected ? formatUSD(vault?.userUsd ?? 0) : '—'} loading={isConnected && isLoading} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="order-2 space-y-6 lg:order-1">
          <VaultHistoryChart vaultAddress={config.vaultAddress} />

          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-arca-text">About this vault</h2>
            <dl className="space-y-4 text-sm leading-relaxed">
              <AboutRow title="How it works">
                Your {config.tokenX} and {config.tokenY} provide liquidity on {platform.name} and earn {rewardToken}{' '}
                rewards. The vault rebalances automatically; your deposit&apos;s value moves with both token prices.
              </AboutRow>
              <AboutRow title="How APR is calculated">
                We add up the {rewardToken} rewards the vault received over the last 30 days, each valued at its
                price on the day it was paid. We divide that by the vault&apos;s average size over those 30 days and
                scale it to a year. It is based on real payouts, so it moves as rewards and deposits change.
              </AboutRow>
              <AboutRow title={`AUM fee${aumFeePct === null ? '' : ` · ${aumFeePct}% per year`}`}>
                An AUM (assets under management) fee is charged on your <em>whole deposit</em>, not only on profits,
                so it applies whether the vault earns or not. It&apos;s taken in small amounts at each rebalance
                (at most one day&apos;s worth per rebalance).
                {aumFeePct !== null && aumFeePct > 0 && (
                  <>
                    {' '}For example, at {aumFeePct}% a $1,000 deposit pays about{' '}
                    {formatUSD((1000 * aumFeePct) / 100 / 365)} per day, or {formatUSD((1000 * aumFeePct) / 100)} per
                    year.
                  </>
                )}{' '}
                The APR shown is before this fee; your net yield is roughly APR minus the fee.
              </AboutRow>
            </dl>
          </Card>

          {role && <AdminPanel config={config} role={role} metrics={vault?.metrics} />}
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <DepositWithdrawPanel config={config} userShares={vault?.userShares ?? 0n} />
          <PositionCard config={config} depositUsd={vault?.userUsd ?? 0} shareRatio={shareRatio} />
        </div>
      </div>
    </>
  );
}
