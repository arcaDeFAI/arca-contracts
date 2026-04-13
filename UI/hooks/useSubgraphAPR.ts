/**
 * @deprecated APR is now computed entirely by useSubgraphMetrics (arca-vaults subgraph v1.0.11+).
 * This hook hit an old v1.0.0 endpoint that no longer exists (404).
 * Kept as a stub so any remaining import sites compile without error.
 */
export function useSubgraphAPR(_vaultAddress: string, _vaultTVL: number, _rewardPrice: number) {
  return { apr: 0, isLoading: false };
}
