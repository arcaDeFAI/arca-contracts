'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TokenPrices {
  sonic: number;
  metro: number;
  shadow: number;
  xShadow: number;
  usdc: number;
  weth: number;
  [key: string]: number;
}

interface PriceContextType {
  prices: TokenPrices;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

// Token address to CoinGecko ID mapping
const TOKEN_COINGECKO_IDS: { [key: string]: string } = {
  // Sonic (S token)
  's': 'sonic-3',
  'sonic': 'sonic-3',

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

  // WETH: 0x50c42dEAcD8Fc9773493ED674b675bE577f2634b
  'weth': 'ethereum',
  '0x50c42deacd8fc9773493ed674b675be577f2634b': 'ethereum',
};

export function PriceProvider({ children }: { children: ReactNode }) {
  // Initialize with fallback prices to prevent race conditions
  const [prices, setPrices] = useState<TokenPrices>({
    sonic: 0.17,
    metro: 0,
    shadow: 0,
    xShadow: 0,
    usdc: 1,
    weth: 3400, // Approximate ETH price as fallback
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoading(true);

        // Fetch S and WS from DIA API
        let sonicPrice = 0.17;
        try {
          const diaResponse = await fetch(
            'https://api.diadata.org/v1/assetQuotation/Sonic/0x0000000000000000000000000000000000000000'
          );
          if (diaResponse.ok) {
            const diaData = await diaResponse.json();
            sonicPrice = diaData.Price || 0.17;
          }
        } catch {
          // Fallback to CoinGecko for S
          try {
            const cgResponse = await fetch(
              'https://api.coingecko.com/api/v3/simple/price?ids=sonic-3&vs_currencies=usd'
            );
            if (cgResponse.ok) {
              const cgData = await cgResponse.json();
              sonicPrice = cgData['sonic-3']?.usd || 0.17;
            }
          } catch {
            // Using fallback S price
          }
        }

        // Fetch WETH/ETH from DIA API
        let wethPrice = 3400;
        try {
          const diaEthResponse = await fetch(
            'https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000'
          );
          if (diaEthResponse.ok) {
            const diaEthData = await diaEthResponse.json();
            wethPrice = diaEthData.Price || 3400;
          }
        } catch {
          // Fallback to CoinGecko for WETH
          try {
            const cgResponse = await fetch(
              'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
            );
            if (cgResponse.ok) {
              const cgData = await cgResponse.json();
              wethPrice = cgData.ethereum?.usd || 3400;
            }
          } catch {
            // Using fallback WETH price
          }
        }

        // Fetch Metro and Shadow from CoinGecko only every 120 seconds
        setPrices(prev => {
          let metroPrice = prev.metro;
          let shadowPrice = prev.shadow;
          
          return {
            sonic: sonicPrice,
            metro: metroPrice,
            shadow: shadowPrice,
            xShadow: shadowPrice,
            usdc: 1,
            weth: wethPrice,
          };
        });

        setError(null);
        setIsLoading(false);
      } catch (err) {
        // Using fallback token prices due to API error
        setError(null);
        setIsLoading(false);
      }
    };

    const fetchMetroShadow = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=metropolis,shadow-2&vs_currencies=usd'
        );
        if (response.ok) {
          const data = await response.json();
          
          const metroPrice = data.metropolis?.usd || 0;
          const shadowPrice = data['shadow-2']?.usd || 0;
          
          setPrices(prev => ({
            ...prev,
            metro: metroPrice,
            shadow: shadowPrice,
            xShadow: shadowPrice,
          }));
          setLastUpdated(Date.now());
        }
      } catch (error) {
        // Failed to fetch Metro/Shadow prices - using cached values
      }
    };

    // Fetch immediately on mount
    fetchPrices();
    fetchMetroShadow();

    // Fetch S/WETH every 60 seconds
    const priceInterval = setInterval(fetchPrices, 120 * 1000);
    
    // Fetch Metro/Shadow every 120 seconds
    const metroShadowInterval = setInterval(fetchMetroShadow, 120 * 1000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(metroShadowInterval);
    };
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
    if (coingeckoId === 'sonic-3') return prices.sonic;
    if (coingeckoId === 'metropolis') return prices.metro;
    if (coingeckoId === 'shadow-2') return prices.shadow;
    if (coingeckoId === 'usd-coin') return prices.usdc;
    if (coingeckoId === 'ethereum') return prices.weth;
  }

  return 0;
}
