'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { SocialLinks } from '@/components/SocialLinks';
import { formatUSD } from '@/lib/utils';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { VAULT_CONFIGS } from '@/lib/vaultConfigs';
import { StatsCard } from '@/components/StatsCard';

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
    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
      ? 'bg-arca-green/[0.1] text-arca-green shadow-sm'
      : 'text-arca-text-secondary hover:text-arca-text hover:bg-white/[0.04]'
      }`}
  >
    {label}
  </button>
);

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Metropolis' | 'Shadow'>('All');

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

  if (!mounted) return null;

  const displayedVaults = VAULT_CONFIGS.filter(vault => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Metropolis') return vault.name.includes('Metropolis');
    if (activeTab === 'Shadow') return vault.name.includes('Shadow');
    return true;
  });

  return (
    <div className="min-h-screen bg-arca-dark relative selection:bg-arca-green/20">
      {/* Subtle background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-arca-green/[0.02] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-arca-green/[0.015] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 max-w-[1400px] mx-auto">

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
            <div className="flex flex-wrap gap-3 w-full">
              <div className="flex-1 min-w-[180px] max-w-[260px]">
                <StatsCard
                  title="Total TVL"
                  value={allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(totalTVL)}
                  loading={allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              <div className="flex-1 min-w-[180px] max-w-[260px]">
                <StatsCard
                  title="Your Balance"
                  value={!isConnected ? '--' : (allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(userTotalBalance))}
                  loading={isConnected && allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              <div className="flex-1 min-w-[180px] max-w-[260px]">
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
            <div className="flex bg-arca-gray/60 p-1 rounded-2xl border border-white/[0.04]">
              <FilterTab label="All Strategies" isActive={activeTab === 'All'} onClick={() => setActiveTab('All')} />
              <FilterTab label="Metropolis" isActive={activeTab === 'Metropolis'} onClick={() => setActiveTab('Metropolis')} />
              <FilterTab label="Shadow" isActive={activeTab === 'Shadow'} onClick={() => setActiveTab('Shadow')} />
            </div>

            <span className="text-xs text-arca-text-tertiary hidden sm:block">
              {displayedVaults.length} vault{displayedVaults.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Vault Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {displayedVaults.map((vault, index) => (
              <div key={index} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
                <VaultCard config={vault} />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-20 pt-8 border-t border-white/[0.04]">
            <SocialLinks />
          </div>

        </main>
      </div>
    </div>
  );
}
