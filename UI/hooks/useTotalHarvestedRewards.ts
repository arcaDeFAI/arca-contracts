import { useState, useEffect, useMemo } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { usePrices } from '@/contexts/PriceContext';
import { CONTRACTS } from '@/lib/contracts';

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

const STORAGE_KEY_PREFIX = 'user_harvested_v2_';

/**
 * Fetches and caches all Harvested events for a specific user since their first deposit
 * This tracks the actual rewards claimed/harvested by the user
 */
export function useTotalHarvestedRewards(
  vaultAddress: string,
  userAddress?: string,
  deprecatedTokenPrice?: number // Kept for signature compatibility but ignored in favor of global prices
) {
  const [events, setEvents] = useState<HarvestEvent[]>([]);
  const [firstHarvestTimestamp, setFirstHarvestTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const publicClient = usePublicClient();
  const { prices } = usePrices();

  // Calculate total USD based on current prices and events
  const totalHarvestedUSD = useMemo(() => {
    if (!events.length || !prices) return 0;

    return events.reduce((sum, event) => {
      const amount = Number(event.amount) / (10 ** 18);
      const tokenAddr = event.token.toLowerCase();

      let price = 0;
      if (tokenAddr === CONTRACTS.METRO.toLowerCase()) price = prices.metro || 0;
      else if (tokenAddr === CONTRACTS.SHADOW.toLowerCase()) price = prices.shadow || 0;
      else if (tokenAddr === CONTRACTS.xSHADOW.toLowerCase()) price = prices.xShadow || 0;
      else if (tokenAddr === '0x0000000000000000000000000000000000000000' || tokenAddr === 's') price = prices.sonic || 0;
      else if (tokenAddr === CONTRACTS.WS.toLowerCase()) price = prices.sonic || 0;

      return sum + (amount * price);
    }, 0);
  }, [events, prices]);

  useEffect(() => {
    if (!publicClient || !vaultAddress || !userAddress) {
      setIsLoading(false);
      setEvents([]);
      setFirstHarvestTimestamp(null);
      return;
    }

    let isMounted = true;

    const fetchAndCacheHarvests = async () => {
      try {
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
            if (isMounted) {
              setEvents(cachedData.events);
              setFirstHarvestTimestamp(cachedData.firstEventTimestamp);
            }
          } catch (err) {
            // Cache parsing failed
          }
        }

        const now = Date.now();
        const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for faster updates

        // Only fetch if cache is stale or empty
        if (now - cachedData.lastFetch < CACHE_DURATION && cachedData.events.length > 0) {
          setIsLoading(false);
          return;
        }

        if (isMounted) setIsLoading(true);

        // Fetch new events
        const currentBlock = await publicClient.getBlockNumber();

        // Baseline block to avoid scanning 50M+ empty blocks.
        // Block 40,000,000 is safely before the November launch/migration period.
        const ARCA_START_BLOCK = 45000000n;

        const lastCachedBlock = cachedData.events.length > 0
          ? BigInt(cachedData.events[cachedData.events.length - 1].blockNumber)
          : 0n;

        const actualFromBlock = lastCachedBlock > 0n ? lastCachedBlock + 1n : ARCA_START_BLOCK;

        if (actualFromBlock > currentBlock) {
          if (isMounted) setIsLoading(false);
          return;
        }

        // Parallel chunked fetching
        const CHUNK_SIZE = 500000n;
        const chunks: { start: bigint; end: bigint }[] = [];
        for (let start = actualFromBlock; start <= currentBlock; start += CHUNK_SIZE) {
          const end = start + CHUNK_SIZE - 1n < currentBlock ? start + CHUNK_SIZE - 1n : currentBlock;
          chunks.push({ start, end });
        }

        const allLogs: any[] = [];
        const BATCH_SIZE = 5; // 5 chunks in parallel

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          if (!isMounted) break;
          const batch = chunks.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(batch.map(async (chunk) => {
            try {
              return await publicClient.getLogs({
                address: vaultAddress as `0x${string}`,
                event: HARVEST_ABI[0],
                args: { user: userAddress as `0x${string}` },
                fromBlock: chunk.start,
                toBlock: chunk.end,
              });
            } catch (e) {
              console.warn(`Chunk failed: ${chunk.start}-${chunk.end}`, e);
              return [];
            }
          }));

          batchResults.forEach(logs => allLogs.push(...logs));

          // Small delay between batches to respect rate limits
          if (i + BATCH_SIZE < chunks.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }

        const logs = allLogs;

        if (!isMounted) return;

        // Convert logs to events
        const newEventsBatch = await Promise.all(
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

        const allEvents = [...cachedData.events, ...newEventsBatch];

        // Deduplicate and Sort
        const seen = new Set();
        const uniqueEvents = allEvents.filter(e => {
          const key = `${e.blockNumber}-${e.amount}-${e.token}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).sort((a, b) => a.timestamp - b.timestamp);

        const firstTimestamp = uniqueEvents.length > 0
          ? uniqueEvents[0].timestamp
          : null;

        // Save to cache
        localStorage.setItem(storageKey, JSON.stringify({
          events: uniqueEvents,
          firstEventTimestamp: firstTimestamp,
          lastFetch: now,
        }));

        if (isMounted) {
          setEvents(uniqueEvents);
          setFirstHarvestTimestamp(firstTimestamp);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Failed to fetch harvested rewards:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAndCacheHarvests();

    // Refresh every 5 minutes
    const interval = setInterval(fetchAndCacheHarvests, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, userAddress]);

  return { totalHarvestedUSD, firstHarvestTimestamp, isLoading };
}
