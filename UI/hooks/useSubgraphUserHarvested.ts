'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { querySubgraph, UserHarvestEventEntity, USER_HARVEST_EVENT_FIELDS } from '@/lib/subgraph';
import { usePrices } from '@/contexts/PriceContext';
import { getTokenByAddress } from '@/lib/tokenRegistry';
import { getTokenPrice } from '@/lib/tokenPriceHelpers';

interface UserHarvestsResponse {
  userHarvestEvents: UserHarvestEventEntity[];
}

interface VaultHarvestSummary {
  totalHarvestedUSD: number;
  firstTimestamp: number | null;
}

interface SubgraphUserHarvestedResult {
  /** USD total across all vaults */
  totalHarvestedUSD: number;
  /** Earliest harvest timestamp across all vaults (ms) */
  firstHarvestTimestamp: number | null;
  /** Per-vault summary keyed by lowercase vault address */
  harvestsByVault: Map<string, VaultHarvestSummary>;
  isLoading: boolean;
}

/**
 * Fetches all Harvested events for a user across every Arca vault from the subgraph.
 * Replaces the RPC getLogs approach in useTotalHarvestedRewards — much faster and
 * works for any wallet address without scanning 50M+ blocks.
 *
 * NOTE: UserHarvestEvent indexing is live from subgraph v1.0.11+.
 */
export function useSubgraphUserHarvested(
  userAddress?: string
): SubgraphUserHarvestedResult {
  const { prices } = usePrices();

  const { data, isLoading } = useQuery({
    queryKey: ['subgraph', 'userHarvests', userAddress?.toLowerCase()],
    queryFn: async () => {
      if (!userAddress) return { userHarvestEvents: [] };

      const query = `
        query GetUserHarvests($user: Bytes!, $first: Int!) {
          userHarvestEvents(
            where: { user: $user }
            orderBy: timestamp
            orderDirection: asc
            first: $first
          ) {
            ${USER_HARVEST_EVENT_FIELDS}
          }
        }
      `;

      const result = await querySubgraph<UserHarvestsResponse>(query, {
        user: userAddress.toLowerCase(),
        first: 1000,
      });
      return result ?? { userHarvestEvents: [] };
    },
    enabled: !!userAddress,
    staleTime: 30_000,              // 30 seconds — stale quickly so any focus/mount refetches
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60_000,        // poll every 60 seconds
    refetchOnWindowFocus: true,     // immediately re-fetch when user returns to tab
    refetchOnMount: true,
  });

  return useMemo<SubgraphUserHarvestedResult>(() => {
    const events = data?.userHarvestEvents ?? [];

    const harvestsByVault = new Map<string, VaultHarvestSummary>();
    let totalHarvestedUSD = 0;
    let firstHarvestTimestamp: number | null = null;

    for (const event of events) {
      const vaultKey = event.vault.id.toLowerCase();
      const tokenAddr = event.token.toLowerCase();
      const timestampMs = Number(event.timestamp) * 1000;

      // USD value using token registry + price context
      const tokenDef = getTokenByAddress(tokenAddr);
      let price = 0;
      if (tokenDef && prices) {
        price = getTokenPrice(tokenDef.symbol, prices);
      } else if (
        (tokenAddr === '0x0000000000000000000000000000000000000000' || tokenAddr === 's') &&
        prices
      ) {
        price = prices.sonic ?? 0;
      }

      const amountUSD = (Number(event.amount) / 1e18) * price;
      totalHarvestedUSD += amountUSD;

      // Accumulate per-vault
      const existing = harvestsByVault.get(vaultKey);
      if (existing) {
        existing.totalHarvestedUSD += amountUSD;
        if (existing.firstTimestamp === null || timestampMs < existing.firstTimestamp) {
          existing.firstTimestamp = timestampMs;
        }
      } else {
        harvestsByVault.set(vaultKey, {
          totalHarvestedUSD: amountUSD,
          firstTimestamp: timestampMs,
        });
      }

      // Track overall earliest harvest
      if (firstHarvestTimestamp === null || timestampMs < firstHarvestTimestamp) {
        firstHarvestTimestamp = timestampMs;
      }
    }

    return {
      totalHarvestedUSD,
      firstHarvestTimestamp,
      harvestsByVault,
      isLoading,
    };
  }, [data, prices, isLoading]);
}
