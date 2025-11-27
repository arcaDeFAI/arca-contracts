'use client';

import { useReadContract, useWriteContract, useReadContracts, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useState } from 'react';
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

  // Scan ALL rounds for claimable withdrawals
  const [claimableWithdrawals, setClaimableWithdrawals] = useState<Array<{round: bigint, amount: bigint}>>([]);
  
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

    const withdrawals: Array<{round: bigint, amount: bigint}> = [];
    
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

  const { writeContract: redeemWithdrawal, data: redeemTxHash, isPending: isRedeemingWithdrawal } = useWriteContract();

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
      abi: METRO_VAULT_ABI,
      functionName: 'redeemQueuedWithdrawal',
      args: [round, userAddress as `0x${string}`],
    });
  };

  // Handle successful transaction and immediately remove from local state
  useEffect(() => {
    if (redeemTxSuccess && redeemTxHash && redeemTxHash !== processedTxHash && processingClaims && lastClaimedRound !== null) {
      // Mark this transaction as processed
      setProcessedTxHash(redeemTxHash);
      
      // Immediately remove the claimed withdrawal from local state
      setClaimableWithdrawals(prev => prev.filter(w => w.round !== lastClaimedRound));
      
      // Reset processing state
      setProcessingClaims(false);
      setLastClaimedRound(null);
    }
  }, [redeemTxSuccess, redeemTxHash, processedTxHash, processingClaims, lastClaimedRound]);

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
  };
}
