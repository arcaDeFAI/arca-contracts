'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TokenPrices {
  sonic: number;
  metro: number;
  shadow: number;
  xShadow: number;
  usdc: number;
  [key: string]: number;
}

interface PriceContextType {
  prices: TokenPrices | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

// Token address to CoinGecko ID mapping
const TOKEN_COINGECKO_IDS: { [key: string]: string } = {
  // Sonic (S token)
  's': 'sonic',
  'sonic': 'sonic',

  // Metro token: 0x71e99522ead5e21cf57f1f542dc4ad2e841f7321
  'metro': 'metropolis',
  '0x71e99522ead5e21cf57f1f542dc4ad2e841f7321': 'metropolis',

  // Shadow token: 0x3333b97138d4b086720b5ae8a7844b1345a33333
  'shadow': 'shadow-2',
  '0x3333b97138d4b086720b5ae8a7844b1345a33333': 'shadow-2',

  // xShadow: 0x5050bc082FF4A74Fb6B0B04385dEfdDB114b2424
  'xshadow': 'shadow-2', // Use same as Shadow for now
  '0x5050bc082ff4a74fb6b0b04385defddb114b2424': 'shadow-2',

  // USDC: 0x29219dd400f2Bf60E5a23d13Be72B486D4038894
  'usdc': 'usd-coin',
  '0x29219dd400f2bf60e5a23d13be72b486d4038894': 'usd-coin',
};

export function PriceProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoading(true);

        // Fetch all token prices in one API call
        const coingeckoIds = 'sonic,metropolis,shadow-2,usd-coin';
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch token prices');
        }

        const data = await response.json();

        const newPrices: TokenPrices = {
          sonic: data.sonic?.usd || 0,
          metro: data.metropolis?.usd || 0,
          shadow: data['shadow-2']?.usd || 0,
          xShadow: data['shadow-2']?.usd || 0, // xShadow uses same price as Shadow
          usdc: data['usd-coin']?.usd || 1, // USDC should always be ~$1
        };

        setPrices(newPrices);
        setLastUpdated(Date.now());
        setError(null);

        console.log('💰 Prices Updated:', {
          ...newPrices,
          timestamp: new Date().toLocaleTimeString()
        });
      } catch (err) {
        console.error('❌ Price fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately on mount
    fetchPrices();

    // Fetch every 60 seconds (1 minute)
    const interval = setInterval(fetchPrices, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <PriceContext.Provider value={{ prices, isLoading, error, lastUpdated }}>
      {children}
    </PriceContext.Provider>
  );
}

// Custom hook to use prices
export function usePrices() {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePrices must be used within a PriceProvider');
  }
  return context;
}

// Helper hook to get a specific token price by address or symbol
export function useTokenPrice(tokenIdentifier: string): number {
  const { prices } = usePrices();

  if (!prices) return 0;

  const normalizedId = tokenIdentifier.toLowerCase();

  // Direct lookup
  if (prices[normalizedId] !== undefined) {
    return prices[normalizedId];
  }

  // Lookup by CoinGecko ID mapping
  const coingeckoId = TOKEN_COINGECKO_IDS[normalizedId];
  if (coingeckoId) {
    // Map CoinGecko ID back to our price keys
    if (coingeckoId === 'sonic') return prices.sonic;
    if (coingeckoId === 'metropolis') return prices.metro;
    if (coingeckoId === 'shadow-2') return prices.shadow;
    if (coingeckoId === 'usd-coin') return prices.usdc;
  }

  return 0;
}
