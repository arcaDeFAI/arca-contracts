import { getToken, getTokenOrThrow } from './tokenRegistry';

/**
 * Get token contract address by token symbol.
 * Returns WS address as fallback for native token (S/SONIC).
 */
export function getTokenAddress(token: string): `0x${string}` {
  const def = getToken(token);
  if (!def || !def.address) {
    // Native token has no contract address — fall back to WS
    return getTokenOrThrow('WS').address!;
  }
  return def.address;
}

/**
 * Get token decimals by token symbol.
 */
export function getTokenDecimals(token: string): number {
  return getToken(token)?.decimals ?? 18;
}

/**
 * Get token logo path by token symbol.
 */
export function getTokenLogo(token: string): string {
  return getToken(token)?.logo ?? '/SonicLogoRound.png';
}

/**
 * Token price utilities - re-exported from tokenPriceHelpers.
 * Provides centralized token price calculation with support for aliases.
 */
export {
  getTokenPrice,
  calculateTokenValueUSD,
  getBulkTokenPrices,
  isSupportedToken,
  getCanonicalTokenName,
} from './tokenPriceHelpers';
