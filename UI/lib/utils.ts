import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits, parseUnits } from "viem"
import { getToken } from "./tokenRegistry"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format token amounts for display
export function formatTokenAmount(amount: bigint, token: string): string {
  // Handle undefined/null amounts
  if (amount === undefined || amount === null) {
    return '0.00'
  }

  const decimals = getToken(token)?.decimals ?? 18;

  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)

  // For very small numbers, show more decimal places
  if (num > 0 && num < 0.0001) {
    return num.toFixed(12) // Show 12 decimal places for very small amounts
  }

  // For small numbers, show 6 decimal places
  if (num > 0 && num < 1) {
    return num.toFixed(6)
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

// Parse token amounts from user input
export function parseTokenAmount(amount: string, token: string): bigint {
  const decimals = getToken(token)?.decimals ?? 18;
  return parseUnits(amount, decimals)
}

// Format USD values
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`
}

/**
 * Get vault share decimals using the on-chain formula: tokenY.decimals + 6
 * This matches BaseVault.decimals() = _decimalsY() + _SHARES_DECIMALS (6)
 */
export function getShareDecimals(tokenY?: string): number {
  const SHARES_DECIMALS = 6;
  const tokenYDecimals = tokenY ? (getToken(tokenY)?.decimals ?? 18) : 18;
  return tokenYDecimals + SHARES_DECIMALS;
}

// Format shares with vault-specific decimals
export function formatShares(shares: bigint, tokenX?: string, tokenY?: string): string {
  const decimals = getShareDecimals(tokenY);

  const formatted = formatUnits(shares, decimals)
  const num = parseFloat(formatted)

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

// Parse shares from user input with vault-specific decimals
export function parseShares(amount: string, tokenX?: string, tokenY?: string): bigint {
  const decimals = getShareDecimals(tokenY);
  return parseUnits(amount, decimals)
}

// Truncate address for display
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
