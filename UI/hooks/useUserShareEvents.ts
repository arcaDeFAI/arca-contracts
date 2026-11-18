'use client';

import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';

/** One movement of the wallet's vault shares, valued when it happened (subgraph 1.0.19+). */
export interface UserShareEvent {
  vault: string;
  timestamp: number;
  kind: 'deposit' | 'withdraw' | 'cancel' | 'transferIn' | 'transferOut';
  shares: bigint;
  valueUsd: number | null;
  priceXUsd: number | null;
  priceYUsd: number | null;
}

interface Raw {
  vault: { id: string };
  timestamp: string;
  kind: UserShareEvent['kind'];
  shares: string;
  valueUsd: string | null;
  priceXUsd: string | null;
  priceYUsd: string | null;
}

const num = (v: string | null) => (v === null ? null : Number(v));

/** Every deposit, withdrawal, cancel and transfer of the wallet's vault shares, oldest first. */
export function useUserShareEvents(user: string | undefined) {
  return useQuery({
    queryKey: ['subgraph', 'userShareEvents', user?.toLowerCase()],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const data = await querySubgraph<{ userShareEvents: Raw[] }>(
        `query UserShareEvents($user: Bytes!) {
          userShareEvents(where: { user: $user }, orderBy: timestamp, orderDirection: asc, first: 1000) {
            vault { id } timestamp kind shares valueUsd priceXUsd priceYUsd
          }
        }`,
        { user: user!.toLowerCase() },
      );
      return (data?.userShareEvents ?? []).map(
        (e): UserShareEvent => ({
          vault: e.vault.id.toLowerCase(),
          timestamp: Number(e.timestamp),
          kind: e.kind,
          shares: BigInt(e.shares),
          valueUsd: num(e.valueUsd),
          priceXUsd: num(e.priceXUsd),
          priceYUsd: num(e.priceYUsd),
        }),
      );
    },
  });
}
