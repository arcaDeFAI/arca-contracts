import { getToken, TOKEN_REGISTRY } from './tokenRegistry';

/**
 * Get the logo path for a given token symbol.
 */
export function getTokenLogo(tokenSymbol: string): string {
  return getToken(tokenSymbol)?.logo ?? '/SonicLogoRound.png';
}

/**
 * Get token name display (for UI).
 */
export function getTokenDisplayName(tokenSymbol: string): string {
  return getToken(tokenSymbol)?.displayName ?? tokenSymbol;
}

/**
 * Check if a token is a stablecoin (fixed price at $1.00).
 * Uses the token registry price source to determine stablecoin status,
 * so no hardcoded token symbols are needed.
 */
export function isStablecoin(token: string): boolean {
  const def = getToken(token);
  if (!def) return false;
  return def.priceSource.type === 'fixed' && def.priceSource.price === 1.0;
}

/**
 * Get all stablecoin symbols from the registry.
 */
export function getStablecoinSymbols(): string[] {
  return Object.values(TOKEN_REGISTRY)
    .filter(t => t.priceSource.type === 'fixed' && (t.priceSource as { type: 'fixed'; price: number }).price === 1.0)
    .map(t => t.symbol);
}

/**
 * Parse vault name to extract token pair.
 * Example: "S • USDC | Metropolis" => { tokenX: 'S', tokenY: 'USDC', dex: 'Metropolis' }
 */
export function parseVaultName(vaultName: string): { tokenX: string; tokenY: string; dex: string } {
  // Split by pipe to separate tokens from DEX
  const [tokenPart, dexPart] = vaultName.split('|').map(s => s.trim());

  // Split token part by bullet or dash
  const tokens = tokenPart.split(/[•·-]/).map(s => s.trim());

  return {
    tokenX: tokens[0] || 'S',
    tokenY: tokens[1] || 'USDC',
    dex: dexPart || 'Unknown',
  };
}
