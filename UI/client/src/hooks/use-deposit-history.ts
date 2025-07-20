
import { useReadContract, useWatchContractEvent } from 'wagmi';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { VAULT_ABI } from '@/lib/contracts';

export interface DepositEvent {
  vaultAddress: string;
  amount: bigint;
  timestamp: number;
  blockNumber: number;
}

export function useDepositHistory(vaultAddress: string) {
  const { address } = useAccount();
  const [deposits, setDeposits] = useState<DepositEvent[]>([]);

  // Watch for new deposit events
  useWatchContractEvent({
    address: vaultAddress as `0x${string}`,
    abi: VAULT_ABI,
    eventName: 'Deposit',
    onLogs: (logs) => {
      logs.forEach((log) => {
        if (log.args.from?.toLowerCase() === address?.toLowerCase()) {
          const newDeposit: DepositEvent = {
            vaultAddress,
            amount: log.args.shares || 0n,
            timestamp: Date.now(),
            blockNumber: Number(log.blockNumber),
          };
          setDeposits(prev => [...prev, newDeposit]);
        }
      });
    },
    enabled: !!address && !!vaultAddress,
  });

  // Calculate total deposited amount in USD
  const totalDeposited = deposits.reduce((sum, deposit) => {
    // Convert shares to USD value at time of deposit
    // This is simplified - in reality you'd need historical price data
    const sharesAsNumber = Number(deposit.amount) / 1e18;
    const estimatedUsdValue = sharesAsNumber * 1.0; // $1 per share at deposit
    return sum + estimatedUsdValue;
  }, 0);

  return {
    deposits,
    totalDeposited,
    depositCount: deposits.length,
  };
}
