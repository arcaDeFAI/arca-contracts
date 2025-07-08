import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) {
    return "$--";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format token amounts with proper decimal places based on token decimals
 * This properly handles the display string that comes from formatUnits
 * @param displayAmount - The already formatted amount string (e.g., "4762893.0" from formatUnits)
 * @param displayDecimals - Number of decimal places to show in UI (default: 2)
 * @returns Formatted string like "4,762,893.00" or "1,234.56"
 */
export function formatTokenDisplay(
  displayAmount: string | undefined,
  displayDecimals: number = 2,
): string {
  if (!displayAmount || displayAmount === "0.0") {
    return "0.00";
  }

  // Parse the string to a number
  const numAmount = parseFloat(displayAmount);

  // Format with proper decimals and thousand separators
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: displayDecimals,
    maximumFractionDigits: displayDecimals,
  }).format(numAmount);
}
