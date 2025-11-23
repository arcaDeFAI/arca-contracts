'use client';

import { useReadContract, useWriteContract } from 'wagmi';
import {
  METRO_VAULT_ABI,
  SHADOW_VAULT_ABI
} from '@/lib/typechain';

interface VaultConfig {
  vaultAddress: string;
  stratAddress: string;
  name: string;
  tier: 'Active' | 'Premium' | 'Elite';
}

export function useDashboardData(config: VaultConfig, userAddress?: string) {
  const isShadowVault = config.name.includes('Shadow');
  
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

  // Pending rewards - works for both Metro and Shadow vaults
  const { data: pendingRewards } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
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

  // Get claimable withdrawal from previous round (currentRound - 1)
  const { data: claimableWithdrawal } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getQueuedWithdrawal',
    args: userAddress && currentRound !== undefined && currentRound > 0n ? [currentRound - 1n, userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress && currentRound !== undefined && currentRound > 0n,
    },
  });

  // Debug logging to help diagnose withdrawal visibility issues
  if (userAddress && currentRound !== undefined) {
    console.log('🔍 WITHDRAWAL DATA:', {
      vault: config.name,
      userAddress,
      currentRound: currentRound.toString(),
      queuedWithdrawal: queuedWithdrawal?.toString() || '0',
      claimableWithdrawal: claimableWithdrawal?.toString() || '0',
      hasQueued: !!(queuedWithdrawal && queuedWithdrawal > 0n),
      hasClaimable: !!(claimableWithdrawal && claimableWithdrawal > 0n),
    });
  }

  // Write contract hooks for transactions
  const { writeContract: claimRewards, isPending: isClaimingRewards } = useWriteContract();

  // Claim rewards function - unified for both Metro and Shadow vaults
  const handleClaimRewards = () => {
    if (!userAddress || !config.vaultAddress || !pendingRewards || pendingRewards.length === 0) return;
    
    claimRewards({
      address: config.vaultAddress as `0x${string}`,
      abi: isShadowVault ? SHADOW_VAULT_ABI : METRO_VAULT_ABI,
      functionName: 'claim',
    });
  };

  const { writeContract: redeemWithdrawal, isPending: isRedeemingWithdrawal } = useWriteContract();

  const handleRedeemWithdrawal = () => {
    if (!userAddress || currentRound === undefined || currentRound === 0n) return;
    
    // Claim from previous round (currentRound - 1)
    redeemWithdrawal({
      address: config.vaultAddress as `0x${string}`,
      abi: METRO_VAULT_ABI,
      functionName: 'redeemQueuedWithdrawal',
      args: [currentRound - 1n, userAddress as `0x${string}`],
    });
  };

  return {
    userShares,
    pendingRewards,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
  };
}
