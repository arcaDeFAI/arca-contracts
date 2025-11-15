// Token utility functions

/**
 * Get the logo path for a given token symbol
 */
export function getTokenLogo(tokenSymbol: string): string {
  const symbol = tokenSymbol.toUpperCase();
  
  const logoMap: { [key: string]: string } = {
    'S': '/SonicLogoRound.png',
    'WS': '/SonicLogoRound.png', // wS uses same Sonic logo
    'USDC': '/USDCLogo.png',
    'WETH': '/WETH-logo.png',
    'ETH': '/WETH-logo.png', // ETH uses WETH logo
    'METRO': '/MetropolisLogo.png',
    'SHADOW': '/SHadowLogo.jpg',
  };

  return logoMap[symbol] || '/SonicLogoRound.png'; // Default fallback
}

/**
 * Get token name display (for UI)
 */
export function getTokenDisplayName(tokenSymbol: string): string {
  const symbol = tokenSymbol.toUpperCase();
  
  const nameMap: { [key: string]: string } = {
    'S': 'S',
    'WS': 'WS',
    'USDC': 'USDC',
    'WETH': 'WETH',
    'ETH': 'ETH',
    'METRO': 'Metro',
    'SHADOW': 'Shadow',
  };

  return nameMap[symbol] || symbol;
}

/**
 * Parse vault name to extract token pair
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
