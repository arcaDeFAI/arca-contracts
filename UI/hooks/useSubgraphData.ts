import { useQuery } from '@tanstack/react-query';
import {
  querySubgraph,
  RewardEventEntity,
  VaultEntity,
  REWARD_EVENT_FIELDS,
  VAULT_FIELDS
} from '@/lib/subgraph';

interface RewardEventsResponse {
  rewardEvents: RewardEventEntity[];
}

interface VaultResponse {
  vault: VaultEntity | null;
}

/**
 * Fetch vault reward events from subgraph
 */
export function useVaultRewardEvents(vaultAddress: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ['subgraph', 'rewardEvents', vaultAddress, limit],
    queryFn: async () => {
      if (!vaultAddress) return { rewardEvents: [] };

      const query = `
        query GetRewardEvents($vault: String!, $limit: Int!) {
          rewardEvents(
            where: { vault: $vault }
            orderBy: timestamp
            orderDirection: desc
            first: $limit
          ) {
            ${REWARD_EVENT_FIELDS}
          }
        }
      `;

      const result = await querySubgraph<RewardEventsResponse>(query, {
        vault: vaultAddress.toLowerCase(),
        limit,
      });

      return result;
    },
    enabled: !!vaultAddress,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch vault metadata from subgraph
 */
export function useSubgraphVault(vaultAddress: string | undefined) {
  return useQuery({
    queryKey: ['subgraph', 'vault', vaultAddress],
    queryFn: async () => {
      if (!vaultAddress) return { vault: null };

      const query = `
        query GetVault($id: ID!) {
          vault(id: $id) {
            ${VAULT_FIELDS}
          }
        }
      `;

      const result = await querySubgraph<VaultResponse>(query, {
        id: vaultAddress.toLowerCase(),
      });

      return result;
    },
    enabled: !!vaultAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
  });
}
