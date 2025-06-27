import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAccount } from "wagmi";

export interface TokenPrices {
  [tokenSymbol: string]: number; // Dynamic token prices in USD
  lastUpdated: number;
}

export interface TokenPricesHook {
  prices: TokenPrices | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// 🚨 WARNING: ALL PRICES ARE FAKE - DO NOT USE IN PRODUCTION 🚨
// This shows FAKE prices to users and MUST be replaced before launch
// Users will see wrong portfolio values and make decisions on false data
// TODO: Replace with real CoinGecko/DEX price feeds
const MOCK_TOKEN_PRICES: Record<string, number> = {
  ws: 0.85, // ❌ FAKE price for wrapped Sonic
  "usdc.e": 1.0, // ❌ FAKE price (should be real peg check)
  usdc: 1.0, // ❌ FAKE price (should be real peg check)
  metro: 2.5, // ❌ FAKE price for METRO token
  // Add more tokens as needed
};

// Price cache to avoid excessive API calls
let priceCache: TokenPrices | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// For testing: clear cache function
export function clearCache() {
  priceCache = null;
  lastFetchTime = 0;
}

export function useTokenPrices(tokenSymbols: string[] = []): TokenPricesHook {
  const { chainId } = useAccount();
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to store current tokens and avoid dependency cycles
  const tokensRef = useRef<string>("");
  const currentTokens = tokenSymbols.sort().join(",");

  // Only update ref when tokens actually change
  if (tokensRef.current !== currentTokens) {
    tokensRef.current = currentTokens;
  }

  const fetchPrices = useCallback(async () => {
    const tokens = tokensRef.current;

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

        // Build price object for requested tokens
        const tokenPrices: TokenPrices = {
          lastUpdated: now,
        };

        // Add prices for requested tokens (case-insensitive)
        const requestedTokens = tokens ? tokens.split(",") : [];

        requestedTokens.forEach((symbol) => {
          const normalizedSymbol = symbol.toLowerCase();
          if (MOCK_TOKEN_PRICES[normalizedSymbol] !== undefined) {
            tokenPrices[normalizedSymbol] = MOCK_TOKEN_PRICES[normalizedSymbol];
          }
        });

        priceCache = tokenPrices;
        lastFetchTime = now;
        setPrices(tokenPrices);
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
  }, [chainId, fetchPrices, currentTokens]); // Depend on currentTokens string value

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
  tokenSymbol: string,
  prices: TokenPrices | null,
): number {
  if (!prices || !tokenAmount) return 0;

  const amount = parseFloat(tokenAmount);
  if (isNaN(amount)) return 0;

  // Look up price using case-insensitive token symbol
  const normalizedSymbol = tokenSymbol.toLowerCase();
  const price = prices[normalizedSymbol] || 0;
  return amount * price;
}

// Utility function to format price display
export function formatTokenPrice(
  tokenSymbol: string,
  prices: TokenPrices | null,
): string {
  if (!prices) return "$0.00";

  // Look up price using case-insensitive token symbol
  const normalizedSymbol = tokenSymbol.toLowerCase();
  const price = prices[normalizedSymbol] || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(price);
}
