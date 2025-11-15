import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits, parseUnits } from "viem"
import { DECIMALS } from "./contracts"
// COmment 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format token amounts for display
export function formatTokenAmount(amount: bigint, token: 'SONIC' | 'WS' | 'USDC' | 'S' | 'WETH' | 'ETH' | string): string {
  // Handle undefined/null amounts
  if (amount === undefined || amount === null) {
    return '0.00'
  }
  
  // Normalize token name
  const normalizedToken = token.toUpperCase();
  let decimals = 18; // Default for most tokens
  
  if (normalizedToken === 'USDC') {
    decimals = 6;
  } else if (normalizedToken === 'SONIC' || normalizedToken === 'S' || normalizedToken === 'WS' || normalizedToken === 'WETH' || normalizedToken === 'ETH') {
    decimals = 18;
  }
  
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
export function parseTokenAmount(amount: string, token: 'SONIC' | 'WS' | 'USDC' | 'S' | 'WETH' | 'ETH' | string): bigint {
  // Normalize token name
  const normalizedToken = token.toUpperCase();
  let decimals = 18; // Default for most tokens
  
  if (normalizedToken === 'USDC') {
    decimals = 6;
  } else if (normalizedToken === 'SONIC' || normalizedToken === 'S' || normalizedToken === 'WS' || normalizedToken === 'WETH' || normalizedToken === 'ETH') {
    decimals = 18;
  }
  
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
  const formatted = formatUnits(shares, 12) // 10^-12 decimals
  const num = parseFloat(formatted)
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 10,
  })
}

// Parse shares from user input (10^-10 decimals)
export function parseShares(amount: string): bigint {
  return parseUnits(amount, 12) // 10^-12 decimals
}

// Truncate address for display
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
