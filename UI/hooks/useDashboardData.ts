'use client';

import { useReadContract, useWriteContract, useReadContracts, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { parseAbi } from 'viem';
import {
  METRO_VAULT_ABI,
  SHADOW_VAULT_ABI,
  SHADOW_STRAT_ABI,
  METRO_STRAT_ABI,
  LB_BOOK_ABI
} from '@/lib/typechain';
import { type VaultConfig } from '@/lib/vaultConfigs';

export function useDashboardData(config: VaultConfig, userAddress?: string, sharePercentage?: number) {
  const isShadowVault = config.name.includes('Shadow');
  const queryClient = useQueryClient();

  // Simple contract calls - exactly like VaultCard
  const { data: userShares } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  // Pending rewards from vault (already harvested)
  const { data: vaultPendingRewards } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
    functionName: 'getPendingRewards',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  // Strategy gauge rewards (unharvested) - Shadow vaults only
  const { data: strategyRewardStatus } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRewardStatus',
    query: {
      enabled: !!config.stratAddress && isShadowVault,
    },
  });

  // ================= METRO UNHARVESTED REWARDS LOGIC (Metropolis vaults only) =================

  // Get active range from Metro Strategy
  const { data: rangeDataMetro } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: METRO_STRAT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!config.stratAddress && !isShadowVault,
    },
  });

  // Get active bins
  const activeIds = useMemo(() => {
    if (!rangeDataMetro) return undefined;
    const lower = Number(rangeDataMetro[0]);
    const upper = Number(rangeDataMetro[1]);
    const ids = [];
    for (let i = lower; i <= upper; i++) {
        ids.push(BigInt(i));
    }
    return ids;
  }, [rangeDataMetro]);

  // Read LB Hooks Parameters to find METRO rewarder address
  const lbBookAddress = (config as any).lbBookAddress as `0x${string}` | undefined;
  const { data: hooksParamsRaw } = useReadContract({
    address: isShadowVault ? undefined : lbBookAddress,
    abi: parseAbi(['function getLBHooksParameters() view returns (bytes32)']),
    functionName: 'getLBHooksParameters',
    query: {
      enabled: !isShadowVault && !!lbBookAddress,
    },
  });

  // Extract rewarder address from bytes32 (last 20 bytes)
  const rewarderAddress = useMemo(() => {
    if (!hooksParamsRaw) return undefined;
    const hex = (hooksParamsRaw as string).substring(2);
    // Pad to 64 chars to ensure safe extraction
    const paddedHex = hex.padStart(64, '0');
    return `0x${paddedHex.slice(-40)}` as `0x${string}`;
  }, [hooksParamsRaw]);

  // Query unharvested METRO rewards from the LB rewarder for those active bins
  const { data: unharvestedMetroRewards } = useReadContract({
    address: rewarderAddress,
    abi: parseAbi(['function getPendingRewards(address, uint256[]) view returns (uint256)']),
    functionName: 'getPendingRewards',
    args: rewarderAddress && activeIds ? [config.stratAddress as `0x${string}`, activeIds] : undefined,
    query: {
      enabled: !!rewarderAddress && !!activeIds && !isShadowVault,
    },
  });

  // ================= COMBINE VAULT REWARDS + UNHARVESTED AMOUNTS =================

  // Metro: vault pending rewards + unharvested METRO rewarder rewards
  const metroPendingRewards = useMemo(() => {
    if (isShadowVault || !vaultPendingRewards) return undefined;
    if (!unharvestedMetroRewards || sharePercentage === 0) return vaultPendingRewards;
    const userShareRatio = (sharePercentage || 0) / 100;
    const vaultRewardsList = vaultPendingRewards as any[];
    return vaultRewardsList.map((vaultReward: any) => ({
      ...vaultReward,
      pendingRewards: vaultReward.pendingRewards + BigInt(Math.floor(Number(unharvestedMetroRewards) * userShareRatio))
    }));
  }, [isShadowVault, vaultPendingRewards, unharvestedMetroRewards, sharePercentage]);

  // Shadow: vault pending rewards + unharvested gauge rewards from strategy
  const shadowPendingRewards = useMemo(() => {
    if (!isShadowVault || !vaultPendingRewards) return undefined;
    if (!strategyRewardStatus || sharePercentage === 0) return vaultPendingRewards;
    const userShareRatio = (sharePercentage || 0) / 100;
    const vaultRewardsList = vaultPendingRewards as any[];
    const earned = (strategyRewardStatus as any)[1] as readonly bigint[];
    return vaultRewardsList.map((vaultReward: any, i: number) => ({
      ...vaultReward,
      pendingRewards: vaultReward.pendingRewards + BigInt(Math.floor(Number(earned[i] || 0n) * userShareRatio))
    }));
  }, [isShadowVault, vaultPendingRewards, strategyRewardStatus, sharePercentage]);

  const pendingRewards = isShadowVault ? shadowPendingRewards : metroPendingRewards;


  // Get current round
  const { data: currentRound } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getCurrentRound',
    query: {
      enabled: !!config.vaultAddress,
    },
  });



  // Get queued withdrawal for current round (shows as "queued", not claimable)
  const { data: queuedWithdrawal } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress && currentRound !== undefined ? [currentRound, userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress && currentRound !== undefined,
    },
  });

  // Scan ALL rounds for claimable withdrawals
  const [claimableWithdrawals, setClaimableWithdrawals] = useState<Array<{ round: bigint, amount: bigint }>>([]);

  // Build contract calls for all rounds from 0 to currentRound - 1
  const roundChecks = currentRound !== undefined && currentRound > 0n && userAddress
    ? Array.from({ length: Number(currentRound) }, (_, i) => ({
      address: config.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'getQueuedWithdrawal' as const,
      args: [BigInt(i), userAddress as `0x${string}`],
    }))
    : [];

  const { data: roundResults } = useReadContracts({
    contracts: roundChecks,
    query: {
      enabled: roundChecks.length > 0,
    },
  });

  // Process results to find all rounds with claimable withdrawals
  useEffect(() => {
    if (!roundResults || !currentRound) {
      setClaimableWithdrawals([]);
      return;
    }

    const withdrawals: Array<{ round: bigint, amount: bigint }> = [];

    roundResults.forEach((result, index) => {
      if (result.status === 'success' && result.result && result.result > 0n) {
        withdrawals.push({
          round: BigInt(index),
          amount: result.result as bigint,
        });
      }
    });

    setClaimableWithdrawals(withdrawals);
  }, [roundResults, currentRound]);

  // Write contract hooks for transactions
  const { writeContract: claimRewards, isPending: isClaimingRewards, data: claimTxHash } = useWriteContract();

  // Watch for claim tx confirmation, then immediately refresh harvest totals
  const { isSuccess: claimTxSuccess } = useWaitForTransactionReceipt({ hash: claimTxHash });
  useEffect(() => {
    if (claimTxSuccess && userAddress) {
      queryClient.invalidateQueries({
        queryKey: ['subgraph', 'userHarvests', userAddress.toLowerCase()],
      });
    }
  }, [claimTxSuccess, userAddress, queryClient]);

  // Claim rewards function - unified for both Metro and Shadow vaults
  const handleClaimRewards = () => {
    if (!userAddress || !config.vaultAddress || !pendingRewards || pendingRewards.length === 0) return;

    claimRewards({
      address: config.vaultAddress as `0x${string}`,
      abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
      functionName: 'claim',
    });
  };

  const { writeContract: redeemWithdrawal, data: redeemTxHash, isPending: isRedeemingWithdrawal } = useWriteContract();
  const { writeContract: cancelWithdrawal, data: cancelTxHash, isPending: isCancellingWithdrawal } = useWriteContract();

  // Track transaction receipt for withdrawal claims
  const { isSuccess: redeemTxSuccess } = useWaitForTransactionReceipt({
    hash: redeemTxHash,
  });

  // State to track if we're processing multiple claims
  const [processingClaims, setProcessingClaims] = useState(false);
  const [processedTxHash, setProcessedTxHash] = useState<`0x${string}` | undefined>();
  const [lastClaimedRound, setLastClaimedRound] = useState<bigint | null>(null);

  // Redeem withdrawal from a specific round
  const handleRedeemWithdrawal = (round: bigint) => {
    if (!userAddress || !config.vaultAddress) return;

    setProcessingClaims(true);
    setLastClaimedRound(round);
    redeemWithdrawal({
      address: config.vaultAddress as `0x${string}`,
      abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
      functionName: 'redeemQueuedWithdrawal',
      args: [round, userAddress as `0x${string}`],
    });
  };

  // Track cancel tx receipt to invalidate stale queries
  const { isSuccess: cancelTxSuccess } = useWaitForTransactionReceipt({
    hash: cancelTxHash,
  });

  // Invalidate queries after successful cancel so "Queued" status clears
  useEffect(() => {
    if (cancelTxSuccess) {
      queryClient.invalidateQueries();
    }
  }, [cancelTxSuccess, queryClient]);

  // Cancel queued withdrawal
  const handleCancelWithdrawal = (shares: bigint) => {
    if (!userAddress || !config.vaultAddress) return;

    cancelWithdrawal({
      address: config.vaultAddress as `0x${string}`,
      abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
      functionName: 'cancelQueuedWithdrawal',
      args: [shares],
    });
  };

  // Handle successful transaction and immediately remove from local state
  useEffect(() => {
    if (redeemTxSuccess && redeemTxHash && redeemTxHash !== processedTxHash && processingClaims && lastClaimedRound !== null) {
      // Mark this transaction as processed
      setProcessedTxHash(redeemTxHash);

      // Immediately remove the claimed withdrawal from local state
      setClaimableWithdrawals(prev => prev.filter(w => w.round !== lastClaimedRound));

      // Invalidate on-chain queries so stale roundResults don't restore the claimed round
      queryClient.invalidateQueries();

      // Reset processing state
      setProcessingClaims(false);
      setLastClaimedRound(null);
    }
  }, [redeemTxSuccess, redeemTxHash, processedTxHash, processingClaims, lastClaimedRound, queryClient]);

  // Calculate total claimable amount across all rounds
  const totalClaimableAmount = claimableWithdrawals.reduce((sum, w) => sum + w.amount, 0n);

  return {
    userShares,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawals,  // Array of {round, amount}
    totalClaimableAmount,  // Sum of all claimable withdrawals
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,  // Now takes round parameter
    isRedeemingWithdrawal,
    handleCancelWithdrawal,  // Cancel queued withdrawal
    isCancellingWithdrawal,
  };
}
