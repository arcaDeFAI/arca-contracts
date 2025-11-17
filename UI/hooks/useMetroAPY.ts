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
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!stratAddress || !vaultTVL || !metroPrice) {
      return;
    }

    let isMounted = true;
    const storageKey = `${STORAGE_KEY_PREFIX}${stratAddress.toLowerCase()}`;

    const fetchAndCalculateAPY = async () => {
      if (!publicClient) return;
      
      try {
        setIsLoading(true);

        const now = Date.now();

        let cachedData: CachedData = {
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

        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerDay = 86400n;
        const blocksPerWeek = blocksPerDay * 7n;
        const fromBlock = currentBlock > blocksPerWeek ? currentBlock - blocksPerWeek : 0n;

        const logs = await publicClient.getLogs({
          address: metroTokenAddress as `0x${string}`,
          event: TRANSFER_ABI[0],
          args: {
            to: stratAddress as `0x${string}`,
          },
          fromBlock,
          toBlock: currentBlock,
        });

        if (!isMounted) return;

        const newEvents = await Promise.all(
          logs.map(async (log) => {
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

        const existingBlockNumbers = new Set(cachedData.events.map(e => e.blockNumber));
        const uniqueNewEvents = newEvents.filter(e => !existingBlockNumbers.has(e.blockNumber));
        const allEvents = [...cachedData.events, ...uniqueNewEvents];

        const firstTimestamp = allEvents.length > 0
          ? Math.min(...allEvents.map(e => e.timestamp))
          : null;

        localStorage.setItem(storageKey, JSON.stringify({
          events: allEvents,
          firstEventTimestamp: firstTimestamp,
          lastFetch: now,
        }));

        if (allEvents.length > 0 && vaultTVL > 0 && metroPrice > 0) {
          // 🎯 NOUVELLE LOGIQUE: Prendre seulement les 3 derniers events
          const last3Events = allEvents.slice(-10);
          
          if (last3Events.length >= 2) { // Besoin min de 2 events pour calculer intervalle
            // Calculer récompenses des 3 derniers events seulement
            const recentTokens = last3Events.reduce((sum, event) => {
              return sum + (Number(event.value) / (10 ** 18));
            }, 0);
            const recentRewardUSD = recentTokens * metroPrice;

            // Calculer intervalle de temps entre premier et dernier des 3 events
            const oldestTimestamp = Math.min(...last3Events.map(e => e.timestamp));
            const newestTimestamp = Math.max(...last3Events.map(e => e.timestamp));
            const timeSpan = newestTimestamp - oldestTimestamp;
            const daysSpan = Math.max(timeSpan / (1000 * 60 * 60 * 24), 0.01); // Min 0.01 jours

            // APY basé sur les 3 derniers events
            const dailyRewardRate = recentRewardUSD / daysSpan;
            const annualRewardUSD = dailyRewardRate * 365;
            const calculatedAPY = (annualRewardUSD / vaultTVL) * 100;

            if (isMounted) {
              setApy(Math.max(0, calculatedAPY));
            }
          } else {
            // Pas assez d'events pour calculer
            if (isMounted) {
              setApy(0);
            }
          }
        } else {
          if (isMounted) {
            setApy(0);
          }
        }
      } catch (err) {
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
