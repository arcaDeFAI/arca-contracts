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

  // Get pending rewards for both Metro and Shadow vaults using getPendingRewards
  const { data: pendingRewards } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getPendingRewards',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress && !!config.vaultAddress,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  // Debug log pending rewards
  console.log(`🔍 ${config.name} getPendingRewards:`, {
    vaultAddress: config.vaultAddress,
    userAddress,
    pendingRewards,
    raw: JSON.stringify(pendingRewards, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
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

  // Claim rewards function - use claim() for both Shadow and Metro
  const handleClaimRewards = () => {
    if (!userAddress) return;
    
    if (config.name.includes('Shadow')) {
      // Shadow vault claiming - call claim() on Shadow Vault address using Metro ABI
      if (!config.vaultAddress) return;
      
      console.log('🚀 SHADOW CLAIM - Calling claim() on Shadow Vault:', {
        shadowVaultAddress: config.vaultAddress
      });
      
      claimRewards({
        address: config.vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'claim',
      });
    } else {
      // Metro vault claiming - call claim() on vault
      if (!config.vaultAddress) return;
      
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
    currentRound,
    queuedWithdrawal,
    claimableWithdrawal,
    handleClaimRewards,
    isClaimingRewards,
    handleRedeemWithdrawal,
    isRedeemingWithdrawal,
  };
}
