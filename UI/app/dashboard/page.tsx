'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { DashboardVaultCard } from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';
import { SocialLinks } from '@/components/SocialLinks';
import { VaultTableView } from '@/components/VaultTableView';
import { VAULT_CONFIGS, type VaultConfig, isShadowVault } from '@/lib/vaultConfigs';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultConfig | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5"
        style={{ backgroundImage: 'url(/backgroundarca.jpg)' }}
      />
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
      <div className="relative z-10">
        <Header />

        <main className="container mx-auto px-3 sm:px-5 lg:px-6 py-5" style={{ maxWidth: '100%' }}>
          {/* Hero Section */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              Dashboard
            </h1>
            <p className="text-gray-400 text-sm">
              Manage your vault positions, claim rewards, and handle withdrawals
            </p>
          </div>

          {/* Connection Prompt */}
          {!isConnected && (
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="text-yellow-400 text-base">⚠️</div>
                <div>
                  <h3 className="text-yellow-400 font-semibold mb-1 text-xs">Connect Your Wallet</h3>
                  <p className="text-yellow-300/80 text-[11px]">
                    Connect your Web3 wallet to view your dashboard and manage your positions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Overview - Portfolio, Balance, Rewards */}
          {isConnected && (
            <DashboardOverview
              vaultConfigs={VAULT_CONFIGS}
              userAddress={address}
            />
          )}

          {/* Active Vaults Section */}
          {isConnected && (
            <>
              {/* Section Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1 h-6 bg-arca-green rounded-full"></div>
                  <h2 className="text-xl font-bold text-white">Active Vaults</h2>
                </div>
                <p className="text-gray-400 text-xs ml-5">Click on a vault to view details</p>
              </div>

              {/* Table View with Slide-out Panel */}
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Vault Table */}
                <div className={`transition-all duration-300 ${selectedVault ? 'lg:w-2/3' : 'w-full'}`}>
                  <VaultTableView
                    vaults={VAULT_CONFIGS}
                    userAddress={address}
                    onVaultClick={(vault) => setSelectedVault(vault)}
                    selectedVault={selectedVault || undefined}
                  />
                </div>

                {/* Detail Panel - Side on desktop, below on mobile */}
                {selectedVault && (
                  <div className="w-full lg:w-1/3 transition-all duration-300">
                    <div className="lg:sticky lg:top-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">Vault Details</h3>
                        <button
                          onClick={() => setSelectedVault(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                      <DashboardVaultCard
                        config={selectedVault}
                        userAddress={address}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Original Split Screen Layout - Hidden for now */}
              <div className="hidden grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Metropolis Vaults Container */}
                <div className="bg-black/40 rounded-xl p-5 border border-gray-800/50">
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <h2 className="text-2xl font-bold text-white">Metropolis Vaults</h2>
                    <img src="/MetropolisLogo.png" alt="Metropolis" className="w-10 h-10" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {VAULT_CONFIGS.filter(v => v.name.includes('Metropolis')).map((vault, index) => (
                      <DashboardVaultCard
                        key={index}
                        config={vault}
                        userAddress={address}
                      />
                    ))}
                  </div>
                </div>

                {/* Shadow Vaults Container */}
                <div className="bg-black/40 rounded-xl p-5 border border-gray-800/50">
                  <div className="flex items-center justify-center gap-2 mb-5">
                    <h2 className="text-2xl font-bold text-white">Shadow Vaults</h2>
                    <img src="/SHadowLogo.jpg" alt="Shadow" className="w-10 h-10 rounded-full" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {VAULT_CONFIGS.filter(v => v.name.includes('Shadow')).map((vault, index) => (
                      <DashboardVaultCard
                        key={index}
                        config={vault}
                        userAddress={address}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Social Links & Footer */}
          <SocialLinks />
        </main>
      </div>
    </div>
  );
}
