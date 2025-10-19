'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const HARVEST_ABI = parseAbi([
  'event Harvested(address indexed user, address indexed token, uint256 amount)'
]);

// Local storage key for harvest events cache
const STORAGE_KEY_PREFIX = 'harvest_events_';

interface HarvestEvent {
  user: string;
  token: string;
  amount: bigint;
  blockNumber: bigint;
  timestamp: number;
}

interface CachedHarvestData {
  events: Array<{
    user: string;
    token: string;
    amount: string; // bigint as string for JSON
    blockNumber: string;
    timestamp: number;
  }>;
  lastFetch: number;
}

/**
 * Calculates vault-wide 24h APY based on all harvest events from all users
 * Stores events in localStorage to persist across refreshes
 */
export function useVaultWideAPY(
  vaultAddress: string,
  vaultTVL: number,
  tokenPrice: number
) {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !vaultAddress || !vaultTVL || !tokenPrice) {
      setApy(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const storageKey = `${STORAGE_KEY_PREFIX}${vaultAddress.toLowerCase()}`;

    const fetchAndCalculateAPY = async () => {
      try {
        setIsLoading(true);

        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        // Try to load cached events from localStorage
        let cachedEvents: HarvestEvent[] = [];
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed: CachedHarvestData = JSON.parse(cached);
            // Convert cached events back to proper format
            cachedEvents = parsed.events
              .filter(e => e.timestamp >= twentyFourHoursAgo)
              .map(e => ({
                user: e.user,
                token: e.token,
                amount: BigInt(e.amount),
                blockNumber: BigInt(e.blockNumber),
                timestamp: e.timestamp,
              }));
          }
        } catch (err) {
          console.warn('Failed to load cached harvest events:', err);
        }

        // Get current block
        const currentBlock = await publicClient.getBlockNumber();
        
        // Determine from which block to fetch new events
        let fromBlock: bigint;
        if (cachedEvents.length > 0) {
          // Fetch from the last cached block + 1
          const lastCachedBlock = cachedEvents[cachedEvents.length - 1].blockNumber;
          fromBlock = lastCachedBlock + 1n;
        } else {
          // Fetch last 24 hours (Sonic: ~1 second per block)
          const blocksPerDay = 86400n;
          fromBlock = currentBlock > blocksPerDay ? currentBlock - blocksPerDay : 0n;
        }

        // Fetch new harvest events
        let newEvents: HarvestEvent[] = [];
        if (fromBlock <= currentBlock) {
          const logs = await publicClient.getLogs({
            address: vaultAddress as `0x${string}`,
            event: HARVEST_ABI[0],
            fromBlock,
            toBlock: currentBlock,
          });

          // Parse new events with timestamps
          newEvents = await Promise.all(
            logs.map(async (log) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                user: log.args.user as string,
                token: log.args.token as string,
                amount: log.args.amount as bigint,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp) * 1000,
              };
            })
          );
        }

        if (!isMounted) return;

        // Combine cached and new events
        const allEvents = [...cachedEvents, ...newEvents];
        
        // Filter to only last 24 hours
        const recentEvents = allEvents.filter(e => e.timestamp >= twentyFourHoursAgo);

        // Save to localStorage
        try {
          const cacheData: CachedHarvestData = {
            events: recentEvents.map(e => ({
              user: e.user,
              token: e.token,
              amount: e.amount.toString(),
              blockNumber: e.blockNumber.toString(),
              timestamp: e.timestamp,
            })),
            lastFetch: now,
          };
          localStorage.setItem(storageKey, JSON.stringify(cacheData));
        } catch (err) {
          console.warn('Failed to cache harvest events:', err);
        }

        // Calculate total rewards harvested in the time period
        const totalRewardsToken = recentEvents.reduce(
          (sum, event) => sum + Number(event.amount) / (10 ** 18),
          0
        );

        const totalRewardsUSD = totalRewardsToken * tokenPrice;

        // Calculate time range
        const oldestEventTime = recentEvents.length > 0 
          ? Math.min(...recentEvents.map(e => e.timestamp))
          : twentyFourHoursAgo;
        
        const timeRangeHours = (now - oldestEventTime) / (1000 * 60 * 60);

        // Extrapolate to 24 hours if we have less than 24 hours of data
        let extrapolatedRewardsUSD = totalRewardsUSD;
        if (timeRangeHours > 0 && timeRangeHours < 24) {
          extrapolatedRewardsUSD = (totalRewardsUSD / timeRangeHours) * 24;
          console.log(`📊 Extrapolating ${timeRangeHours.toFixed(1)}h to 24h: $${totalRewardsUSD.toFixed(2)} → $${extrapolatedRewardsUSD.toFixed(2)}`);
        }

        // Calculate APY: (24h rewards / TVL) * 365 * 100
        if (extrapolatedRewardsUSD > 0 && vaultTVL > 0) {
          const dailyReturn = extrapolatedRewardsUSD / vaultTVL;
          const annualReturn = dailyReturn * 365;
          const calculatedAPY = annualReturn * 100;

          console.log(`📈 Vault-Wide APY for ${vaultAddress}:`, {
            events: recentEvents.length,
            timeRangeHours: timeRangeHours.toFixed(1),
            totalRewardsUSD: totalRewardsUSD.toFixed(2),
            extrapolatedRewardsUSD: extrapolatedRewardsUSD.toFixed(2),
            vaultTVL: vaultTVL.toFixed(2),
            apy: calculatedAPY.toFixed(2) + '%'
          });

          if (isMounted) {
            setApy(Math.max(0, calculatedAPY));
          }
        } else {
          if (isMounted) {
            setApy(0);
          }
        }
      } catch (err) {
        console.warn('Vault-wide APY calculation failed:', err);
        if (isMounted) {
          setApy(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAndCalculateAPY();

    // Refresh every 5 minutes
    const interval = setInterval(fetchAndCalculateAPY, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, vaultAddress, vaultTVL, tokenPrice]);

  return { apy, isLoading };
}
