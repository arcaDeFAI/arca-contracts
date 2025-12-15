'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { SocialLinks } from '@/components/SocialLinks';
import { formatUSD } from '@/lib/utils';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { VAULT_CONFIGS } from '@/lib/vaultConfigs';
import { Skeleton } from '@/components/Skeleton';
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
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
      ? 'bg-arca-green text-black shadow-lg shadow-arca-green/20'
      : 'bg-black/40 text-gray-400 hover:text-white hover:bg-black/60 border border-transparent'
      }`}
  >
    {label}
  </button>
);

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'All' | 'Metropolis' | 'Shadow'>('All');

  // Get vault metrics for all vaults
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

  // Filter Vaults
  const displayedVaults = VAULT_CONFIGS.filter(vault => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Metropolis') return vault.name.includes('Metropolis');
    if (activeTab === 'Shadow') return vault.name.includes('Shadow');
    return true;
  });

  return (
    <div className="min-h-screen bg-black relative selection:bg-arca-green/30">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url(/backgroundarca.png)' }}
      />
      {/* Gradient Overlay - Subtle */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80 pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full" style={{ maxWidth: '100%' }}>

          {/* Hero / Header Section */}
          <div className="flex flex-col gap-8 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Yield Vault Strategies
              </h1>
              <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
                Deposit and earn high-yield APY on your crypto assets across our automated Metropolis & Shadow strategies.
              </p>
            </div>

            {/* Global Stats - Compact Row */}
            <div className="flex flex-wrap gap-4 w-full">
              {/* TVL */}
              <div className="flex-1 sm:flex-none sm:w-[210px]">
                <StatsCard
                  title="TVL"
                  value={allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(totalTVL)}
                  loading={allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              {/* Balance */}
              <div className="flex-1 sm:flex-none sm:w-[210px]">
                <StatsCard
                  title="My Balance"
                  value={!isConnected ? '--' : (allVaultMetrics.some(m => m.isLoading) ? undefined : formatUSD(userTotalBalance))}
                  loading={isConnected && allVaultMetrics.some(m => m.isLoading)}
                  className="h-full"
                />
              </div>

              {/* Count */}
              <div className="flex-1 sm:flex-none sm:w-[210px]">
                <StatsCard
                  title="Vaults"
                  value={VAULT_CONFIGS.length}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Connection Prompt */}
          {!isConnected && (
            <div className="bg-yellow-900/10 border border-yellow-600/20 rounded-xl p-4 mb-8 flex items-start gap-4 animate-fadeIn">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-yellow-500 font-semibold mb-1">Wallet Not Connected</h3>
                <p className="text-yellow-400/70 text-sm">
                  Connect your Web3 wallet to deposit assets and view your personal earnings.
                </p>
              </div>
            </div>
          )}

          {/* Controls: Tabs & Search (Placeholder) */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 sticky top-4 z-20 py-2 bg-black/50 backdrop-blur-md rounded-xl sm:bg-transparent sm:backdrop-blur-none sm:static">
            <div className="flex bg-arca-gray p-1 rounded-xl border border-gray-800/50">
              <FilterTab label="All Strategies" isActive={activeTab === 'All'} onClick={() => setActiveTab('All')} />
              <FilterTab label="Metropolis" isActive={activeTab === 'Metropolis'} onClick={() => setActiveTab('Metropolis')} />
              <FilterTab label="Shadow" isActive={activeTab === 'Shadow'} onClick={() => setActiveTab('Shadow')} />
            </div>

            {/* Could add a search bar or sort dropdown here */}
            <div className="text-sm text-gray-500 hidden sm:block">
              Showing {displayedVaults.length} vaults
            </div>
          </div>

          {/* Vault Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {displayedVaults.map((vault, index) => (
              <div key={index} className="animate-fadeUp" style={{ animationDelay: `${index * 50}ms` }}>
                <VaultCard config={vault} />
              </div>
            ))}
          </div>

          {/* Footer Area */}
          <div className="mt-20 border-t border-gray-800/50 pt-10">
            <SocialLinks />
          </div>

        </main>
      </div>
    </div>
  );
}
