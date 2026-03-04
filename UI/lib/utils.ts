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

// Format shares with vault-specific decimals
export function formatShares(shares: bigint, tokenX?: string, tokenY?: string): string {
  const xShareDec = tokenX ? (getToken(tokenX)?.shareDecimals ?? 12) : 12;
  const yShareDec = tokenY ? (getToken(tokenY)?.shareDecimals ?? 12) : 12;
  const decimals = Math.max(xShareDec, yShareDec);

  const formatted = formatUnits(shares, decimals)
  const num = parseFloat(formatted)

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

// Parse shares from user input with vault-specific decimals
export function parseShares(amount: string, tokenX?: string, tokenY?: string): bigint {
  const xShareDec = tokenX ? (getToken(tokenX)?.shareDecimals ?? 12) : 12;
  const yShareDec = tokenY ? (getToken(tokenY)?.shareDecimals ?? 12) : 12;
  const decimals = Math.max(xShareDec, yShareDec);

  return parseUnits(amount, decimals)
}

// Truncate address for display
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
