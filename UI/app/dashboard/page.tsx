'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { DashboardVaultCard } from '@/components/DashboardVaultCard';

// Vault configurations from main page
const VAULT_CONFIGS = [
  {
    vaultAddress: '0xa2C50bba88d533f42FcA8efB068AD65c9D6c0551',
    stratAddress: '0x544dc3e2DF9c42437615e32773bd7B5B8337fa68',
    name: 'S • USDC | Metropolis',
    tier: 'Premium' as const,
  },
  {
    vaultAddress: '0xe3cc55e29cfa3204b810ed38be11949a91022d6b',
    stratAddress: '0x874af7e836edad19fc09a777cf2c8d7e676f1d2a',
    name: 'S • USDC | Shadow',
    tier: 'Premium' as const,
  },
];

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Use only the connected wallet address - no test fallback
  const actualAddress = address;

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VAULT_CONFIGS.map((vault, index) => (
            <DashboardVaultCard
              key={index}
              vaultAddress={vault.vaultAddress}
              stratAddress={vault.stratAddress}
              name={vault.name}
              tier={vault.tier}
              userAddress={actualAddress}
            />
          ))}
        </div>

        {/* Empty State */}
        {mounted && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-sm">
              Vault cards will appear here when you have active positions
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
