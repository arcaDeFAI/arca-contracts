'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const HARVEST_ABI = parseAbi([
  'event Harvested(address indexed user, address indexed token, uint256 amount)'
]);

interface HarvestedReward {
  token: string;
  totalAmount: number;
}

/**
 * Fetches total harvested rewards for a user from Harvest events
 * Returns cumulative rewards that don't reset when claimed
 */
export function useHarvestedRewards(
  vaultAddress: string,
  userAddress?: string
) {
  const [harvestedRewards, setHarvestedRewards] = useState<HarvestedReward[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    // Skip if no data or client
    if (!publicClient || !vaultAddress || !userAddress) {
      setHarvestedRewards([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchHarvestedRewards = async () => {
      try {
        setIsLoading(true);

        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Fetch ALL Harvest events for this user from the beginning
        // You may want to set a reasonable fromBlock based on when the vault was deployed
        const fromBlock = 0n; // Or set to vault deployment block

        const logs = await publicClient.getLogs({
          address: vaultAddress as `0x${string}`,
          event: HARVEST_ABI[0],
          args: {
            user: userAddress as `0x${string}`
          },
          fromBlock,
          toBlock: currentBlock,
        });

        if (!isMounted) return;

        // Aggregate rewards by token
        const rewardsByToken = new Map<string, number>();

        logs.forEach(log => {
          const token = log.args.token as string;
          const amount = Number(log.args.amount || 0n) / (10 ** 18);
          
          const existing = rewardsByToken.get(token) || 0;
          rewardsByToken.set(token, existing + amount);
        });

        // Convert to array
        const rewards: HarvestedReward[] = Array.from(rewardsByToken.entries()).map(
          ([token, totalAmount]) => ({ token, totalAmount })
        );

        if (isMounted) {
          setHarvestedRewards(rewards);
        }
      } catch (err) {
        console.warn('Failed to fetch harvested rewards:', err);
        if (isMounted) {
          setHarvestedRewards([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchHarvestedRewards();

    // Refresh every 30 seconds (when user might claim)
    const interval = setInterval(fetchHarvestedRewards, 30 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, userAddress]);

  return { harvestedRewards, isLoading };
}
