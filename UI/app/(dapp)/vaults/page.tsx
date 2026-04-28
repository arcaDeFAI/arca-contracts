'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { SocialLinks } from '@/components/SocialLinks';
import { formatUSD } from '@/lib/utils';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { VAULT_CONFIGS } from '@/lib/vaultConfigs';
import { StatsCard } from '@/components/StatsCard';
import { VaultTableView } from '@/components/VaultTableView';

// Tab Component
const FilterTab = ({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${isActive
      ? 'bg-arca-green/[0.1] text-arca-green shadow-sm'
      : 'text-arca-text-secondary hover:text-arca-text hover:bg-white/[0.04]'
      }`}
  >
    {label}
  </button>
);

const ViewToggleButton = ({
  isActive,
  label,
  onClick,
  inactiveIcon,
  activeIcon,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
  inactiveIcon: ReactNode;
  activeIcon: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
      isActive
        ? 'border-arca-green/30 bg-arca-green/[0.12] text-arca-green shadow-[0_0_0_1px_rgba(0,255,136,0.08)]'
        : 'border-white/[0.05] bg-arca-gray/60 text-arca-text-secondary hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-arca-text'
    }`}
  >
    <span className="t-icon-swap" data-state={isActive ? 'b' : 'a'}>
      <span className="t-icon" data-icon="a">{inactiveIcon}</span>
      <span className="t-icon" data-icon="b">{activeIcon}</span>
    </span>
  </button>
);

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Metropolis' | 'Shadow'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const allVaultMetrics = VAULT_CONFIGS.map(config =>
    useVaultMetrics(config, address)
  );

  const totalTVL = useMemo(() => {
    return allVaultMetrics.reduce((sum, metrics) => sum + (metrics.vaultTVL || 0), 0);
  }, [allVaultMetrics]);

  const userTotalBalance = useMemo(() => {
    return allVaultMetrics.reduce((sum, metrics) => sum + (metrics.depositedValueUSD || 0), 0);
  }, [allVaultMetrics]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayedVaults = VAULT_CONFIGS.filter(vault => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Metropolis') return vault.name.includes('Metropolis');
    if (activeTab === 'Shadow') return vault.name.includes('Shadow');
    return true;
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-arca-dark relative selection:bg-arca-green/20">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-arca-green/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-arca-green/[0.015] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />

        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">

          {/* Page Header */}
          <div className="flex flex-col gap-6 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-arca-text tracking-tight mb-2">
                Yield Vaults
              </h1>
              <p className="text-arca-text-secondary text-sm max-w-xl leading-relaxed">
                Earn high-yield APR on your crypto through automated Metropolis & Shadow strategies.
              </p>
            </div>

            {/* Stats Row */}
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
              <div className="min-w-0">
                <StatsCard
                  title="Total TVL"
                  value={allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(totalTVL)}
                  loading={allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              <div className="min-w-0">
                <StatsCard
                  title="Your Balance"
                  value={!isConnected ? '--' : (allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(userTotalBalance))}
                  loading={isConnected && allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              <div className="min-w-0">
                <StatsCard
                  title="Active Vaults"
                  value={VAULT_CONFIGS.length}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Wallet prompt */}
          {!isConnected && (
            <div className="bg-amber-500/[0.06] border border-amber-500/[0.12] rounded-2xl p-4 mb-8 flex items-start gap-3 animate-fade-in">
              <span className="text-lg mt-0.5">⚠️</span>
              <div>
                <h3 className="text-amber-400 font-medium text-sm mb-0.5">Wallet Not Connected</h3>
                <p className="text-amber-400/60 text-xs leading-relaxed">
                  Connect your wallet to deposit and view personal earnings.
                </p>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start sm:gap-3">
              <div className="flex w-fit max-w-[calc(100%-5.5rem)] bg-arca-gray/60 p-1 rounded-2xl border border-white/[0.04] sm:max-w-none">
                <FilterTab label="All Strategies" isActive={activeTab === 'All'} onClick={() => setActiveTab('All')} />
                <FilterTab label="Metropolis" isActive={activeTab === 'Metropolis'} onClick={() => setActiveTab('Metropolis')} />
                <FilterTab label="Shadow" isActive={activeTab === 'Shadow'} onClick={() => setActiveTab('Shadow')} />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ViewToggleButton
                  isActive={viewMode === 'grid'}
                  label="Grid view"
                  onClick={() => setViewMode('grid')}
                  inactiveIcon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.75 4.75h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5zm-9 9h5.5v5.5h-5.5zm9 0h5.5v5.5h-5.5z" />
                    </svg>
                  }
                  activeIcon={
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.75 4.75h5.5v5.5h-5.5zM13.75 4.75h5.5v5.5h-5.5zM4.75 13.75h5.5v5.5h-5.5zM13.75 13.75h5.5v5.5h-5.5z" />
                    </svg>
                  }
                />
                <ViewToggleButton
                  isActive={viewMode === 'list'}
                  label="List view"
                  onClick={() => setViewMode('list')}
                  inactiveIcon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7.25h14M5 12h14M5 16.75h14" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 7.25h.5M3.75 12h.5M3.75 16.75h.5" />
                    </svg>
                  }
                  activeIcon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 7.25h12M6 12h12M6 16.75h12" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3.75 7.25h.5M3.75 12h.5M3.75 16.75h.5" />
                    </svg>
                  }
                />
              </div>
            </div>

            <span className="text-xs text-arca-text-tertiary hidden sm:block">
              {displayedVaults.length} vault{displayedVaults.length !== 1 ? 's' : ''}
            </span>
          </div>

          {viewMode === 'grid' ? (
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {displayedVaults.map((vault, index) => (
                  <div key={index} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
                    <VaultCard config={vault} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <VaultTableView
                vaults={VAULT_CONFIGS}
                userAddress={address}
                onVaultClick={() => {}}
                showAllVaults
                interactiveRows={false}
                visibleVaultAddresses={displayedVaults.map((vault) => vault.vaultAddress)}
              />
            </div>
          )}

          <div className="mt-auto pt-16">
            <div className="border-t border-white/[0.04] pt-6">
              <SocialLinks />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
