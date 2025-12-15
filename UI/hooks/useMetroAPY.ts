'use client';

import { useState, useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

const STORAGE_KEY_PREFIX = 'metro_transfers_';

interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
  blockNumber: bigint;
  timestamp: number;
}

interface CachedData {
  events: Array<{
    from: string;
    to: string;
    value: string;
    blockNumber: string;
    timestamp: number;
  }>;
  firstEventTimestamp: number | null;
  lastFetch: number;
}

/**
 * Calculates Metro vault APY from accumulated historical rewards
 */
export function useMetroAPY(
  stratAddress: string,
  metroTokenAddress: string,
  vaultTVL: number,
  metroPrice: number
) {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Default to true, but we'll manage it carefully
  const [hasLoadedFromCache, setHasLoadedFromCache] = useState(false);

  const publicClient = usePublicClient();

  // Use refs to hold latest values of TVL and Price to access them inside the effect
  const vaultTVLRef = useRef(vaultTVL);
  const metroPriceRef = useRef(metroPrice);

  useEffect(() => {
    vaultTVLRef.current = vaultTVL;
    metroPriceRef.current = metroPrice;
  }, [vaultTVL, metroPrice]);

  useEffect(() => {
    if (!stratAddress) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const storageKey = `${STORAGE_KEY_PREFIX}${stratAddress.toLowerCase()}`;

    const calculateAPYFromEvents = (events: CachedData['events'], currentTVL: number, currentPrice: number) => {
      if (events.length > 0 && currentTVL > 0 && currentPrice > 0) {
        // Take last few events (ex: 5)
        const lastFewEvents = events.slice(-5);

        if (lastFewEvents.length >= 2) {
          const recentTokens = lastFewEvents.reduce((sum, event) => {
            return sum + (Number(event.value) / (10 ** 18));
          }, 0);
          const recentRewardUSD = recentTokens * currentPrice;

          const oldestTimestamp = Math.min(...lastFewEvents.map(e => e.timestamp));
          const newestTimestamp = Math.max(...lastFewEvents.map(e => e.timestamp));
          const timeSpan = newestTimestamp - oldestTimestamp;
          const daysSpan = Math.max(timeSpan / (1000 * 60 * 60 * 24), 0.01);

          const dailyRewardRate = recentRewardUSD / daysSpan;
          const annualRewardUSD = dailyRewardRate * 365;
          const calculatedAPY = (annualRewardUSD / currentTVL) * 100;

          return Math.max(0, calculatedAPY);
        }
      }
      return 0;
    };

    const fetchAndCalculateAPY = async () => {
      const currentTVL = vaultTVLRef.current;
      const currentPrice = metroPriceRef.current;

      if (!publicClient) return;

      // 1. Attempt to load from cache synchronously (or asap)
      let cachedData: CachedData = {
        events: [],
        firstEventTimestamp: null,
        lastFetch: 0,
      };

      let hasValidCache = false;
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          cachedData = JSON.parse(cached);
          if (cachedData.events && cachedData.events.length > 0) {
            hasValidCache = true;
          }
        } catch (err) {
          // Cache parsing failed
        }
      }

      // 2. If we have cache, calculate and display immediately
      // Only set isLoading to true if we DON'T have cache
      if (hasValidCache && currentTVL && currentPrice) {
        const cachedAPY = calculateAPYFromEvents(cachedData.events, currentTVL, currentPrice);
        if (isMounted) {
          setApy(cachedAPY);
          setIsLoading(false); // Show data immediately
          setHasLoadedFromCache(true);
        }
      } else {
        if (isMounted) setIsLoading(true);
      }

      // 3. Background fetch for new logs
      try {
        const now = Date.now();
        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerDay = 86400n; // Assuming 1s block time roughly? Or just seconds. 
        // Metric is block based. 
        // Initial lookback: Reduce to 3 days to speed up "first load" if no cache.
        const lookbackBlocks = blocksPerDay * 3n;
        const fromBlock = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n;

        // Optimized: If we have cache, start from last cached block + 1
        const lastCachedBlock = cachedData.events.length > 0
          ? BigInt(cachedData.events[cachedData.events.length - 1].blockNumber)
          : 0n;

        const actualFromBlock = lastCachedBlock > fromBlock ? lastCachedBlock + 1n : fromBlock;

        // If up to date, skip fetch
        if (actualFromBlock > currentBlock) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const CHUNK_SIZE = 20000n;
        const chunks: { start: bigint; end: bigint }[] = [];

        for (let start = actualFromBlock; start <= currentBlock; start += CHUNK_SIZE) {
          const end = start + CHUNK_SIZE - 1n < currentBlock ? start + CHUNK_SIZE - 1n : currentBlock;
          chunks.push({ start, end });
        }

        const allLogs: any[] = [];
        const BATCH_SIZE = 5; // Fetch 5 chunks in parallel

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          if (!isMounted) break;

          const results = await Promise.all(batch.map(async ({ start, end }) => {
            try {
              return await publicClient.getLogs({
                address: metroTokenAddress as `0x${string}`,
                event: TRANSFER_ABI[0],
                args: {
                  to: stratAddress as `0x${string}`,
                },
                fromBlock: start,
                toBlock: end,
              });
            } catch (chunkError) {
              console.warn(`Failed to fetch logs for chunk ${start}-${end}`, chunkError);
              return [];
            }
          }));

          results.forEach(logs => allLogs.push(...logs));
        }

        const logs = allLogs;

        if (!isMounted) return;

        if (logs.length > 0) {
          const newEvents = await Promise.all(
            logs.map(async (log: any) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                from: log.args.from as string,
                to: log.args.to as string,
                value: (log.args.value as bigint).toString(),
                blockNumber: log.blockNumber.toString(),
                timestamp: Number(block.timestamp) * 1000,
              };
            })
          );

          // Merge and Deduplicate
          const existingBlockNumbers = new Set(cachedData.events.map(e => e.blockNumber));
          const uniqueNewEvents = newEvents.filter(e => !existingBlockNumbers.has(e.blockNumber));
          const allEvents = [...cachedData.events, ...uniqueNewEvents];

          // Sort by block number to be safe
          allEvents.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)));

          const firstTimestamp = allEvents.length > 0
            ? Math.min(...allEvents.map(e => e.timestamp))
            : null;

          localStorage.setItem(storageKey, JSON.stringify({
            events: allEvents,
            firstEventTimestamp: firstTimestamp,
            lastFetch: now,
          }));

          // Recalculate with new events
          if (currentTVL && currentPrice) {
            const newAPY = calculateAPYFromEvents(allEvents, currentTVL, currentPrice);
            if (isMounted) {
              setApy(newAPY);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching Metro APY logs", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAndCalculateAPY();
    const interval = setInterval(fetchAndCalculateAPY, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, stratAddress, metroTokenAddress]); // Deps kept minimal

  return { apy, isLoading };
}
