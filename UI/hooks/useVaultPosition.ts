'use client';

import { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { parseAbi } from 'viem';
import { METRO_VAULT_ABI, SHADOW_VAULT_ABI, SHADOW_STRAT_ABI, METRO_STRAT_ABI } from '@/lib/typechain';
import { isShadowVault, type VaultConfig } from '@/lib/vaultConfigs';

export interface PendingReward {
  token: `0x${string}`;
  amount: bigint;
}

export interface ClaimableWithdrawal {
  round: bigint;
  shares: bigint;
}

type UserRewardRaw = { token: `0x${string}`; pendingRewards: bigint };
type RewardStatusRaw = readonly [readonly `0x${string}`[], readonly bigint[], `0x${string}`, boolean];

const LB_HOOKS_ABI = parseAbi(['function getLBHooksParameters() view returns (bytes32)']);
const LB_REWARDER_ABI = parseAbi(['function getPendingRewards(address, uint256[]) view returns (uint256)']);

/**
 * The connected user's claimable state in one vault: pending rewards (already forwarded to the
 * vault, plus the user's share of rewards still sitting in the gauge / LB rewarder) and
 * queued / claimable withdrawals.
 */
export function useVaultPosition(config: VaultConfig, userAddress: string | undefined, shareRatio: number) {
  const shadow = isShadowVault(config);
  const vault = config.vaultAddress as `0x${string}`;
  const strat = config.stratAddress as `0x${string}`;
  const user = userAddress as `0x${string}` | undefined;

  // ── Rewards already in the vault ─────────────────────────────────────────
  const { data: vaultRewardsRaw } = useReadContract({
    address: vault,
    abi: shadow ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
    functionName: 'getPendingRewards',
    args: user ? [user] : undefined,
    query: { enabled: !!user },
  });
  const vaultRewards = vaultRewardsRaw as readonly UserRewardRaw[] | undefined;

  // ── Shadow: rewards still in the gauge ───────────────────────────────────
  const { data: rewardStatusRaw } = useReadContract({
    address: strat,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRewardStatus',
    query: { enabled: shadow },
  });
  const rewardStatus = rewardStatusRaw as RewardStatusRaw | undefined;

  // ── Metropolis: rewards still in the LB rewarder for the active bins ─────
  const { data: metroRange } = useReadContract({
    address: strat,
    abi: METRO_STRAT_ABI,
    functionName: 'getRange',
    query: { enabled: !shadow },
  });
  const { data: hooksParams } = useReadContract({
    address: shadow ? undefined : (config.lbBookAddress as `0x${string}`),
    abi: LB_HOOKS_ABI,
    functionName: 'getLBHooksParameters',
    query: { enabled: !shadow },
  });
  const rewarder = hooksParams ? (`0x${hooksParams.slice(2).padStart(64, '0').slice(-40)}` as `0x${string}`) : undefined;
  const binIds = useMemo(() => {
    if (!metroRange) return undefined;
    const [lower, upper] = metroRange as readonly [number | bigint, number | bigint];
    const ids: bigint[] = [];
    for (let i = Number(lower); i <= Number(upper); i++) ids.push(BigInt(i));
    return ids;
  }, [metroRange]);
  const { data: unharvestedMetro } = useReadContract({
    address: rewarder,
    abi: LB_REWARDER_ABI,
    functionName: 'getPendingRewards',
    args: binIds ? [strat, binIds] : undefined,
    query: { enabled: !shadow && !!rewarder && !!binIds },
  });

  const pendingRewards = useMemo<PendingReward[]>(() => {
    if (!vaultRewards) return [];
    return vaultRewards.map((r) => {
      let extra = 0n;
      if (shadow && rewardStatus) {
        const idx = rewardStatus[0].findIndex((t) => t.toLowerCase() === r.token.toLowerCase());
        if (idx >= 0) extra = BigInt(Math.floor(Number(rewardStatus[1][idx] ?? 0n) * shareRatio));
      } else if (!shadow && unharvestedMetro) {
        extra = BigInt(Math.floor(Number(unharvestedMetro) * shareRatio));
      }
      return { token: r.token, amount: r.pendingRewards + extra };
    });
  }, [vaultRewards, rewardStatus, unharvestedMetro, shareRatio, shadow]);

  // ── Withdrawals ──────────────────────────────────────────────────────────
  const { data: currentRound } = useReadContract({
    address: vault,
    abi: METRO_VAULT_ABI,
    functionName: 'getCurrentRound',
  });

  const { data: queuedShares } = useReadContract({
    address: vault,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: user && currentRound !== undefined ? [currentRound, user] : undefined,
    query: { enabled: !!user && currentRound !== undefined },
  });

  // Rounds before the current one are processed; any shares left there are claimable.
  const pastRounds = user && currentRound ? Number(currentRound) : 0;
  const { data: pastRoundResults } = useReadContracts({
    contracts: Array.from({ length: pastRounds }, (_, i) => ({
      address: vault,
      abi: METRO_VAULT_ABI,
      functionName: 'getQueuedWithdrawal' as const,
      args: [BigInt(i), user as `0x${string}`] as const,
    })),
    query: { enabled: pastRounds > 0 },
  });

  const claimableWithdrawals = useMemo<ClaimableWithdrawal[]>(() => {
    if (!pastRoundResults) return [];
    return pastRoundResults.flatMap((r, i) =>
      r.status === 'success' && r.result > 0n ? [{ round: BigInt(i), shares: r.result }] : [],
    );
  }, [pastRoundResults]);

  return {
    pendingRewards,
    hasPendingRewards: pendingRewards.some((r) => r.amount > 0n),
    queuedShares: queuedShares ?? 0n,
    claimableWithdrawals,
  };
}
