'use client';

import { usePrices } from '@/contexts/PriceContext';

/**
 * Re-exports the centralized price hook for backward compatibility.
 * Provides token prices from the global PriceContext.
 */
export function useTokenPrices() {
  const { prices, isLoading, error } = usePrices();

  return {
    prices: prices ?? null,
    isLoading,
    error
  };
}
