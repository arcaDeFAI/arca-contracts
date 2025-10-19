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
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        // Load cached events
        let cachedEvents: TransferEvent[] = [];
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            cachedEvents = parsed.events
              .filter((e: any) => e.timestamp >= twentyFourHoursAgo)
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
          console.log(`🔍 Fetching Metro Transfer events:`, {
            metroTokenAddress,
            stratAddress,
            fromBlock: fromBlock.toString(),
            toBlock: currentBlock.toString(),
            blocksToScan: (currentBlock - fromBlock).toString()
          });

          const logs = await publicClient.getLogs({
            address: metroTokenAddress as `0x${string}`,
            event: TRANSFER_ABI[0],
            args: {
              to: stratAddress as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          console.log(`📥 Metro Transfer events fetched: ${logs.length} events`);

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
        const recentEvents = allEvents.filter(e => e.timestamp >= twentyFourHoursAgo);

        // Save to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            events: recentEvents.map(e => ({
              from: e.from,
              to: e.to,
              value: e.value.toString(),
              blockNumber: e.blockNumber.toString(),
              timestamp: e.timestamp,
            })),
            lastFetch: now,
          }));
        } catch (err) {
          console.warn('Failed to cache Metro transfers:', err);
        }

        // Calculate total Metro transferred
        const totalMetroToken = recentEvents.reduce(
          (sum, event) => sum + Number(event.value) / (10 ** 18),
          0
        );

        const totalMetroUSD = totalMetroToken * metroPrice;

        // Extrapolate if less than 24h
        const oldestEventTime = recentEvents.length > 0 
          ? Math.min(...recentEvents.map(e => e.timestamp))
          : twentyFourHoursAgo;
        
        const timeRangeHours = (now - oldestEventTime) / (1000 * 60 * 60);

        let extrapolatedRewardsUSD = totalMetroUSD;
        if (timeRangeHours > 0 && timeRangeHours < 24) {
          extrapolatedRewardsUSD = (totalMetroUSD / timeRangeHours) * 24;
        }

        // Calculate APY
        if (extrapolatedRewardsUSD > 0 && vaultTVL > 0) {
          const dailyReturn = extrapolatedRewardsUSD / vaultTVL;
          const annualReturn = dailyReturn * 365;
          const calculatedAPY = annualReturn * 100;

          console.log(`✅ Metro APY Calculated:`, {
            stratAddress,
            eventsFound: recentEvents.length,
            newEventsFetched: newEvents.length,
            timeRangeHours: timeRangeHours.toFixed(1),
            totalMetroToken: totalMetroToken.toFixed(4),
            totalMetroUSD: totalMetroUSD.toFixed(2),
            extrapolatedRewardsUSD: extrapolatedRewardsUSD.toFixed(2),
            vaultTVL: vaultTVL.toFixed(2),
            dailyReturn: (dailyReturn * 100).toFixed(4) + '%',
            apy: calculatedAPY.toFixed(2) + '%'
          });

          if (isMounted) {
            setApy(Math.max(0, calculatedAPY));
          }
        } else {
          console.log(`⚠️ Metro APY = 0:`, {
            stratAddress,
            eventsFound: recentEvents.length,
            extrapolatedRewardsUSD: extrapolatedRewardsUSD.toFixed(2),
            vaultTVL: vaultTVL.toFixed(2),
            reason: extrapolatedRewardsUSD === 0 ? 'No rewards' : 'No TVL'
          });
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
