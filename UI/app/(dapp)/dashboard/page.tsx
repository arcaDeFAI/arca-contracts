'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { DashboardVaultCard } from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';
import { SocialLinks } from '@/components/SocialLinks';
import { VaultTableView } from '@/components/VaultTableView';
import { VAULT_CONFIGS, type VaultConfig } from '@/lib/vaultConfigs';

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
    <div className="min-h-screen bg-arca-dark relative">
      {/* Subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-arca-green/[0.015] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header />

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-arca-text tracking-tight mb-1">
              Dashboard
            </h1>
            <p className="text-arca-text-secondary text-sm">
              Manage positions, claim rewards, and handle withdrawals
            </p>
          </div>

          {/* Connection Prompt */}
          {!isConnected && (
            <div className="bg-amber-500/[0.06] border border-amber-500/[0.12] rounded-2xl p-4 mb-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  <h3 className="text-amber-400 font-medium text-sm mb-0.5">Connect Your Wallet</h3>
                  <p className="text-amber-400/60 text-xs">
                    Connect your wallet to view your dashboard and manage positions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Overview */}
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
              <div className="mb-5 mt-2">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-1 h-5 bg-arca-green rounded-full"></div>
                  <h2 className="text-lg font-semibold text-arca-text">Active Vaults</h2>
                </div>
                <p className="text-arca-text-tertiary text-xs ml-[18px]">Click on a vault to view details</p>
              </div>

              {/* Table + Detail Panel */}
              <div className="flex flex-col lg:flex-row gap-5">
                <div className={`transition-all duration-300 ${selectedVault ? 'lg:w-2/3' : 'w-full'}`}>
                  <VaultTableView
                    vaults={VAULT_CONFIGS}
                    userAddress={address}
                    onVaultClick={(vault) => setSelectedVault(vault)}
                    selectedVault={selectedVault || undefined}
                  />
                </div>

                {selectedVault && (
                  <div className="w-full lg:w-1/3 transition-all duration-300 animate-fade-in">
                    <div className="lg:sticky lg:top-20">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-arca-text font-semibold text-sm">Vault Details</h3>
                        <button
                          onClick={() => setSelectedVault(null)}
                          className="text-arca-text-tertiary hover:text-arca-text transition-colors p-1 rounded-lg hover:bg-white/[0.04]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
            </>
          )}

          {/* Footer */}
          <div className="mt-16 pt-6 border-t border-white/[0.04]">
            <SocialLinks />
          </div>
        </main>
      </div>
    </div>
  );
}
