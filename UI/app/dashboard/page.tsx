'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import DashboardVaultCard from '@/components/DashboardVaultCard';
import { DashboardOverview } from '@/components/DashboardOverview';
import { SocialLinks } from '@/components/SocialLinks';
import { VaultTableView } from '@/components/VaultTableView';

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
    poolSymbol: 'bfb130df-7dd3-4f19-a54c-305c8cb6c9f0' as const, // DeFi Llama pool ID
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
    poolSymbol: 'e50ce450-d2b8-45fe-b496-9ee1fb5673c2' as const, // DeFi Llama pool ID
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
    poolSymbol: 'a5ea7bec-91e2-4743-964d-35ea9034b0bd' as const, // DeFi Llama pool ID
    name: 'USDC • WETH | Shadow',
    tier: 'Premium' as const,
    tokenX: 'USDC',
    tokenY: 'WETH',
  },
];

type VaultConfig = typeof VAULT_CONFIGS[number];

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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ backgroundImage: 'url(/backgroundarca.png)' }}
      />
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
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
                      vaultAddress={selectedVault.vaultAddress}
                      stratAddress={selectedVault.stratAddress}
                      lbBookAddress={selectedVault.lbBookAddress}
                      clpoolAddress={selectedVault.clpoolAddress}
                      rewardsAddress={(selectedVault as any).rewardsAddress}
                      poolSymbol={(selectedVault as any).poolSymbol}
                      name={selectedVault.name}
                      tier={selectedVault.tier}
                      userAddress={address}
                      tokenX={selectedVault.tokenX}
                      tokenY={selectedVault.tokenY}
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
                    vaultAddress={vault.vaultAddress}
                    stratAddress={vault.stratAddress}
                    lbBookAddress={vault.lbBookAddress}
                    clpoolAddress={vault.clpoolAddress}
                    rewardsAddress={(vault as any).rewardsAddress}
                    poolSymbol={(vault as any).poolSymbol}
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
                    poolSymbol={(vault as any).poolSymbol}
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

        {/* Social Links & Footer */}
        <SocialLinks />
      </main>
      </div>
    </div>
  );
}
