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
  /** Running total of claimed USD, one point per UTC day with a claim (unix seconds) */
  cumulative: Array<{ date: number; usd: number }>;
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

      const PAGE = 1000;
      const buildQuery = (fields: string) => `
        query GetUserHarvests($user: Bytes!, $lastId: Bytes!) {
          userHarvestEvents(
            where: { user: $user, id_gt: $lastId }
            orderBy: id
            orderDirection: asc
            first: ${PAGE}
          ) {
            ${fields}
          }
        }
      `;
      // Every claim, page by page: active wallets have far more than one page of 1000
      const fetchAll = async (fields: string): Promise<UserHarvestsResponse> => {
        const all: UserHarvestsResponse['userHarvestEvents'] = [];
        let lastId = '0x';
        for (;;) {
          const page = (await querySubgraph<UserHarvestsResponse>(buildQuery(fields), { user: userAddress.toLowerCase(), lastId }))
            ?.userHarvestEvents ?? [];
          all.push(...page);
          if (page.length < PAGE) break;
          lastId = page[page.length - 1].id;
        }
        all.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
        return { userHarvestEvents: all };
      };

      // amountUsd (value at claim time) exists from subgraph 1.0.19. Ask for it first and fall
      // back to the older schema, so this works before and after the subgraph switch.
      try {
        return await fetchAll(`${USER_HARVEST_EVENT_FIELDS} amountUsd`);
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('amountUsd')) throw err;
        return fetchAll(USER_HARVEST_EVENT_FIELDS);
      }
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
    const cumulative: Array<{ date: number; usd: number }> = [];
    let totalHarvestedUSD = 0;
    let firstHarvestTimestamp: number | null = null;

    for (const event of events) {
      const vaultKey = event.vault.id.toLowerCase();
      const tokenAddr = event.token.toLowerCase();
      const timestampMs = Number(event.timestamp) * 1000;

      // USD value at the moment of the claim (subgraph 1.0.19+). Without it — older subgraph or a
      // token with no on-chain price source — fall back to today's price from the price feed.
      let amountUSD: number;
      if (event.amountUsd != null) {
        amountUSD = Number(event.amountUsd);
      } else {
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
        amountUSD = (Number(event.amount) / 10 ** (tokenDef?.decimals ?? 18)) * price;
      }
      totalHarvestedUSD += amountUSD;

      // Events arrive oldest-first, so the running total is monotonic
      const day = Math.floor(Number(event.timestamp) / 86_400) * 86_400;
      const last = cumulative.at(-1);
      if (last && last.date === day) last.usd = totalHarvestedUSD;
      else cumulative.push({ date: day, usd: totalHarvestedUSD });

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
      cumulative,
      isLoading,
    };
  }, [data, prices, isLoading]);
}
