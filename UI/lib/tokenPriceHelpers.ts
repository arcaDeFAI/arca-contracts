890/** Accepts any object whose values are numbers (TokenPrices or a plain record). */
type PriceMap = Record<string, number>;
import { getToken } from './tokenRegistry';

/**
 * Get token price from TokenPrices object.
 *
 * Handles token symbol aliases (S/WS/SONIC, ETH/WETH, xSHADOW/SHADOW) and provides
 * fallback prices when API data is unavailable.
 *
 * @example
 * ```typescript
 * getTokenPrice('S', prices)    // Returns prices.sonic
 * getTokenPrice('weth', prices) // Returns prices.weth
 * getTokenPrice('USDC', prices) // Returns prices.usdc (always 1.0)
 * getTokenPrice('USSD', prices) // Returns prices.ussd (1.0 stablecoin)
 * ```
 */
export function getTokenPrice(
  token: string,
  prices: PriceMap | undefined | null,
  sonicPrice?: number,
): number {
  const def = getToken(token);

  // Unknown token
  if (!def) {
    console.warn(`Unknown token symbol: ${token}`);
    return 0;
  }

  // Special case: use sonicPrice parameter if provided (backwards compatibility)
  if (def.canonicalName === 'SONIC' && sonicPrice !== undefined) {
    return sonicPrice;
  }

  // Derive price key from canonical name (e.g. 'SONIC' → 'sonic')
  const priceKey = def.canonicalName.toLowerCase();

  // Look up in prices object
  if (prices && prices[priceKey] !== undefined && prices[priceKey] !== null) {
    return prices[priceKey];
  }

  // Return fallback price from registry
  return def.fallbackPrice;
}

/**
 * Calculate USD value for a token amount.
 */
export function calculateTokenValueUSD(
  tokenAmount: number,
  token: string,
  prices: PriceMap | undefined | null,
  sonicPrice?: number,
): number {
  const price = getTokenPrice(token, prices, sonicPrice);
  return tokenAmount * price;
}

/**
 * Get prices for multiple tokens at once.
 */
export function getBulkTokenPrices(
  tokens: string[],
  prices: PriceMap | undefined | null,
  sonicPrice?: number,
): Record<string, number> {
  return tokens.reduce(
    (acc, token) => {
      acc[token] = getTokenPrice(token, prices, sonicPrice);
      return acc;
    },
    {} as Record<string, number>,
  );
}

/**
 * Check if a token is supported (exists in the registry).
 */
export function isSupportedToken(token: string): boolean {
  return !!getToken(token);
}

/**
 * Get canonical token name for a symbol.
 * Useful for deduplication in UI (e.g. S → 'SONIC', xSHADOW → 'SHADOW').
 */
export function getCanonicalTokenName(token: string): string | undefined {
  return getToken(token)?.canonicalName;
}
