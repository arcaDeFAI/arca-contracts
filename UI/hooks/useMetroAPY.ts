'use client';

import { useState, useEffect } from 'react';
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

/**
 * Calculates Metro vault APY based on Transfer events to the strat address
 * Uses continuous accumulation: stores ALL historical events and calculates
 * average daily rewards over the entire period, then extrapolates to annual
 */
export function useMetroAPY(
  stratAddress: string,
  metroTokenAddress: string,
  vaultTVL: number,
  metroPrice: number
) {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !stratAddress || !metroTokenAddress || !vaultTVL || !metroPrice) {
      setApy(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const storageKey = `${STORAGE_KEY_PREFIX}${stratAddress.toLowerCase()}`;

    const fetchAndCalculateAPY = async () => {
      try {
        setIsLoading(true);

        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

        // Load ALL cached events (up to 1 year)
        let cachedEvents: TransferEvent[] = [];
        let firstEventTimestamp: number | null = null;
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            firstEventTimestamp = parsed.firstEventTimestamp || null;
            cachedEvents = parsed.events
              .filter((e: any) => e.timestamp >= oneYearAgo) // Keep up to 1 year
              .map((e: any) => ({
                from: e.from,
                to: e.to,
                value: BigInt(e.value),
                blockNumber: BigInt(e.blockNumber),
                timestamp: e.timestamp,
              }));
          }
        } catch (err) {
          console.warn('Failed to load cached Metro transfers:', err);
        }

        const currentBlock = await publicClient.getBlockNumber();
        
        let fromBlock: bigint;
        if (cachedEvents.length > 0) {
          fromBlock = cachedEvents[cachedEvents.length - 1].blockNumber + 1n;
        } else {
          const blocksPerDay = 86400n;
          fromBlock = currentBlock > blocksPerDay ? currentBlock - blocksPerDay : 0n;
        }

        // Fetch Transfer events TO the strat address
        let newEvents: TransferEvent[] = [];
        if (fromBlock <= currentBlock) {
          const logs = await publicClient.getLogs({
            address: metroTokenAddress as `0x${string}`,
            event: TRANSFER_ABI[0],
            args: {
              to: stratAddress as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          newEvents = await Promise.all(
            logs.map(async (log) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                from: log.args.from as string,
                to: log.args.to as string,
                value: log.args.value as bigint,
                blockNumber: log.blockNumber,
                timestamp: Number(block.timestamp) * 1000,
              };
            })
          );
        }

        if (!isMounted) return;

        const allEvents = [...cachedEvents, ...newEvents];
        
        // Track first event timestamp
        if (!firstEventTimestamp && allEvents.length > 0) {
          firstEventTimestamp = Math.min(...allEvents.map(e => e.timestamp));
        }

        // Save ALL events to localStorage (up to 1 year)
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            events: allEvents.map(e => ({
              from: e.from,
              to: e.to,
              value: e.value.toString(),
              blockNumber: e.blockNumber.toString(),
              timestamp: e.timestamp,
            })),
            firstEventTimestamp,
            lastFetch: now,
          }));
        } catch (err) {
          console.warn('Failed to cache Metro transfers:', err);
        }

        // Calculate total Metro transferred across ALL accumulated events
        const totalMetroToken = allEvents.reduce(
          (sum, event) => sum + Number(event.value) / (10 ** 18),
          0
        );

        const totalMetroUSD = totalMetroToken * metroPrice;

        // Calculate time range from first event to now
        const oldestEventTime = allEvents.length > 0 
          ? Math.min(...allEvents.map(e => e.timestamp))
          : now;
        
        const timeRangeDays = (now - oldestEventTime) / (1000 * 60 * 60 * 24);

        // Calculate average daily rewards from accumulated data
        let averageDailyRewardsUSD = 0;
        if (timeRangeDays > 0) {
          averageDailyRewardsUSD = totalMetroUSD / timeRangeDays;
        }

        // Calculate APY based on average daily rewards
        if (averageDailyRewardsUSD > 0 && vaultTVL > 0) {
          const dailyReturn = averageDailyRewardsUSD / vaultTVL;
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
        console.warn('Metro APY calculation failed:', err);
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
    const interval = setInterval(fetchAndCalculateAPY, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient, stratAddress, metroTokenAddress, vaultTVL, metroPrice]);

  return { apy, isLoading };
}
