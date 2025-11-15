import { CONTRACTS, DECIMALS } from './contracts';

/**
 * Get token contract address by token symbol
 * Note: SONIC is native token and has no contract address
 */
export function getTokenAddress(token: string): `0x${string}` {
  const upperToken = token.toUpperCase();
  if (upperToken === 'WS') return CONTRACTS.WS as `0x${string}`;
  if (upperToken === 'USDC') return CONTRACTS.USDC as `0x${string}`;
  if (upperToken === 'WETH' || upperToken === 'ETH') return CONTRACTS.WETH as `0x${string}`;
  // SONIC is native token, fallback to WS
  return CONTRACTS.WS as `0x${string}`;
}

/**
 * Get token decimals by token symbol
 */
export function getTokenDecimals(token: string): number {
  const upperToken = token.toUpperCase();
  if (upperToken === 'USDC') return DECIMALS.USDC;
  if (upperToken === 'WETH' || upperToken === 'ETH') return DECIMALS.WETH;
  return 18; // Default for S, WS, SONIC
}

/**
 * Get token balance from available balances
 */
export function getTokenBalance(
  token: string,
  balances: {
    sonicBalance: bigint;
    wsBalance: bigint;
    usdcBalance: bigint;
    wethBalance: bigint;
  }
): bigint {
  const upperToken = token.toUpperCase();
  if (upperToken === 'S' || upperToken === 'SONIC') return balances.sonicBalance;
  if (upperToken === 'WS') return balances.wsBalance;
  if (upperToken === 'USDC') return balances.usdcBalance;
  if (upperToken === 'WETH' || upperToken === 'ETH') return balances.wethBalance;
  return 0n;
}

/**
 * Get token logo path by token symbol
 */
export function getTokenLogo(token: string): string {
  const upperToken = token.toUpperCase();
  if (upperToken === 'USDC') return '/USDCLogo.png';
  if (upperToken === 'WETH' || upperToken === 'ETH') return '/WETH-logo.png';
  if (upperToken === 'WS' || upperToken === 'S' || upperToken === 'SONIC') return '/SonicLogoRound.png';
  return '/SonicLogoRound.png'; // Default to Sonic logo
}
