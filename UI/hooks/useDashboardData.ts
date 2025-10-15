'use client';

import { useReadContract, useWriteContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, VOTER_CLAIM_ABI, SHADOW_REWARDS_ABI } from '@/lib/typechain';
import { CONTRACTS } from '../lib/contracts';

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

  // Metro vault pending rewards
  const { data: pendingRewards } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getPendingRewards',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress && !isShadowVault,
    },
  });

  // For Shadow vaults, get position tokenID first
  const { data: shadowPosition } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getPosition',
    query: {
      enabled: !!config.stratAddress && isShadowVault,
    },
  });

  const shadowTokenId = shadowPosition?.[0];

  // Get earned rewards for xSHADOW token
  const { data: xShadowEarned } = useReadContract({
    address: CONTRACTS.SHADOW_REWARDS as `0x${string}`,
    abi: SHADOW_REWARDS_ABI,
    functionName: 'earned',
    args: [CONTRACTS.xSHADOW as `0x${string}`, shadowTokenId || 0n],
    query: {
      enabled: !!shadowTokenId && isShadowVault,
    },
  });

  // Get earned rewards for SHADOW token
  const { data: shadowEarned } = useReadContract({
    address: CONTRACTS.SHADOW_REWARDS as `0x${string}`,
    abi: SHADOW_REWARDS_ABI,
    functionName: 'earned',
    args: [CONTRACTS.SHADOW as `0x${string}`, shadowTokenId || 0n],
    query: {
      enabled: !!shadowTokenId && isShadowVault,
    },
  });

  // Get reward status for Shadow vaults (needed for gauge address and claim logic)
  const { data: shadowRewardStatus } = useReadContract({
    address: config.stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI as any,
    functionName: 'getRewardStatus',
    query: {
      enabled: !!config.stratAddress && isShadowVault,
    },
  });


  // Debug Shadow reward status
  if (isShadowVault) {
    console.log('🔍 SHADOW REWARD STATUS (Hook):', {
      vaultName: config.name,
      stratAddress: config.stratAddress,
      shadowPosition,
      shadowTokenId: shadowTokenId?.toString(),
      xShadowEarned: xShadowEarned?.toString(),
      shadowEarned: shadowEarned?.toString(),
      shadowRewardStatus: shadowRewardStatus ? {
        tokens: (shadowRewardStatus as any)[0],
        earned: (shadowRewardStatus as any)[1]?.map((e: bigint) => e.toString()),
        gauge: (shadowRewardStatus as any)[2],
        hasActivePosition: (shadowRewardStatus as any)[3]
      } : 'no data',
      hasActivePosition: !!shadowTokenId,
    });
  }

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


  console.log(`🔍 Dashboard ${config.name}:`, {
    userAddress,
    userShares: userShares?.toString(),
    pendingRewards: pendingRewards?.length || 0,
    currentRound: currentRound?.toString(),
    queuedWithdrawal: queuedWithdrawal?.toString(),
    claimableWithdrawal: claimableWithdrawal?.toString(),
  });

  // Write contract hooks for transactions
  const { writeContract: claimRewards, isPending: isClaimingRewards } = useWriteContract();

  // Claim rewards function - different logic for Shadow vs Metro
  const handleClaimRewards = () => {
    if (!userAddress) return;
    
    if (config.name.includes('Shadow')) {
      // Shadow vault claiming - use harvestRewards function on Shadow Strat
      if (!config.stratAddress) return;
      
      console.log('🚀 SHADOW CLAIM - Calling harvestRewards on Shadow Strat:', {
        shadowStratAddress: config.stratAddress
      });
      
      claimRewards({
        address: config.stratAddress as `0x${string}`,
        abi: SHADOW_STRAT_ABI,
        functionName: 'harvestRewards',
      });
    } else {
      // Metro vault claiming - use normal claim function
      if (!config.vaultAddress || !pendingRewards || pendingRewards.length === 0) return;
      
      claimRewards({
        address: config.vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'claim',
      });
    }
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
    shadowPosition,
    shadowTokenId,
    xShadowEarned,
    shadowEarned,
    shadowRewardStatus,
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
  };
}
