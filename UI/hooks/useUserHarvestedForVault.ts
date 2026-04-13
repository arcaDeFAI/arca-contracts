'use client';

import { useSubgraphUserHarvested } from './useSubgraphUserHarvested';

/**
 * Per-vault harvest summary for a specific user, sourced from the subgraph.
 * Multiple calls with the same userAddress share a single cached request.
 */
export function useUserHarvestedForVault(
  vaultAddress: string,
  userAddress?: string,
) {
  const { harvestsByVault, isLoading } = useSubgraphUserHarvested(userAddress);
  const summary = harvestsByVault.get(vaultAddress.toLowerCase());

  return {
    totalHarvestedUSD: summary?.totalHarvestedUSD ?? 0,
    isLoading,
  };
}
