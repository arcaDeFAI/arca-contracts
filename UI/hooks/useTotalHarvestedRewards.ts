'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const HARVEST_ABI = parseAbi([
  'event Harvested(address indexed user, address indexed token, uint256 amount)'
]);

interface HarvestEvent {
  user: string;
  token: string;
  amount: string;
  blockNumber: string;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'user_harvested_';

/**
 * Fetches and caches all Harvested events for a specific user since their first deposit
 * This tracks the actual rewards claimed/harvested by the user
 * Resets when user has no balance in any vault
 */
export function useTotalHarvestedRewards(
  vaultAddress: string,
  userAddress?: string,
  tokenPrice?: number,
  hasBalance?: boolean
) {
  const [totalHarvestedUSD, setTotalHarvestedUSD] = useState(0);
  const [firstHarvestTimestamp, setFirstHarvestTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !vaultAddress || !userAddress) {
      setIsLoading(false);
      setTotalHarvestedUSD(0);
      setFirstHarvestTimestamp(null);
      return;
    }

    // If user has no balance, reset the cache
    if (hasBalance === false) {
      const storageKey = `${STORAGE_KEY_PREFIX}${vaultAddress.toLowerCase()}_${userAddress.toLowerCase()}`;
      localStorage.removeItem(storageKey);
      setTotalHarvestedUSD(0);
      setFirstHarvestTimestamp(null);
      return;
    }
    
    // If price not ready yet, keep loading state
    if (!tokenPrice) {
      setIsLoading(true);
      return;
    }

    let isMounted = true;

    const fetchAndCacheHarvests = async () => {
      try {
        setIsLoading(true);

        const storageKey = `${STORAGE_KEY_PREFIX}${vaultAddress.toLowerCase()}_${userAddress.toLowerCase()}`;
        
        // Load cached data
        let cachedData: { events: HarvestEvent[]; firstEventTimestamp: number | null; lastFetch: number } = {
          events: [],
          firstEventTimestamp: null,
          lastFetch: 0,
        };

        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            cachedData = JSON.parse(cached);
          } catch (err) {
            // Cache parsing failed, using empty data
          }
        }

        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        // Only fetch if cache is stale
        if (now - cachedData.lastFetch < CACHE_DURATION && cachedData.events.length > 0) {
          // Use cached data
          const totalTokens = cachedData.events.reduce((sum, event) => {
            return sum + (Number(event.amount) / (10 ** 18));
          }, 0);

          const totalUSD = totalTokens * tokenPrice;

          if (isMounted) {
            setTotalHarvestedUSD(totalUSD);
            setFirstHarvestTimestamp(cachedData.firstEventTimestamp);
            setIsLoading(false);
          }
          return;
        }

        // Fetch new events
        const currentBlock = await publicClient.getBlockNumber();
        
        // Get last cached block or start from 7 days ago
        const blocksPerWeek = 86400n * 7n;
        const lastCachedBlock = cachedData.events.length > 0
          ? BigInt(cachedData.events[cachedData.events.length - 1].blockNumber)
          : currentBlock > blocksPerWeek ? currentBlock - blocksPerWeek : 0n;

        const fromBlock = lastCachedBlock > 0n ? lastCachedBlock : 0n;

        // Fetch Harvested events for this specific user
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

        // Convert logs to events
        const newEvents = await Promise.all(
          logs.map(async (log) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            return {
              user: log.args.user as string,
              token: log.args.token as string,
              amount: (log.args.amount as bigint).toString(),
              blockNumber: log.blockNumber.toString(),
              timestamp: Number(block.timestamp) * 1000,
            };
          })
        );

        // Merge with cached events (avoid duplicates)
        const existingBlockNumbers = new Set(cachedData.events.map(e => e.blockNumber));
        const uniqueNewEvents = newEvents.filter(e => !existingBlockNumbers.has(e.blockNumber));
        const allEvents = [...cachedData.events, ...uniqueNewEvents];

        // Sort by timestamp
        allEvents.sort((a, b) => a.timestamp - b.timestamp);

        const firstTimestamp = allEvents.length > 0
          ? allEvents[0].timestamp
          : null;

        // Save to cache
        localStorage.setItem(storageKey, JSON.stringify({
          events: allEvents,
          firstEventTimestamp: firstTimestamp,
          lastFetch: now,
        }));

        // Calculate total
        const totalTokens = allEvents.reduce((sum, event) => {
          return sum + (Number(event.amount) / (10 ** 18));
        }, 0);

        const totalUSD = totalTokens * tokenPrice;

        if (isMounted) {
          setTotalHarvestedUSD(totalUSD);
          setFirstHarvestTimestamp(firstTimestamp);
        }
      } catch (err) {
        console.warn('Failed to fetch harvested rewards:', err);
        if (isMounted) {
          setTotalHarvestedUSD(0);
          setFirstHarvestTimestamp(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAndCacheHarvests();

    // Refresh every 5 minutes
    const interval = setInterval(fetchAndCacheHarvests, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, userAddress, tokenPrice, hasBalance]);

  return { totalHarvestedUSD, firstHarvestTimestamp, isLoading };
}
