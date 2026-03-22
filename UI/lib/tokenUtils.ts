import { getToken } from './tokenRegistry';

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
