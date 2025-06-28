/**
 * Real Token Prices Hook
 *
 * React hook to fetch real token prices from CoinGecko API.
 * Replaces the hardcoded mock prices with live market data.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { priceFeedService, type TokenPrice } from "../services/price-feed";

export interface UseRealTokenPricesResult {
  prices: Record<string, number>;
  priceDetails: Record<string, TokenPrice>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  isStale: boolean;
}

export interface UseRealTokenPricesOptions {
  tokens?: string[];
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

/**
 * Default tokens to fetch prices for
 */
const DEFAULT_TOKENS = ["wS", "USDC.e", "USDC", "METRO"];

/**
 * Hook to fetch real token prices
 */
export function useRealTokenPrices(
  options: UseRealTokenPricesOptions = {},
): UseRealTokenPricesResult {
  const {
    tokens = DEFAULT_TOKENS,
    refreshInterval = 30000, // 30 seconds
    enabled = true,
  } = options;

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceDetails, setPriceDetails] = useState<Record<string, TokenPrice>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  /**
   * Fetch prices from the price feed service
   */
  const fetchPrices = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const tokenPrices = await priceFeedService.getMultipleTokenPrices(tokens);

      // Convert to simple price mapping
      const simplePrices: Record<string, number> = {};
      for (const [symbol, priceData] of Object.entries(tokenPrices)) {
        simplePrices[symbol] = priceData.price;
      }

      setPrices(simplePrices);
      setPriceDetails(tokenPrices);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch token prices";
      setError(errorMessage);
      console.error("Error fetching token prices:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tokens, enabled]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    // Clear cache to force fresh fetch
    priceFeedService.clearCache();
    await fetchPrices();
  }, [tokens, enabled]); // Remove circular dependency by using same deps as fetchPrices

  /**
   * Check if prices are stale (older than refresh interval)
   */
  const isStale = lastUpdated
    ? Date.now() - lastUpdated > refreshInterval
    : true;

  // Initial fetch on mount
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Set up automatic refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchPrices();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts/intervals
    };
  }, []);

  return {
    prices,
    priceDetails,
    isLoading,
    error,
    lastUpdated,
    refresh,
    isStale,
  };
}

/**
 * Hook to get a single token price
 */
export function useRealTokenPrice(
  symbol: string,
  options: Omit<UseRealTokenPricesOptions, "tokens"> = {},
) {
  // Memoize tokens array to prevent infinite re-renders
  const tokens = useMemo(() => [symbol], [symbol]);
  const result = useRealTokenPrices({ ...options, tokens });

  return {
    price: result.prices[symbol.toLowerCase()] || null,
    priceDetail: result.priceDetails[symbol.toLowerCase()] || null,
    isLoading: result.isLoading,
    error: result.error,
    lastUpdated: result.lastUpdated,
    refresh: result.refresh,
    isStale: result.isStale,
  };
}

/**
 * Utility function to format price with appropriate decimals
 */
export function formatTokenPrice(price: number, symbol: string): string {
  // Stablecoins show more precision
  if (symbol.toLowerCase().includes("usdc")) {
    return price.toFixed(4);
  }

  // Other tokens show 2-3 decimals based on price
  if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(3);
  } else {
    return price.toFixed(6);
  }
}

/**
 * Hook for price change tracking (future enhancement)
 */
export function usePriceChangeTracking(symbol: string) {
  // TODO: Implement price change tracking over time
  // This would store historical prices and calculate 24h change, etc.

  return {
    priceChange24h: null,
    priceChangePercent24h: null,
    isIncreasing: null,
  };
}
