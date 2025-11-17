'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import DashboardVaultCard from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';

// Vault configurations from main page
const VAULT_CONFIGS = [
  // Metropolis Vaults
  {
    vaultAddress: '0xF5708969da13879d7A6D2F21d0411BF9eEB045E9',
    stratAddress: '0x20302bc08CcaAFB039916e4a06f0B3917506019a',
    lbBookAddress: '0x32c0D87389E72E46b54bc4Ea6310C1a0e921C4DC',
    name: 'S • USDC | Metropolis',
    tier: 'Premium' as const,
    tokenX: 'S',
    tokenY: 'USDC',
  },

  // Shadow Vaults
  {
    vaultAddress: '0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5',
    stratAddress: '0x64efeA2531f2b1A3569555084B88bb5714f5286c',
    clpoolAddress: '0x324963c267C354c7660Ce8CA3F5f167E05649970',
    rewardsAddress: '0xe879d0E44e6873cf4ab71686055a4f6817685f02', // S-USDC uses old rewards contract
    name: 'S • USDC | Shadow',
    tier: 'Premium' as const,
    tokenX: 'WS',
    tokenY: 'USDC',
  },
  {
    vaultAddress: '0xB6a8129779E57845588Db74435A9aFAE509e1454',
    stratAddress: '0x58c244BE630753e8E668f18C0F2Cffe3ea0E8126',
    clpoolAddress: '0xb6d9b069f6b96a507243d501d1a23b3fccfc85d3',
    rewardsAddress: '0xf5c7598c953e49755576cda6b2b2a9daaf89a837', // WS-WETH uses new rewards contract
    name: 'WS • WETH | Shadow',
    tier: 'Premium' as const,
    tokenX: 'WS',
    tokenY: 'WETH',
  },
  {
    vaultAddress: '0xd4083994F3ce977bcb5d3022041D489B162f5B85',
    stratAddress: '0x0806709c30A2999867160A1e4064f29ecCFA4605',
    clpoolAddress: '0x6fb30f3fcb864d49cdff15061ed5c6adfee40b40',
    rewardsAddress: '0x8cdec539ba3d3857ec29b491c78cfb48f5d34f56', // USDC-WETH uses its own rewards contract
    name: 'USDC • WETH | Shadow',
    tier: 'Premium' as const,
    tokenX: 'USDC',
    tokenY: 'WETH',
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
    // Replace line 68-69 with this:

    <div className="min-h-screen bg-gradient-to-br from-black via-arca-dark to-black" 
        style={{background: 'radial-gradient(ellipse at top, rgba(0, 255, 163, 0.08) 0%, rgba(0, 0, 0, 1) 100%)'}}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,163,0.15),rgba(0,255,163,0.05)_50%,transparent_80%)] pointer-events-none"></div>
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
                    rewardsAddress={(vault as any).rewardsAddress}
                    name={vault.name}
                    tier={vault.tier}
                    userAddress={address}
                    tokenX={vault.tokenX}
                    tokenY={vault.tokenY}
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
                    rewardsAddress={(vault as any).rewardsAddress}
                    name={vault.name}
                    tier={vault.tier}
                    userAddress={address}
                    tokenX={vault.tokenX}
                    tokenY={vault.tokenY}
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
