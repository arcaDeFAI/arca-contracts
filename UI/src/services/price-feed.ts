/**
 * Real Price Feed Service
 *
 * Fetches real token prices from CoinGecko API to replace hardcoded mock prices.
 * Includes caching, error handling, and fallback mechanisms.
 */

export interface TokenPrice {
  symbol: string;
  price: number;
  lastUpdated: number;
  source: "coingecko" | "fallback" | "cache";
}

export interface PriceFeedError {
  message: string;
  code: "NETWORK_ERROR" | "API_ERROR" | "INVALID_RESPONSE" | "RATE_LIMIT";
  retryAfter?: number;
}

export interface PriceFeedConfig {
  apiKey?: string;
  baseUrl?: string;
  cacheTimeout?: number; // milliseconds
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Token ID mapping for CoinGecko API
 */
const TOKEN_ID_MAP = {
  ws: "sonic", // Wrapped Sonic - using 'sonic' as CoinGecko ID
  "usdc.e": "usd-coin", // USDC.e - bridged USDC
  usdc: "usd-coin", // Native USDC
  metro: "metro-token", // METRO token - may need adjustment based on actual CoinGecko listing
} as const;

/**
 * Fallback prices in case API fails (based on recent market values)
 */
const FALLBACK_PRICES = {
  ws: 0.9, // Conservative estimate for Sonic
  "usdc.e": 1.0, // Stablecoin should be ~$1
  usdc: 1.0, // Stablecoin should be ~$1
  metro: 2.5, // METRO - keep current estimate until we have real data
} as const;

class PriceFeedService {
  private cache = new Map<string, TokenPrice>();
  private config: Required<PriceFeedConfig>;
  private isRateLimited = false;
  private rateLimitUntil = 0;

