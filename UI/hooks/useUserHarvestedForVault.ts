'use client';

import { useTotalHarvestedRewards } from './useTotalHarvestedRewards';

/**
 * Wrapper hook that uses the same data source as Total Earned
 * to ensure consistency across the dashboard
 */
export function useUserHarvestedForVault(
  vaultAddress: string,
  userAddress?: string,
  tokenPrice?: number
) {
  // Use the same hook as Total Earned to ensure data consistency
  const { totalHarvestedUSD, isLoading } = useTotalHarvestedRewards(
    vaultAddress,
    userAddress,
    tokenPrice
  );

  return { totalHarvestedUSD, isLoading };
}
