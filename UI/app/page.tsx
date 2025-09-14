'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { Header } from '@/components/Header';
import { VaultCard } from '@/components/VaultCard';
import { formatUSD } from '@/lib/utils';
import { useVaultData } from '@/hooks/useVaultData';
import { useSonicPrice } from '@/hooks/useSonicPrice';
import { METRO_VAULT_ABI } from '@/abi/MetroVault.abi';
import { METRO_STRAT_ABI } from '@/abi/MetroStrat.abi';

// Vault configurations with real contract addresses
const VAULT_CONFIGS = [
  {
    vaultAddress: '0xa2C50bba88d533f42FcA8efB068AD65c9D6c0551',
    stratAddress: '0x544dc3e2DF9c42437615e32773bd7B5B8337fa68',
    name: 'S • USDC | Metropolis',
    tier: 'Premium' as const,
    apy: 18.7,
  },
  {
    vaultAddress: '0xaEb8Af83857a5991a3B4Dc8e32FE627424fAf3c8',
    stratAddress: '0x52ba56f76a86cd345a47de360a127f640de30e88',
    name: 'S • USDC | Shadow',
    tier: 'Premium' as const,
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
    <div className="min-h-screen bg-arca-dark">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Yield Vault Strategies
          </h1>
          <p className="text-gray-400 text-lg">
            Deposit and earn yield on your crypto assets across our strategic vaults
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray">
            <div className="text-sm text-gray-400 mb-1">Total TVL</div>
            <div className="text-2xl font-bold text-arca-green">
              {vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(totalTVL)}
            </div>
          </div>
          
          <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray">
            <div className="text-sm text-gray-400 mb-1">Your Total Balance</div>
            <div className="text-2xl font-bold text-white">
              {!mounted ? '--' : 
               (!isConnected ? '--' : 
                (vault1Data.isLoading || vault2Data.isLoading ? '...' : formatUSD(userTotalBalance))
               )}
            </div>
          </div>
          
          <div className="bg-arca-gray rounded-lg p-6 border border-arca-light-gray">
            <div className="text-sm text-gray-400 mb-1">Active Vaults</div>
            <div className="text-2xl font-bold text-white">
              {VAULT_CONFIGS.length}
            </div>
          </div>
        </div>

        {/* Connection Prompt */}
        {mounted && !isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-xl">⚠️</div>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1">Connect Your Wallet</h3>
                <p className="text-yellow-300/80 text-sm">
                  Connect your Web3 wallet to view your balances and interact with the vaults.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vault Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VAULT_CONFIGS.map((vault, index) => (
            <VaultCard
              key={index}
              vaultAddress={vault.vaultAddress}
              stratAddress={vault.stratAddress}
              name={vault.name}
              tier={vault.tier}
              apy={vault.apy}
            />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Smart contracts are audited and secure. Always DYOR before investing.
          </p>
        </div>
      </main>
    </div>
  );
}
