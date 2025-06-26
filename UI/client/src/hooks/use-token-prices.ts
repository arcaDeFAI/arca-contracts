import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

export interface TokenPrices {
  wS: number; // Price in USD
  usdce: number; // Price in USD (should be ~1.0 for USDC.e)
  lastUpdated: number;
}

export interface TokenPricesHook {
  prices: TokenPrices | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Mock token price data for development
// In production, this would connect to a price oracle or API
const MOCK_PRICES: TokenPrices = {
  wS: 0.85, // Mock price for wrapped Sonic
  usdce: 1.0, // USDC.e should be pegged to ~$1
  lastUpdated: Date.now(),
};

// Price cache to avoid excessive API calls
let priceCache: TokenPrices | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export function useTokenPrices(): TokenPricesHook {
  const { chainId } = useAccount();
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    // Check cache first
    const now = Date.now();
    if (priceCache && now - lastFetchTime < CACHE_DURATION) {
      setPrices(priceCache);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // For development/testing: use mock prices
      // TODO: Replace with real price API when available
      if (chainId === 31337 || chainId === 146) {
        // Simulate API delay
        await new Promise<void>((resolve) => setTimeout(resolve, 500));

        const newPrices = {
          ...MOCK_PRICES,
          lastUpdated: now,
        };

        priceCache = newPrices;
        lastFetchTime = now;
        setPrices(newPrices);
      } else {
        throw new Error("Unsupported network for price fetching");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch token prices";
      setError(errorMessage);
      // eslint-disable-next-line no-console
      console.error("Token price fetch error:", err);

      // Fallback to cached prices if available
      if (priceCache) {
        setPrices(priceCache);
      }
    } finally {
      setIsLoading(false);
    }
  }, [chainId]);

  const refetch = useCallback(() => {
    // Clear cache to force fresh fetch
    priceCache = null;
    lastFetchTime = 0;
    void fetchPrices();
  }, [fetchPrices]);

  // Initial fetch
  useEffect(() => {
    if (chainId) {
      void fetchPrices();
    }
  }, [chainId, fetchPrices]);

  // Set up periodic price updates
  useEffect(() => {
    if (!chainId) return;

    const interval = setInterval(() => {
      void fetchPrices();
    }, CACHE_DURATION);

    return () => clearInterval(interval);
  }, [chainId, fetchPrices]);

  return {
    prices,
    isLoading,
    error,
    refetch,
  };
}

// Utility function to get USD value of token amount
export function getTokenUSDValue(
  tokenAmount: string,
  tokenType: "wS" | "usdce",
  prices: TokenPrices | null,
): number {
  if (!prices || !tokenAmount) return 0;

  const amount = parseFloat(tokenAmount);
  if (isNaN(amount)) return 0;

  const price = tokenType === "wS" ? prices.wS : prices.usdce;
  return amount * price;
}

// Utility function to format price display
export function formatTokenPrice(
  tokenType: "wS" | "usdce",
  prices: TokenPrices | null,
): string {
  if (!prices) return "$0.00";

  const price = tokenType === "wS" ? prices.wS : prices.usdce;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price);
}
