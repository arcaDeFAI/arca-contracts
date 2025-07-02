/**
 * Hybrid Token Prices Hook
 *
 * Provides a migration path from fake to real token prices.
 * Can switch between mock prices and real API prices based on configuration.
 */

import {
  useRealTokenPrices,
  useRealTokenPrice,
  type UseRealTokenPricesOptions,
} from "./use-real-token-prices";
import { DEMO_MODE } from "../config/demo-mode";

// Import the current mock prices from the existing hook
const MOCK_TOKEN_PRICES: Record<string, number> = {
  ws: 0.85, // Mock price for wrapped Sonic
  "usdc.e": 1.0, // USDC.e should be pegged to ~$1
  usdc: 1.0, // USDC should be pegged to ~$1
  metro: 2.5, // Mock price for METRO token
};

export interface UseHybridTokenPricesResult {
  prices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  isUsingRealPrices: boolean;
  lastUpdated: number | null;
  refresh?: () => Promise<void>;
  dataSource: "mock" | "real" | "fallback";
}

/**
 * Hook that switches between mock and real prices based on configuration
 */
export function useHybridTokenPrices(
  options: UseRealTokenPricesOptions = {},
): UseHybridTokenPricesResult {
  const shouldUseRealPrices = !DEMO_MODE.useFakeData;

  // Get real prices (only enabled if we should use real prices)
  const realPricesResult = useRealTokenPrices({
    ...options,
    enabled: shouldUseRealPrices,
  });

  // If we should use real prices, return real data
  if (shouldUseRealPrices) {
    // Check if real prices are available
    const hasRealPrices = Object.keys(realPricesResult.prices).length > 0;

    if (hasRealPrices || realPricesResult.isLoading) {
      return {
        prices: realPricesResult.prices,
        isLoading: realPricesResult.isLoading,
        error: realPricesResult.error,
        isUsingRealPrices: true,
        lastUpdated: realPricesResult.lastUpdated,
        refresh: realPricesResult.refresh,
        dataSource: realPricesResult.error ? "fallback" : "real",
      };
    }

    // Fallback to mock prices if real prices failed
    return {
      prices: MOCK_TOKEN_PRICES,
      isLoading: false,
      error: realPricesResult.error,
      isUsingRealPrices: false,
      lastUpdated: null,
      dataSource: "fallback",
    };
  }

  // Use mock prices
  return {
    prices: MOCK_TOKEN_PRICES,
    isLoading: false,
    error: null,
    isUsingRealPrices: false,
    lastUpdated: null,
    dataSource: "mock",
  };
}

/**
 * Hook for a single token price with hybrid mode
 */
export function useHybridTokenPrice(
  symbol: string,
  options: Omit<UseRealTokenPricesOptions, "tokens"> = {},
) {
  const shouldUseRealPrices = !DEMO_MODE.useFakeData;

  // Get real price (only enabled if we should use real prices)
  const realPriceResult = useRealTokenPrice(symbol, {
    ...options,
    enabled: shouldUseRealPrices,
  });

  // If we should use real prices, return real data
  if (shouldUseRealPrices) {
    const hasRealPrice = realPriceResult.price !== null;

    if (hasRealPrice || realPriceResult.isLoading) {
      return {
        price: realPriceResult.price,
        isLoading: realPriceResult.isLoading,
        error: realPriceResult.error,
        isUsingRealPrices: true,
        lastUpdated: realPriceResult.lastUpdated,
        refresh: realPriceResult.refresh,
        dataSource: realPriceResult.error ? "fallback" : ("real" as const),
      };
    }

    // Fallback to mock price if real price failed
    const mockPrice = MOCK_TOKEN_PRICES[symbol.toLowerCase()];
    return {
      price: mockPrice || null,
      isLoading: false,
      error: realPriceResult.error,
      isUsingRealPrices: false,
      lastUpdated: null,
      dataSource: "fallback" as const,
    };
  }

  // Use mock price
  const mockPrice = MOCK_TOKEN_PRICES[symbol.toLowerCase()];
  return {
    price: mockPrice || null,
    isLoading: false,
    error: null,
    isUsingRealPrices: false,
    lastUpdated: null,
    dataSource: "mock" as const,
  };
}

/**
 * Get token price with environment-aware source
 * This is the main function that components should use for token prices
 */
export function getTokenPrice(
  symbol: string,
  prices: Record<string, number>,
): number {
  const normalizedSymbol = symbol.toLowerCase();
  return prices[normalizedSymbol] || MOCK_TOKEN_PRICES[normalizedSymbol] || 0;
}

/**
 * Utility to check if we're currently using real prices
 */
export function isUsingRealPrices(): boolean {
  return !DEMO_MODE.useFakeData;
}

/**
 * Get price source information for debugging
 */
export function getPriceSourceInfo() {
  return {
    demoMode: DEMO_MODE.enabled,
    useFakeData: DEMO_MODE.useFakeData,
    shouldUseRealPrices: !DEMO_MODE.useFakeData,
    environment: import.meta.env.MODE,
  };
}
