'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const HARVEST_ABI = parseAbi([
  'event Harvested(address indexed user, address indexed token, uint256 amount)'
]);

/**
 * Fetches harvested rewards from the last 24 hours for calculating % change
 * Returns total USD value of rewards harvested in last 24h
 */
export function use24hHarvestedRewards(
  vaultAddress: string,
  userAddress?: string,
  tokenPrice?: number
) {
  const [harvested24hUSD, setHarvested24hUSD] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !vaultAddress || !userAddress || !tokenPrice) {
      setHarvested24hUSD(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetch24hHarvests = async () => {
      try {
        setIsLoading(true);

        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Calculate blocks for last 24 hours (Sonic: ~1 second per block)
        const blocksPerDay = 86400n;
        const fromBlock = currentBlock > blocksPerDay ? currentBlock - blocksPerDay : 0n;

        // Fetch Harvest events for this user in last 24h
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

        // Calculate total rewards harvested in last 24h
        const totalRewardsToken = logs.reduce(
          (sum, log) => sum + Number(log.args.amount || 0n) / (10 ** 18),
          0
        );

        const totalRewardsUSD = totalRewardsToken * tokenPrice;

        if (isMounted) {
          setHarvested24hUSD(totalRewardsUSD);
        }
      } catch (err) {
        console.warn('Failed to fetch 24h harvested rewards:', err);
        if (isMounted) {
          setHarvested24hUSD(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetch24hHarvests();

    // Refresh every 5 minutes
    const interval = setInterval(fetch24hHarvests, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, userAddress, tokenPrice]);

  return { harvested24hUSD, isLoading };
}
