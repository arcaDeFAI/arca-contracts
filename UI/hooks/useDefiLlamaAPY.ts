'use client';

import { useState, useEffect } from 'react';

// Pool ID mapping for Shadow vaults
export const SHADOW_POOL_IDS = {
  'WS-USDC': 'bfb130df-7dd3-4f19-a54c-305c8cb6c9f0',
  'WS-WETH': 'e50ce450-d2b8-45fe-b496-9ee1fb5673c2',
  'USDC-WETH': 'a5ea7bec-91e2-4743-964d-35ea9034b0bd',
} as const;

interface DefiLlamaPoolData {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number;
  apy: number;
  apyMean30d?: number;
  rewardTokens: string[];
  pool: string;
  underlyingTokens?: string[];
  poolMeta?: string;
}

interface CachedAPYData {
  data: Map<string, DefiLlamaPoolData>;
  lastFetch: number;
}

const CACHE_KEY = 'defi_llama_apy_cache';
const FETCH_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds

/**
 * Hook to fetch APY data from DeFi Llama API for Shadow pools
 * Fetches all pools every 2 minutes and caches the results
 */
export function useDefiLlamaAPY() {
  const [poolData, setPoolData] = useState<Map<string, DefiLlamaPoolData>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAPYData = async () => {
      try {
        // Check cache first
        const now = Date.now();
        const cached = localStorage.getItem(CACHE_KEY);
        
        if (cached) {
          try {
            const cachedData: CachedAPYData = JSON.parse(cached);
            // If cache is less than 2 minutes old, use it
            if (now - cachedData.lastFetch < FETCH_INTERVAL) {
              if (isMounted) {
                setPoolData(new Map(Object.entries(cachedData.data)));
                setIsLoading(false);
              }
              return;
            }
          } catch (err) {
            // Cache parsing failed, fetch fresh data
          }
        }

        // Fetch fresh data from DeFi Llama
        const response = await fetch('https://yields.llama.fi/pools');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch APY data: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.data || !Array.isArray(result.data)) {
          throw new Error('Invalid response format from DeFi Llama API');
        }

        // Filter for Shadow Exchange CLMM pools on Sonic chain
        const shadowPools = result.data.filter((pool: DefiLlamaPoolData) => 
          pool.chain === 'Sonic' && 
          pool.project === 'shadow-exchange-clmm'
        );

        // Create a map of pool ID to pool data
        const poolMap = new Map<string, DefiLlamaPoolData>();
        shadowPools.forEach((pool: DefiLlamaPoolData) => {
          poolMap.set(pool.pool, pool);
        });

        if (isMounted) {
          setPoolData(poolMap);
          setIsLoading(false);
          setError(null);

          // Cache the data
          try {
            const cacheData: CachedAPYData = {
              data: Object.fromEntries(poolMap) as any,
              lastFetch: now,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
          } catch (err) {
            // Cache storage failed, continue without caching
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch APY data');
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchAPYData();

    // Set up interval to fetch every 2 minutes
    const interval = setInterval(fetchAPYData, FETCH_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  /**
   * Get APY data for a specific pool by pool ID
   */
  const getPoolAPY = (poolId: string): DefiLlamaPoolData | null => {
    return poolData.get(poolId) || null;
  };

  /**
   * Get APY data by pool symbol (e.g., 'WS-USDC')
   */
  const getAPYBySymbol = (symbol: keyof typeof SHADOW_POOL_IDS): DefiLlamaPoolData | null => {
    const poolId = SHADOW_POOL_IDS[symbol];
    return poolId ? getPoolAPY(poolId) : null;
  };

  return {
    poolData,
    isLoading,
    error,
    getPoolAPY,
    getAPYBySymbol,
  };
}

/**
 * Utility function to clear DeFi Llama APY cache
 */
export function clearDefiLlamaCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    // Failed to clear cache
  }
}
