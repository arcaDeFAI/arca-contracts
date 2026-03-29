'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { TOKEN_REGISTRY, getToken, type PriceSource } from '@/lib/tokenRegistry';

export interface TokenPrices {
  sonic: number;
  metro: number;
  shadow: number;
  xShadow: number;
  usdc: number;
  ussd: number;
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

// Build initial/fallback prices from the registry
function buildFallbackPrices(): TokenPrices {
  const base: TokenPrices = {
    sonic: 0, metro: 0, shadow: 0, xShadow: 0, usdc: 1, ussd: 1, weth: 0,
  };
  // Fill from registry (keyed by lowercase canonical name)
  for (const def of Object.values(TOKEN_REGISTRY)) {
    const key = def.canonicalName.toLowerCase();
    if (base[key] === undefined || def.fallbackPrice > base[key]) {
      base[key] = def.fallbackPrice;
    }
  }
  // xShadow mirrors shadow
  base.xShadow = base.shadow;
  return base;
}

// Derive CoinGecko IDs from registry (for address-based lookups)
function buildCoingeckoMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of Object.values(TOKEN_REGISTRY)) {
    if (def.coingeckoId) {
      map[def.symbol.toLowerCase()] = def.coingeckoId;
      if (def.address) {
        map[def.address.toLowerCase()] = def.coingeckoId;
      }
    }
  }
  return map;
}

const TOKEN_COINGECKO_IDS = buildCoingeckoMap();

export function PriceProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<TokenPrices>(buildFallbackPrices);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoading(true);

        // --- Group tokens by price source type from the registry ---

        const diaTokens: Array<{ key: string; chain: string; address: string }> = [];
        const coingeckoIds = new Set<string>();
        const fixedPrices: Record<string, number> = {};

        // Deduplicate by canonical name
        const seen = new Set<string>();
        for (const def of Object.values(TOKEN_REGISTRY)) {
          const canonical = def.canonicalName;
          if (seen.has(canonical)) continue;
          seen.add(canonical);

          const key = canonical.toLowerCase();
          const src = def.priceSource;

          if (src.type === 'dia') {
            diaTokens.push({ key, chain: src.chain, address: src.address });
          } else if (src.type === 'coingecko') {
            coingeckoIds.add(src.id);
          } else if (src.type === 'fixed') {
            fixedPrices[key] = src.price;
          }
        }

        // --- Fetch DIA prices ---
        const diaResults: Record<string, number> = {};
        await Promise.all(
          diaTokens.map(async ({ key, chain, address }) => {
            try {
              const res = await fetch(
                `https://api.diadata.org/v1/assetQuotation/${chain}/${address}`,
              );
              if (res.ok) {
                const data = await res.json();
                if (data.Price) diaResults[key] = data.Price;
              }
            } catch {
              // Fallback handled below
            }
          }),
        );

        // --- Fetch CoinGecko prices ---
        const cgResults: Record<string, number> = {};
        if (coingeckoIds.size > 0) {
          try {
            const ids = Array.from(coingeckoIds).join(',');
            const res = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
            );
            if (res.ok) {
              const data = await res.json();
              // Map CoinGecko IDs back to canonical keys
              for (const def of Object.values(TOKEN_REGISTRY)) {
                if (def.priceSource.type === 'coingecko') {
                  const cgId = def.priceSource.id;
                  const price = data[cgId]?.usd;
                  if (price !== undefined) {
                    cgResults[def.canonicalName.toLowerCase()] = price;
                  }
                }
              }
            }
          } catch {
            // Using cached / fallback prices
          }
        }

        // --- Also try CoinGecko as DIA fallback ---
        for (const { key } of diaTokens) {
          if (diaResults[key]) continue; // DIA succeeded
          // Find a CoinGecko ID for this token
          const def = Object.values(TOKEN_REGISTRY).find(
            (t) => t.canonicalName.toLowerCase() === key && t.coingeckoId,
          );
          if (def?.coingeckoId) {
            try {
              const res = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${def.coingeckoId}&vs_currencies=usd`,
              );
              if (res.ok) {
                const data = await res.json();
                const price = data[def.coingeckoId]?.usd;
                if (price !== undefined) diaResults[key] = price;
              }
            } catch {
              // Using fallback
            }
          }
        }

        // --- Merge everything into prices ---
        const fallback = buildFallbackPrices();
        const merged: TokenPrices = { ...fallback };

        // Apply fixed prices
        for (const [key, price] of Object.entries(fixedPrices)) {
          merged[key] = price;
        }

        // Apply DIA prices
        for (const [key, price] of Object.entries(diaResults)) {
          merged[key] = price;
        }

        // Apply CoinGecko prices
        for (const [key, price] of Object.entries(cgResults)) {
          merged[key] = price;
        }

        // Mirror xShadow = shadow
        merged.xShadow = merged.shadow;

        setPrices(merged);
        setError(null);
        setIsLoading(false);
        setLastUpdated(Date.now());
      } catch (err) {
        setError(null);
        setIsLoading(false);
      }
    };

    // Fetch immediately on mount
    fetchPrices();

    // Refresh every 120 seconds
    const interval = setInterval(fetchPrices, 120 * 1000);
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
    const def = Object.values(TOKEN_REGISTRY).find(
      (t) => t.coingeckoId === coingeckoId,
    );
    if (def) {
      const key = def.canonicalName.toLowerCase();
      if (prices[key] !== undefined) return prices[key];
    }
  }

  // Try registry lookup
  const tokenDef = getToken(tokenIdentifier);
  if (tokenDef) {
    const key = tokenDef.canonicalName.toLowerCase();
    if (prices[key] !== undefined) return prices[key];
    return tokenDef.fallbackPrice;
  }

  return 0;
}
