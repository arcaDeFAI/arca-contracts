'use client';

import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';

interface PositionRaw {
  shares: string;
  avgEntryTime: string;
  points: string;
  indexSnapshot: string;
  vault: { id: string; pointsIndex: string | null; pointsIndexUpdatedAt: string | null; lastPpsUsd: string | null };
}

export interface PointsPosition {
  points: number;
  avgEntryTime: number;
}

/** Same curve as penaltyRate in subgraph/src/mapping.ts */
export function penaltyRate(ageSeconds: number): number {
  const days = ageSeconds / 86_400;
  if (days < 7) return 1;
  if (days < 30) return 0.5;
  if (days < 90) return 0.25;
  return 0;
}

/**
 * The wallet's airdrop points per vault, including points accrued since the subgraph last
 * settled them (shares × growth of the vault's points index). Null if the subgraph has no points yet.
 */
export function usePoints(userAddress?: string) {
  const { data } = useQuery({
    queryKey: ['subgraph', 'points', userAddress?.toLowerCase()],
    queryFn: () =>
      querySubgraph<{ userVaultPositions: PositionRaw[] }>(`{
        userVaultPositions(where: { user: "${userAddress!.toLowerCase()}" }) {
          shares avgEntryTime points indexSnapshot
          vault { id pointsIndex pointsIndexUpdatedAt lastPpsUsd }
        }
      }`),
    enabled: !!userAddress,
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  const now = Date.now() / 1000;
  const byVault = new Map<string, PointsPosition>();
  let total = 0;
  for (const p of data.userVaultPositions) {
    const v = p.vault;
    let index = Number(v.pointsIndex ?? 0);
    if (v.lastPpsUsd && v.pointsIndexUpdatedAt) {
      index += (Number(v.lastPpsUsd) / 1e24) * ((now - Number(v.pointsIndexUpdatedAt)) / 86_400);
    }
    const points = Number(p.points) + Number(p.shares) * (index - Number(p.indexSnapshot));
    byVault.set(v.id.toLowerCase(), { points, avgEntryTime: Number(p.avgEntryTime) });
    total += points;
  }
  return { total, byVault };
}
