'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { formatUSD } from '@/lib/utils';
import { useVaultData } from '@/hooks/useVaultData';
import { useSonicPrice } from '@/hooks/useSonicPrice';
import { METRO_VAULT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';

// Vault configurations with real contract addresses
const VAULT_CONFIGS = [
  {
    vaultAddress: '0xa2C50bba88d533f42FcA8efB068AD65c9D6c0551',
    stratAddress: '0x544dc3e2DF9c42437615e32773bd7B5B8337fa68',
    name: 'S • USDC | Metropolis',
    apy: 18.7,
  },
  {
    vaultAddress: '0x81897b30c38A14c8B28B9Ab30Daab6BF4D84b340',
    stratAddress: '0x93dDa562a6661460d56AF7A02578F3BDD699C7e7',
    name: 'S • USDC | Shadow',
    apy: 24.1,
  },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Use actual wallet address for testing
  const testAddress = '0x10dF75c83571b5dAA9638a84BB7490177A8E5816' as `0x${string}`;
  const actualAddress = address || testAddress;

  const { price: sonicPrice } = useSonicPrice();

  // Get vault data for all vaults
  const vault1Data = useVaultData(VAULT_CONFIGS[0], actualAddress);
  const vault2Data = useVaultData(VAULT_CONFIGS[1], actualAddress);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-black via-arca-dark to-black" style={{background: 'radial-gradient(ellipse at top, rgba(0, 255, 163, 0.03) 0%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 1) 100%)'}}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,163,0.05),transparent_50%)] pointer-events-none"></div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black rounded-lg p-4 border border-gray-800/50">
            <div className="text-xs text-gray-400 mb-1">Total TVL</div>
            <div className="text-xl font-bold text-arca-green">
              {vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(totalTVL)}
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 border border-gray-800/50">
            <div className="text-xs text-gray-400 mb-1">Your Total Balance</div>
            <div className="text-xl font-bold text-white">
              {!mounted ? '--' : 
               (!isConnected ? '--' : 
                (vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(userTotalBalance))
               )}
            </div>
          </div>
          
          <div className="bg-black rounded-lg p-4 border border-gray-800/50">
            <div className="text-xs text-gray-400 mb-1">Active Vaults</div>
            <div className="text-xl font-bold text-white">
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
            <div className="grid grid-cols-2 gap-4">
              {VAULT_CONFIGS.filter(v => v.name.includes('Metropolis')).map((vault, index) => (
                <VaultCard
                  key={index}
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  name={vault.name}
                  tier={vault.tier}
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
            <div className="grid grid-cols-2 gap-4">
              {VAULT_CONFIGS.filter(v => v.name.includes('Shadow')).map((vault, index) => (
                <VaultCard
                  key={index}
                  vaultAddress={vault.vaultAddress}
                  stratAddress={vault.stratAddress}
                  name={vault.name}
                  tier={vault.tier}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Smart contracts are audited and secure. Always do your own research before investing.
          </p>
        </div>
      </main>
      </div>
    </div>
  );
}
