'use client';

import { useTokenPrice, usePrices } from '@/contexts/PriceContext';

interface TokenPrices {
  [tokenAddress: string]: number;
}

// Hook to get prices for multiple token addresses
export function useTokenPrices(tokenAddresses: string[]) {
  const { prices, isLoading, error } = usePrices();
  
  // Map token addresses to their prices
  const tokenPrices: TokenPrices = {};
  
  if (prices && tokenAddresses) {
    tokenAddresses.forEach(address => {
      const normalizedAddress = address.toLowerCase();
      
      // Try to match known token addresses
      if (normalizedAddress === '0x71e99522ead5e21cf57f1f542dc4ad2e841f7321') {
        tokenPrices[normalizedAddress] = prices.metro;
      } else if (normalizedAddress === '0x3333b97138d4b086720b5ae8a7844b1345a33333') {
        tokenPrices[normalizedAddress] = prices.shadow;
      } else if (normalizedAddress === '0x5050bc082ff4a74fb6b0b04385defddb114b2424') {
        tokenPrices[normalizedAddress] = prices.xShadow;
      } else if (normalizedAddress === '0x29219dd400f2bf60e5a23d13be72b486d4038894') {
        tokenPrices[normalizedAddress] = prices.usdc;
      } else {
        // Default to $1 for unknown tokens
        tokenPrices[normalizedAddress] = 1.0;
      }
    });
  }

  return { prices: tokenPrices, isLoading, error };
}
