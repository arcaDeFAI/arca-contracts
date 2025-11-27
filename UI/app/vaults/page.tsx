'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { SocialLinks } from '@/components/SocialLinks';
import { formatUSD } from '@/lib/utils';
import { useVaultData } from '@/hooks/useVaultData';
import { usePrices } from '@/contexts/PriceContext';
import { METRO_VAULT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';

// Vault configurations with real contract addresses
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
  // TODO: Add Metropolis S/WETH vault when deployed
  // {
  //   vaultAddress: 'TBD',
  //   stratAddress: 'TBD',
  //   lbBookAddress: '0x9ede606c7168bb09ff73ebde7bfd6fcfabda9bc3',
  //   name: 'S • WETH | Metropolis',
  //   tier: 'Premium' as const,
  //   tokenX: 'S',
  //   tokenY: 'WETH',
  // },
  // TODO: Add Metropolis USDC/WETH vault when deployed
  // {
  //   vaultAddress: 'TBD',
  //   stratAddress: 'TBD',
  //   lbBookAddress: '0x51910f84cc4df86f721f5a1d3bdbd1058af62297',
  //   name: 'USDC • WETH | Metropolis',
  //   tier: 'Premium' as const,
  //   tokenX: 'USDC',
  //   tokenY: 'WETH',
  // },

  // Shadow Vaults
  {
    vaultAddress: '0x727e6D1FF1f1836Bb7Cdfad30e89EdBbef878ab5',
    stratAddress: '0x64efeA2531f2b1A3569555084B88bb5714f5286c',
    clpoolAddress: '0x324963c267C354c7660Ce8CA3F5f167E05649970',
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
    poolSymbol: 'a5ea7bec-91e2-4743-964d-35ea9034b0bd' as const, // DeFi Llama pool ID
    name: 'USDC • WETH | Shadow',
    tier: 'Premium' as const,
    tokenX: 'USDC',
    tokenY: 'WETH',
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  const { prices } = usePrices();
  const sonicPrice = prices.sonic;

  // Get vault data for all vaults
  const vault1Data = useVaultData(VAULT_CONFIGS[0], address);
  const vault2Data = useVaultData(VAULT_CONFIGS[1], address);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Calculate total TVL from all vaults
  const totalTVL = (() => {
    let total = 0;
    
    if (vault1Data.balances) {
      total += Number(vault1Data.balances[1]) / (10 ** 6) + // USDC
               (Number(vault1Data.balances[0]) / (10 ** 18)) * sonicPrice; // S * price
    }
    
    if (vault2Data.balances) {
      total += Number(vault2Data.balances[1]) / (10 ** 6) + // USDC
               (Number(vault2Data.balances[0]) / (10 ** 18)) * sonicPrice; // S * price
    }
    
    return total;
  })();

  // Calculate user's total deposited value across all vaults
  const userTotalBalance = (() => {
    let total = 0;
    
    // Get preview amounts for each vault if user has shares
    const vaults = [vault1Data, vault2Data];
    
    vaults.forEach((vaultData) => {
      if (vaultData.userShares && vaultData.userShares > 0n) {
        // We'll need to add preview amounts calculation here
        // For now, using a simplified calculation based on share percentage
        if (vaultData.balances && vaultData.sharePercentage > 0) {
          const userUSDC = (Number(vaultData.balances[1]) / (10 ** 6)) * (vaultData.sharePercentage / 100);
          const userS = (Number(vaultData.balances[0]) / (10 ** 18)) * (vaultData.sharePercentage / 100) * sonicPrice;
          total += userUSDC + userS;
        }
      }
    });
    
    return total;
  })();

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
              {vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(totalTVL)}
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 border border-gray-800/50 min-w-[180px]">
            <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">Your Total Balance</div>
            <div className="text-xl font-bold text-white whitespace-nowrap">
              {!mounted ? '--' : 
               (!isConnected ? '--' : 
                (vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(userTotalBalance))
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
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  poolSymbol={(vault as any).poolSymbol}
                  name={vault.name}
                  tier={vault.tier}
                  tokenX={vault.tokenX}
                  tokenY={vault.tokenY}
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
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  poolSymbol={(vault as any).poolSymbol}
                  name={vault.name}
                  tier={vault.tier}
                  tokenX={vault.tokenX}
                  tokenY={vault.tokenY}
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
