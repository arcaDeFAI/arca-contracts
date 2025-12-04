'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { SocialLinks } from '@/components/SocialLinks';
import { formatUSD } from '@/lib/utils';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { METRO_VAULT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';
import { VAULT_CONFIGS } from '@/lib/vaultConfigs';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Get vault metrics for all vaults - includes TVL, user balance, APY
  const allVaultMetrics = VAULT_CONFIGS.map(config =>
    useVaultMetrics(config, address)
  );

  // Calculate total TVL across all vaults
  const totalTVL = useMemo(() => {
    return allVaultMetrics.reduce((sum, metrics) => {
      return sum + (metrics.vaultTVL || 0);
    }, 0);
  }, [allVaultMetrics]);

  // Calculate user's total deposited value across all vaults
  const userTotalBalance = useMemo(() => {
    return allVaultMetrics.reduce((sum, metrics) => {
      return sum + (metrics.depositedValueUSD || 0);
    }, 0);
  }, [allVaultMetrics]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
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
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{maxWidth: '100%'}}>
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">
            Yield Vault Strategies
          </h1>
          <p className="text-gray-400 text-base">
            Deposit and earn yield on your crypto assets across our strategic vaults
          </p>
        </div>

        {/* Stats Cards */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="bg-black rounded-lg p-4 border border-gray-800/50 min-w-[180px]">
            <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">Total TVL</div>
            <div className="text-xl font-bold text-arca-green whitespace-nowrap">
              {allVaultMetrics.some(m => m.isLoading) ? '...' : formatUSD(totalTVL)}
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 border border-gray-800/50 min-w-[180px]">
            <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">Your Total Balance</div>
            <div className="text-xl font-bold text-white whitespace-nowrap">
              {!mounted ? '--' :
               (!isConnected ? '--' :
                (allVaultMetrics.some(m => m.isLoading) ? '...' : formatUSD(userTotalBalance))
               )}
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 border border-gray-800/50 min-w-[180px]">
            <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">Active Vaults</div>
            <div className="text-xl font-bold text-white whitespace-nowrap">
              {VAULT_CONFIGS.length}
            </div>
          </div>
        </div>

        {/* Connection Prompt */}
        {mounted && !isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-lg">⚠️</div>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1 text-sm">Connect Your Wallet</h3>
                <p className="text-yellow-300/80 text-xs">
                  Connect your Web3 wallet to view your balances and interact with the vaults.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Split Screen Layout - Metropolis and Shadow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metropolis Vaults Container */}
          <div className="bg-black/40 rounded-xl p-6 border border-gray-800/50">
            <div className="flex items-center justify-center gap-3 mb-6">
              <h2 className="text-3xl font-bold text-white">Metropolis Vaults</h2>
              <img src="/MetropolisLogo.png" alt="Metropolis" className="w-12 h-12" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VAULT_CONFIGS.filter(v => v.name.includes('Metropolis')).map((vault, index) => (
                <VaultCard
                  key={index}
                  config={vault}
                />
              ))}
            </div>
          </div>

          {/* Shadow Vaults Container */}
          <div className="bg-black/40 rounded-xl p-6 border border-gray-800/50">
            <div className="flex items-center justify-center gap-3 mb-6">
              <h2 className="text-3xl font-bold text-white">Shadow Vaults</h2>
              <img src="/SHadowLogo.jpg" alt="Shadow" className="w-12 h-12 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VAULT_CONFIGS.filter(v => v.name.includes('Shadow')).map((vault, index) => (
                <VaultCard
                  key={index}
                  config={vault}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Social Links & Footer */}
        <SocialLinks />
      </main>
      </div>
    </div>
  );
}
