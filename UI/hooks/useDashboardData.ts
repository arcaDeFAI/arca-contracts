'use client';

import { useReadContract, useWriteContract, useReadContracts, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import {
  METRO_VAULT_ABI,
  SHADOW_VAULT_ABI,
  SHADOW_STRAT_ABI
} from '@/lib/typechain';
import { type VaultConfig } from '@/lib/vaultConfigs';

export function useDashboardData(config: VaultConfig, userAddress?: string, sharePercentage?: number) {
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

  // Combine vault pending rewards + user's share of strategy gauge rewards
  const pendingRewards = useMemo(() => {
    if (!vaultPendingRewards) return vaultPendingRewards;
    if (!isShadowVault || !strategyRewardStatus || !sharePercentage || sharePercentage === 0) {
      return vaultPendingRewards;
    }

    const earned = (strategyRewardStatus as any)[1] as readonly bigint[];
    const userShareRatio = sharePercentage / 100;

    // Add user's share of gauge rewards to vault pending rewards
    return (vaultPendingRewards as any[]).map((vaultReward: any, i: number) => ({
      ...vaultReward,
      pendingRewards: vaultReward.pendingRewards + BigInt(Math.floor(Number(earned[i] || 0n) * userShareRatio))
    }));
  }, [vaultPendingRewards, strategyRewardStatus, sharePercentage, isShadowVault]);


  // Get current round
  const { data: currentRound } = useReadContract({
    address: config.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getCurrentRound',
    query: {
      enabled: !!config.vaultAddress,
    },
  });

  // Debug logging for WS-WETH vault
  useEffect(() => {
    if (config.name.includes('WS • WETH')) {
      console.log('🔍 [WS-WETH Debug] Vault:', config.vaultAddress);
      console.log('🔍 [WS-WETH Debug] Current Round:', currentRound !== undefined ? Number(currentRound) : 'undefined');
      console.log('🔍 [WS-WETH Debug] Current Round (raw):', currentRound);
    }
  }, [currentRound, config.name, config.vaultAddress]);

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

  // Debug logging for queued withdrawal
  useEffect(() => {
    if (config.name.includes('WS • WETH')) {
      console.log('🔍 [WS-WETH Debug] User Address:', userAddress);
      console.log('🔍 [WS-WETH Debug] Queued Withdrawal (raw):', queuedWithdrawal);
      console.log('🔍 [WS-WETH Debug] Queued Withdrawal (number):', queuedWithdrawal ? Number(queuedWithdrawal) : 'none');
      console.log('🔍 [WS-WETH Debug] Query enabled:', !!userAddress && !!config.vaultAddress && currentRound !== undefined);
    }
  }, [queuedWithdrawal, userAddress, currentRound, config.name, config.vaultAddress]);

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

    // Debug logging for WS-WETH vault
    if (config.name.includes('WS • WETH')) {
      console.log('🔍 [WS-WETH Debug] Round scan results:', roundResults.length, 'rounds checked');
      console.log('🔍 [WS-WETH Debug] Claimable withdrawals found:', withdrawals.length);
      withdrawals.forEach(w => {
        console.log(`🔍 [WS-WETH Debug] - Round ${Number(w.round)}: ${Number(w.amount)} (raw: ${w.amount})`);
      });
    }

    setClaimableWithdrawals(withdrawals);
  }, [roundResults, currentRound, config.name]);

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
  const { writeContract: cancelWithdrawal, isPending: isCancellingWithdrawal } = useWriteContract();

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
    handleCancelWithdrawal,  // Cancel queued withdrawal
    isCancellingWithdrawal,
  };
}
