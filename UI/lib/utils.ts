import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits, parseUnits } from "viem"
import { DECIMALS } from "./contracts"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format token amounts for display
export function formatTokenAmount(amount: bigint, token: 'SONIC' | 'USDC'): string {
  const decimals = DECIMALS[token]
  const formatted = formatUnits(amount, decimals)
  const num = parseFloat(formatted)
  
  // For very small numbers (like vault shares), show more decimal places
  if (num > 0 && num < 0.0001) {
    return num.toFixed(8) // Show 8 decimal places for very small amounts
  }
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

// Parse token amounts from user input
export function parseTokenAmount(amount: string, token: 'SONIC' | 'USDC'): bigint {
  const decimals = DECIMALS[token]
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

// Format shares with 10^-10 decimals
export function formatShares(shares: bigint): string {
  const formatted = formatUnits(shares, 10) // 10^-10 decimals
  const num = parseFloat(formatted)
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 10,
  })
}

// Parse shares from user input (10^-10 decimals)
export function parseShares(amount: string): bigint {
  return parseUnits(amount, 10) // 10^-10 decimals
}

// Truncate address for display
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
