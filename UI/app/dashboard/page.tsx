'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import DashboardVaultCard from '@/components/DashboardVaultCard';

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
    <div className="min-h-screen bg-gradient-to-br from-black via-arca-dark to-black" style={{background: 'radial-gradient(ellipse at top, rgba(0, 255, 163, 0.03) 0%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 1) 100%)'}}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,163,0.05),transparent_50%)] pointer-events-none"></div>
      <div className="relative z-10">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{maxWidth: '100%'}}>
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">
            Dashboard
          </h1>
          <p className="text-gray-400 text-base">
            Manage your vault positions, claim rewards, and handle withdrawals
          </p>
        </div>

        {/* Connection Prompt */}
        {!isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-lg">⚠️</div>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1 text-sm">Connect Your Wallet</h3>
                <p className="text-yellow-300/80 text-xs">
                  Connect your Web3 wallet to view your dashboard and manage your positions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vault Cards - Only show vaults where user has funds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          {VAULT_CONFIGS.map((vault, index) => (
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
      </main>
      </div>
    </div>
  );
}
