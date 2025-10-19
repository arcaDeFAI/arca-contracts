'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import DashboardVaultCard from '@/components/DashboardVaultCard'
import PositionVisualizationCard from '@/components/PositionVisualizationCard';

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

  // Use test address for debugging Shadow vault issues
  const testAddress = '0x10dF75c83571b5dAA9638a84BB7490177A8E5816' as `0x${string}`;
  const actualAddress = address || testAddress;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-arca-dark">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Dashboard
          </h1>
          <p className="text-gray-400 text-lg">
            Manage your vault positions, claim rewards, and handle withdrawals
          </p>
        </div>

        {/* Connection Prompt */}
        {mounted && !isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-xl">⚠️</div>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1">Connect Your Wallet</h3>
                <p className="text-yellow-300/80 text-sm">
                  Connect your Web3 wallet to view your dashboard and manage your positions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vault Cards - Only show vaults where user has funds */}
        {mounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {VAULT_CONFIGS.map((vault, index) => (
              <div key={index} className="space-y-4">
                {/* Position Visualization Card */}
                <PositionVisualizationCard
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  lbBookAddress={vault.lbBookAddress}
                  clpoolAddress={vault.clpoolAddress}
                  name={vault.name}
                  tier={vault.tier}
                  userAddress={actualAddress}
                />
                
                {/* Dashboard Vault Card */}
                <DashboardVaultCard
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  name={vault.name}
                  tier={vault.tier}
                  userAddress={actualAddress}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
