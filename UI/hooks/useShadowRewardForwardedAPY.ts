import { useState, useEffect, useMemo } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const REWARD_FORWARDED_ABI = parseAbi([
  'event RewardForwarded(address indexed token, address indexed vault, uint256 amount)'
]);

const STORAGE_KEY_PREFIX = 'shadow_forwarded_';

interface CachedData {
  events: Array<{
    token: string;
    vault: string;
    amount: string;
    blockNumber: string;
    timestamp: number;
  }>;
  firstEventTimestamp: number | null;
  lastFetch: number;
}

/**
 * Helper to calculate APY from events
 */
const calculateAPYFromEvents = (eventsList: CachedData['events'], currentTVL: number, currentPrice: number) => {
  if (eventsList.length > 0 && currentTVL > 0 && currentPrice > 0) {
    // Take last few events (up to 10) for better average
    const lastFewEvents = eventsList.slice(-10);

    if (lastFewEvents.length >= 2) {
      const recentTokens = lastFewEvents.reduce((sum, event) => {
        return sum + (Number(event.amount) / (10 ** 18));
      }, 0);
      const recentRewardUSD = recentTokens * currentPrice;

      const oldestTimestamp = Math.min(...lastFewEvents.map(e => e.timestamp));
      const newestTimestamp = Math.max(...lastFewEvents.map(e => e.timestamp));
      const timeSpan = newestTimestamp - oldestTimestamp;

      // Minimum 1 hour timespan to avoid infinity with identical timestamps
      const daysSpan = Math.max(timeSpan / (1000 * 60 * 60 * 24), 0.04);

      const dailyRewardRate = recentRewardUSD / daysSpan;
      const annualRewardUSD = dailyRewardRate * 365;
      const calculatedAPY = (annualRewardUSD / currentTVL) * 100;

      return Math.max(0, calculatedAPY);
    }
  }
  return 0;
};

/**
 * Calculates Shadow vault APY natively via RPC from Forwarded Rewards
 */
export function useShadowRewardForwardedAPY(
  stratAddress: string,
  rewardTokenAddress: string,
  vaultAddress: string,
  vaultTVL: number,
  rewardPrice: number
) {
  const [events, setEvents] = useState<CachedData['events']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedFromCache, setHasLoadedFromCache] = useState(false);

  const publicClient = usePublicClient();
  const storageKey = `${STORAGE_KEY_PREFIX}${stratAddress.toLowerCase()}`;

  // Re-calculate APY whenever events, TVL, or Price changes
  const apy = useMemo(() => {
    return calculateAPYFromEvents(events, vaultTVL, rewardPrice);
  }, [events, vaultTVL, rewardPrice]);

  useEffect(() => {
    if (!stratAddress || !rewardTokenAddress || !vaultAddress || !publicClient) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAndCalculateAPY = async (isInitial = false) => {
      if (!isMounted) return;

      // Stagger initial fetch to avoid RPC rate limits
      if (isInitial) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        if (!isMounted) return;
      }

      // Load from cache first
      let cachedData: CachedData = {
        events: [],
        firstEventTimestamp: null,
        lastFetch: 0,
      };

      let hasValidCache = false;
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.events && parsed.events.length > 0) {
            cachedData = parsed;
            hasValidCache = true;
          }
        } catch (err) { }
      }

      if (hasValidCache && isMounted) {
        setEvents(cachedData.events);
        setIsLoading(false);
        setHasLoadedFromCache(true);
      } else {
        if (isMounted) setIsLoading(true);
      }

      try {
        const now = Date.now();
        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerDay = 216000n; // Sonic (avg 0.4s blocks)
        const lookbackBlocks = blocksPerDay * 30n; // 30 days lookback
        const fromBlockLimit = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n;

        const lastCachedBlock = cachedData.events.length > 0
          ? BigInt(cachedData.events[cachedData.events.length - 1].blockNumber)
          : 0n;

        const actualFromBlock = lastCachedBlock > fromBlockLimit ? lastCachedBlock + 1n : fromBlockLimit;

        if (actualFromBlock > currentBlock) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const CHUNK_SIZE = 500000n;
        const chunks: { start: bigint; end: bigint }[] = [];
        for (let start = actualFromBlock; start <= currentBlock; start += CHUNK_SIZE) {
          const end = start + CHUNK_SIZE - 1n < currentBlock ? start + CHUNK_SIZE - 1n : currentBlock;
          chunks.push({ start, end });
        }

        const allLogs: any[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          if (!isMounted) break;
          const batch = chunks.slice(i, i + BATCH_SIZE);

          const results = await Promise.all(batch.map(async (chunk) => {
            try {
              return await publicClient.getLogs({
                address: stratAddress as `0x${string}`,
                event: REWARD_FORWARDED_ABI[0],
                args: { token: rewardTokenAddress as `0x${string}`, vault: vaultAddress as `0x${string}` },
                fromBlock: chunk.start,
                toBlock: chunk.end,
              });
            } catch (e) {
              console.warn("Log fetch failed for range", chunk.start, chunk.end);
              return [];
            }
          }));

          results.forEach(logs => allLogs.push(...logs));
        }

        if (!isMounted) return;

        if (allLogs.length > 0) {
          const recentLogs = allLogs.slice(-10);

          const newEvents = await Promise.all(
            recentLogs.map(async (log: any) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                token: log.args.token as string,
                vault: log.args.vault as string,
                amount: (log.args.amount as bigint).toString(),
                blockNumber: log.blockNumber.toString(),
                timestamp: Number(block.timestamp) * 1000,
              };
            })
          );

          const existingKeys = new Set(cachedData.events.map(e => `${e.blockNumber}-${e.amount}`));
          const uniqueNewEvents = newEvents.filter(e => !existingKeys.has(`${e.blockNumber}-${e.amount}`));

          const allEvents = [...cachedData.events, ...uniqueNewEvents]
            .sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)))
            .slice(-50);

          localStorage.setItem(storageKey, JSON.stringify({
            events: allEvents,
            firstEventTimestamp: allEvents[0]?.timestamp || null,
            lastFetch: now,
          }));

          if (isMounted) {
            setEvents(allEvents);
          }
        } else if (isMounted && cachedData.events.length > 0) {
          setEvents(cachedData.events);
        }
      } catch (err) {
        console.warn("Failed fetch for", stratAddress, err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAndCalculateAPY(true);

    const unwatch = publicClient.watchEvent({
      address: stratAddress as `0x${string}`,
      event: REWARD_FORWARDED_ABI[0],
      args: { token: rewardTokenAddress as `0x${string}`, vault: vaultAddress as `0x${string}` },
      onLogs: () => {
        if (isMounted) fetchAndCalculateAPY();
      }
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, [publicClient, stratAddress, rewardTokenAddress, vaultAddress]);

  return { apy, isLoading };
}
