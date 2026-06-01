'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { DashboardVaultCard } from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';
import { SocialLinks } from '@/components/SocialLinks';
import { VaultTableView } from '@/components/VaultTableView';
import { WalletNotice } from '@/components/WalletNotice';
import { VAULT_CONFIGS, type VaultConfig } from '@/lib/vaultConfigs';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultConfig | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedVault) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedVault(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedVault]);

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
            <WalletNotice className="mb-6">
              Connect your wallet to view your dashboard and manage positions.
            </WalletNotice>
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
              <div>
                <VaultTableView
                  vaults={VAULT_CONFIGS}
                  userAddress={address}
                  onVaultClick={(vault) => setSelectedVault(vault)}
                  selectedVault={selectedVault || undefined}
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-16 pt-6 border-t border-white/[0.04]">
            <SocialLinks />
          </div>
        </main>
      </div>

      {isConnected && selectedVault && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedVault(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vault-details-title"
            className="relative max-h-[78vh] w-full max-w-[560px] overflow-y-auto rounded-2xl lg:max-w-[600px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 id="vault-details-title" className="text-arca-text font-semibold text-sm">Vault Details</h3>
              <button
                onClick={() => setSelectedVault(null)}
                type="button"
                aria-label="Close vault details"
                className="arca-focus rounded-lg p-1 text-arca-text-tertiary transition-colors hover:bg-white/[0.04] hover:text-arca-text"
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
  );
}
