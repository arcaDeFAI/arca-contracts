import { type TokenPrices } from '@/contexts/PriceContext';

/**
 * Token symbol normalization map
 * Maps all aliases to canonical token names
 */
const TOKEN_SYMBOL_MAP: Record<string, string> = {
  // Sonic aliases
  'S': 'SONIC',
  'WS': 'SONIC',
  'SONIC': 'SONIC',

  // USDC
  'USDC': 'USDC',

  // WETH/ETH aliases
  'WETH': 'WETH',
  'ETH': 'WETH',

  // Protocol tokens
  'METRO': 'METRO',
  'SHADOW': 'SHADOW',
  'XSHADOW': 'SHADOW',
} as const;

/**
 * Maps canonical token names to TokenPrices keys
 */
const TOKEN_TO_PRICE_KEY: Record<string, keyof TokenPrices> = {
  'SONIC': 'sonic',
  'USDC': 'usdc',
  'WETH': 'weth',
  'METRO': 'metro',
  'SHADOW': 'shadow',
} as const;

/**
 * Fallback prices for when API data is unavailable
 * Matches PriceContext default values
 */
const FALLBACK_PRICES: Record<string, number> = {
  'SONIC': 0.17,
  'USDC': 1.0,
  'WETH': 3400,
  'METRO': 0,
  'SHADOW': 0,
} as const;

/**
 * Get token price from TokenPrices object
 *
 * Handles token symbol aliases (S/WS/SONIC, ETH/WETH, xSHADOW/SHADOW) and provides
 * fallback prices when API data is unavailable.
 *
 * @param token - Token symbol (case-insensitive, supports aliases)
 * @param prices - TokenPrices object from PriceContext
 * @param sonicPrice - Optional override for Sonic price (backwards compatibility)
 * @returns Token price in USD, or fallback price if unavailable
 *
 * @example
 * ```typescript
 * getTokenPrice('S', prices) // Returns prices.sonic
 * getTokenPrice('weth', prices) // Returns prices.weth
 * getTokenPrice('eth', prices) // Returns prices.weth (alias)
 * getTokenPrice('USDC', prices) // Returns prices.usdc (always 1.0)
 * getTokenPrice('unknown', prices) // Returns 0 (unknown token)
 * ```
 */
export function getTokenPrice(
  token: string,
  prices: TokenPrices | undefined | null,
  sonicPrice?: number
): number {
  // Normalize token symbol to uppercase
  const normalizedToken = token.toUpperCase();

  // Map to canonical token name
  const canonicalToken = TOKEN_SYMBOL_MAP[normalizedToken];

  // Unknown token
  if (!canonicalToken) {
    console.warn(`Unknown token symbol: ${token}`);
    return 0;
  }

  // Special case: Use sonicPrice parameter if provided (backwards compatibility)
  if (canonicalToken === 'SONIC' && sonicPrice !== undefined) {
    return sonicPrice;
  }

  // Get price key
  const priceKey = TOKEN_TO_PRICE_KEY[canonicalToken];

  // Get price from prices object, with fallback
  if (prices && prices[priceKey] !== undefined && prices[priceKey] !== null) {
    return prices[priceKey];
  }

  // Return fallback price
  return FALLBACK_PRICES[canonicalToken] || 0;
}

/**
 * Calculate USD value for a token amount
 *
 * @param tokenAmount - Token amount (numeric, already formatted with decimals)
 * @param token - Token symbol
 * @param prices - TokenPrices object
 * @param sonicPrice - Optional Sonic price override
 * @returns USD value
 *
 * @example
 * ```typescript
 * calculateTokenValueUSD(100, 'S', prices) // 100 * sonic_price
 * calculateTokenValueUSD(50, 'USDC', prices) // 50 * 1.0 = 50
 * ```
 */
export function calculateTokenValueUSD(
  tokenAmount: number,
  token: string,
  prices: TokenPrices | undefined | null,
  sonicPrice?: number
): number {
  const price = getTokenPrice(token, prices, sonicPrice);
  return tokenAmount * price;
}

/**
 * Get prices for multiple tokens at once
 * Useful for calculating portfolio values
 *
 * @param tokens - Array of token symbols
 * @param prices - TokenPrices object
 * @param sonicPrice - Optional Sonic price override
 * @returns Record of token -> price mappings
 *
 * @example
 * ```typescript
 * getBulkTokenPrices(['S', 'USDC', 'WETH'], prices)
 * // Returns { 'S': 0.17, 'USDC': 1.0, 'WETH': 3400 }
 * ```
 */
export function getBulkTokenPrices(
  tokens: string[],
  prices: TokenPrices | undefined | null,
  sonicPrice?: number
): Record<string, number> {
  return tokens.reduce((acc, token) => {
    acc[token] = getTokenPrice(token, prices, sonicPrice);
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Check if a token is supported
 *
 * @param token - Token symbol
 * @returns true if token is recognized
 *
 * @example
 * ```typescript
 * isSupportedToken('S') // true
 * isSupportedToken('USDC') // true
 * isSupportedToken('UNKNOWN') // false
 * ```
 */
export function isSupportedToken(token: string): boolean {
  return token.toUpperCase() in TOKEN_SYMBOL_MAP;
}

/**
 * Get canonical token name for a symbol
 * Useful for deduplication in UI
 *
 * @param token - Token symbol (any alias)
 * @returns Canonical token name or undefined
 *
 * @example
 * ```typescript
 * getCanonicalTokenName('S') // 'SONIC'
 * getCanonicalTokenName('ETH') // 'WETH'
 * getCanonicalTokenName('xSHADOW') // 'SHADOW'
 * ```
 */
export function getCanonicalTokenName(token: string): string | undefined {
  return TOKEN_SYMBOL_MAP[token.toUpperCase()];
}