  constructor(config: PriceFeedConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.REACT_APP_COINGECKO_API_KEY || "",
      baseUrl: config.baseUrl || "https://api.coingecko.com/api/v3",
      cacheTimeout: config.cacheTimeout || 30000, // 30 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  /**
   * Get token price with caching and fallbacks
   */
  async getTokenPrice(symbol: string): Promise<TokenPrice> {
    const normalizedSymbol = symbol.toLowerCase();

    // Check cache first
    const cached = this.getCachedPrice(normalizedSymbol);
    if (cached && !this.isCacheStale(cached)) {
      return cached;
    }

    // Check rate limiting
    if (this.isRateLimited && Date.now() < this.rateLimitUntil) {
      return this.getFallbackPrice(normalizedSymbol, "Rate limited");
    }

    try {
      const price = await this.fetchFromAPI(normalizedSymbol);
      this.cachePrice(normalizedSymbol, price);
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}:`, error);
      return this.getFallbackPrice(
        normalizedSymbol,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Get multiple token prices in a single API call
   */
  async getMultipleTokenPrices(
    symbols: string[],
  ): Promise<Record<string, TokenPrice>> {
    const normalizedSymbols = symbols.map((s) => s.toLowerCase());
    const result: Record<string, TokenPrice> = {};

    // Check which prices we have in cache
    const needsFetch: string[] = [];
    for (const symbol of normalizedSymbols) {
      const cached = this.getCachedPrice(symbol);
      if (cached && !this.isCacheStale(cached)) {
        result[symbol] = cached;
      } else {
        needsFetch.push(symbol);
      }
    }

    // If all prices are cached, return them
    if (needsFetch.length === 0) {
      return result;
    }

    // Check rate limiting
    if (this.isRateLimited && Date.now() < this.rateLimitUntil) {
      for (const symbol of needsFetch) {
        result[symbol] = this.getFallbackPrice(symbol, "Rate limited");
      }
      return result;
    }

    try {
      const fetchedPrices = await this.fetchMultipleFromAPI(needsFetch);

      // Cache all fetched prices
      for (const [symbol, price] of Object.entries(fetchedPrices)) {
        this.cachePrice(symbol, price);
        result[symbol] = price;
      }

      return result;
    } catch (error) {
      console.warn(`Failed to fetch multiple prices:`, error);

      // Return fallback prices for failed fetches
      for (const symbol of needsFetch) {
        result[symbol] = this.getFallbackPrice(
          symbol,
          error instanceof Error ? error.message : "Unknown error",
        );
      }

      return result;
    }
  }

  /**
   * Fetch single token price from CoinGecko API
   */
  private async fetchFromAPI(symbol: string): Promise<TokenPrice> {
    const tokenId = TOKEN_ID_MAP[symbol as keyof typeof TOKEN_ID_MAP];
    if (!tokenId) {
      throw new Error(`Unknown token symbol: ${symbol}`);
    }

    const url = this.buildAPIUrl(`simple/price`, {
      ids: tokenId,
      vs_currencies: "usd",
      include_last_updated_at: "true",
    });

    const response = await this.makeAPIRequest(url);
    const data = response[tokenId];

    if (!data || typeof data.usd !== "number") {
      throw new Error(`Invalid price data for ${symbol}`);
    }

    return {
      symbol,
      price: data.usd,
      lastUpdated: data.last_updated_at
        ? data.last_updated_at * 1000
        : Date.now(),
      source: "coingecko",
    };
  }

  /**
   * Fetch multiple token prices from CoinGecko API
   */
  private async fetchMultipleFromAPI(
    symbols: string[],
  ): Promise<Record<string, TokenPrice>> {
    const tokenIds = symbols
      .map((symbol) => TOKEN_ID_MAP[symbol as keyof typeof TOKEN_ID_MAP])
      .filter(Boolean);

    if (tokenIds.length === 0) {
      throw new Error("No valid token IDs found");
    }

    const url = this.buildAPIUrl(`simple/price`, {
      ids: tokenIds.join(","),
      vs_currencies: "usd",
      include_last_updated_at: "true",
    });

    const response = await this.makeAPIRequest(url);
    const result: Record<string, TokenPrice> = {};

    // Map response back to symbols
    for (const symbol of symbols) {
      const tokenId = TOKEN_ID_MAP[symbol as keyof typeof TOKEN_ID_MAP];
      const data = response[tokenId];

      if (data && typeof data.usd === "number") {
        result[symbol] = {
          symbol,
          price: data.usd,
          lastUpdated: data.last_updated_at
            ? data.last_updated_at * 1000
            : Date.now(),
          source: "coingecko",
        };
      }
    }

    return result;
  }

  /**
   * Make API request with retry logic and rate limit handling
   */
  private async makeAPIRequest(url: string, attempt = 1): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: this.config.apiKey
          ? {
              "X-CG-Pro-API-Key": this.config.apiKey,
            }
          : {},
      });

      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get("Retry-After");
        const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;

        this.isRateLimited = true;
        this.rateLimitUntil = Date.now() + retryDelay;

        throw new Error(`Rate limited. Retry after ${retryDelay}ms`);
      }

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Reset rate limiting on successful request
      this.isRateLimited = false;
      this.rateLimitUntil = 0;

      return data;
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        await this.delay(this.config.retryDelay * attempt);
        return this.makeAPIRequest(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Build API URL with parameters
   */
  private buildAPIUrl(
    endpoint: string,
    params: Record<string, string>,
  ): string {
    const url = new URL(`${this.config.baseUrl}/${endpoint}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * Get cached price if available
   */
  private getCachedPrice(symbol: string): TokenPrice | null {
    return this.cache.get(symbol) || null;
  }

  /**
   * Check if cached price is stale
   */
  private isCacheStale(price: TokenPrice): boolean {
    return Date.now() - price.lastUpdated > this.config.cacheTimeout;
  }

  /**
   * Cache price data
   */
  private cachePrice(symbol: string, price: TokenPrice): void {
    this.cache.set(symbol, price);
  }

  /**
   * Get fallback price when API fails
   */
  private getFallbackPrice(symbol: string, reason: string): TokenPrice {
    const fallbackPrice =
      FALLBACK_PRICES[symbol as keyof typeof FALLBACK_PRICES];

    if (!fallbackPrice) {
      throw new Error(
        `No fallback price available for ${symbol}. Reason: ${reason}`,
      );
    }

    return {
      symbol,
      price: fallbackPrice,
      lastUpdated: Date.now(),
      source: "fallback",
    };
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): {
    size: number;
    entries: Array<{ symbol: string; age: number; source: string }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([symbol, price]) => ({
      symbol,
      age: Date.now() - price.lastUpdated,
      source: price.source,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Export singleton instance
export const priceFeedService = new PriceFeedService();

// Export for testing
export { PriceFeedService };
