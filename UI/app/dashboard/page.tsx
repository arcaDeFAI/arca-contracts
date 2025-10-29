'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import DashboardVaultCard from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';

// Vault configurations from main page
const VAULT_CONFIGS = [
  {
    vaultAddress: '0xa2C50bba88d533f42FcA8efB068AD65c9D6c0551',
    stratAddress: '0x544dc3e2DF9c42437615e32773bd7B5B8337fa68',
    lbBookAddress: '0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC',
    name: 'S • USDC | Metropolis',
    tier: 'Premium' as const,
  },
  {
    vaultAddress: '0x81897b30c38A14c8B28B9Ab30Daab6BF4D84b340',
    stratAddress: '0x93dDa562a6661460d56AF7A02578F3BDD699C7e7',
    clpoolAddress: '0x324963c267C354c7660Ce8CA3F5f167E05649970',
    name: 'S • USDC | Shadow',
    tier: 'Premium' as const,
  },
];

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-arca-dark to-black" style={{background: 'radial-gradient(ellipse at top, rgba(0, 255, 163, 0.08) 0%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 1) 100%)'}}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,163,0.12),transparent_50%)] pointer-events-none"></div>
      <div className="relative z-10">
      <Header />
      
      <main className="container mx-auto px-3 sm:px-5 lg:px-6 py-5" style={{maxWidth: '100%'}}>
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
              <p className="text-gray-400 text-xs ml-5">Monitor and manage your vault positions</p>
            </div>

            {/* Split Screen Layout - Metropolis and Shadow */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                    vaultAddress={vault.vaultAddress}
                    stratAddress={vault.stratAddress}
                    lbBookAddress={vault.lbBookAddress}
                    clpoolAddress={vault.clpoolAddress}
                    name={vault.name}
                    tier={vault.tier}
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
                    vaultAddress={vault.vaultAddress}
                    stratAddress={vault.stratAddress}
                    lbBookAddress={vault.lbBookAddress}
                    clpoolAddress={vault.clpoolAddress}
                    name={vault.name}
                    tier={vault.tier}
                    userAddress={address}
                  />
                ))}
              </div>
            </div>
          </div>
          </>
        )}
      </main>
      </div>
    </div>
  );
}
