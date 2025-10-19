'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const HARVEST_ABI = parseAbi([
  'event Harvested(address indexed user, address indexed token, uint256 amount)'
]);

/**
 * Fetches Harvest events and calculates 24h APY
 * Non-blocking - returns 0 if there are any errors
 */
export function useHarvestAPY(
  vaultAddress: string,
  userBalanceUSD: number,
  tokenPrice: number
) {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    // Skip if no data or client
    if (!publicClient || !vaultAddress || !userBalanceUSD || !tokenPrice) {
      setApy(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchHarvestAPY = async () => {
      try {
        setIsLoading(true);

        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Calculate blocks for last 24 hours (Sonic: ~1 second per block)
        const blocksPerDay = 86400n;
        const fromBlock = currentBlock > blocksPerDay ? currentBlock - blocksPerDay : 0n;

        // Fetch Harvest events
        const logs = await publicClient.getLogs({
          address: vaultAddress as `0x${string}`,
          event: HARVEST_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        });

        if (!isMounted) return;

        // Calculate total rewards in last 24h
        const totalRewardsToken = logs.reduce(
          (sum, log) => sum + Number(log.args.amount || 0n) / (10 ** 18),
          0
        );

        const totalRewardsUSD = totalRewardsToken * tokenPrice;

        // Calculate APY: (24h rewards / balance) * 365 * 100
        if (totalRewardsUSD > 0 && userBalanceUSD > 0) {
          const dailyReturn = totalRewardsUSD / userBalanceUSD;
          const annualReturn = dailyReturn * 365;
          const calculatedAPY = annualReturn * 100;

          if (isMounted) {
            setApy(Math.max(0, calculatedAPY));
          }
        } else {
          if (isMounted) {
            setApy(0);
          }
        }
      } catch (err) {
        // Silently fail - just return 0 APY
        console.warn('Harvest APY calculation failed:', err);
        if (isMounted) {
          setApy(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchHarvestAPY();

    // Refresh every 5 minutes
    const interval = setInterval(fetchHarvestAPY, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, userBalanceUSD, tokenPrice]);

  return { apy, isLoading };
}
