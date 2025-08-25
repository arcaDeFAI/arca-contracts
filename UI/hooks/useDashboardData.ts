'use client';

import { useReadContract, useWriteContract } from 'wagmi';
import { METRO_VAULT_ABI } from '@/abi/MetroVault.abi';

interface VaultConfig {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
}

export function useDashboardData(config: VaultConfig, userAddress?: string) {
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

  const { data: pendingRewards } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getPendingRewards',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  // Get current round
  const { data: currentRound } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getCurrentRound',
    query: {
      enabled: !!config.vaultAddress,
    },
  });

  // Check for queued withdrawals in rounds 0, 1, 2, 3
  const { data: queuedWithdrawalRound0 } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress ? [BigInt(0), userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  const { data: queuedWithdrawalRound1 } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress ? [BigInt(1), userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  const { data: queuedWithdrawalRound2 } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress ? [BigInt(2), userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  const { data: queuedWithdrawalRound3 } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress ? [BigInt(3), userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
    },
  });

  // Find the first round with a withdrawal
  let queuedWithdrawal: bigint | undefined;
  let withdrawalRound: bigint | undefined;

  if (queuedWithdrawalRound0 && queuedWithdrawalRound0 > 0n) {
    queuedWithdrawal = queuedWithdrawalRound0;
    withdrawalRound = BigInt(0);
  } else if (queuedWithdrawalRound1 && queuedWithdrawalRound1 > 0n) {
    queuedWithdrawal = queuedWithdrawalRound1;
    withdrawalRound = BigInt(1);
  } else if (queuedWithdrawalRound2 && queuedWithdrawalRound2 > 0n) {
    queuedWithdrawal = queuedWithdrawalRound2;
    withdrawalRound = BigInt(2);
  } else if (queuedWithdrawalRound3 && queuedWithdrawalRound3 > 0n) {
    queuedWithdrawal = queuedWithdrawalRound3;
    withdrawalRound = BigInt(3);
  }


  console.log(`🔍 Dashboard ${config.name}:`, {
    userAddress,
    userShares: userShares?.toString(),
    pendingRewards: pendingRewards?.length || 0,
    currentRound: currentRound?.toString(),
    queuedWithdrawalRound0: queuedWithdrawalRound0?.toString(),
    queuedWithdrawalRound1: queuedWithdrawalRound1?.toString(),
    queuedWithdrawalRound2: queuedWithdrawalRound2?.toString(),
    queuedWithdrawalRound3: queuedWithdrawalRound3?.toString(),
    queuedWithdrawal: queuedWithdrawal?.toString(),
    withdrawalRound: withdrawalRound?.toString(),
  });

  // Write contract hooks for transactions
  const { writeContract: claimRewards, isPending: isClaimingRewards } = useWriteContract();

  // Helper functions for contract interactions
  const handleClaimRewards = () => {
    if (!userAddress) return;
    
    claimRewards({
      address: config.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'claim',
      args: [],
    });
  };

  // Write contract hook for redeem withdrawal
  const { writeContract: redeemWithdrawal, isPending: isRedeemingWithdrawal } = useWriteContract();

  const handleRedeemWithdrawal = () => {
    if (!userAddress || !queuedWithdrawal || withdrawalRound === undefined) return;
    
    console.log(`🔄 Redeeming withdrawal for round ${withdrawalRound}:`, {
      amount: queuedWithdrawal.toString(),
      round: withdrawalRound.toString(),
    });

    redeemWithdrawal({
      address: config.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'redeemQueuedWithdrawal',
      args: [BigInt(3), userAddress as `0x${string}`],
    });
  };

  return {
    userShares,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    withdrawalRound,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
  };
}
