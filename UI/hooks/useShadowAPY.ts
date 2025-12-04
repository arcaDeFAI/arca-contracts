'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const CLAIM_REWARDS_ABI = parseAbi([
  'event ClaimRewards(uint256 period, bytes32 _positionHash, address receiver, address reward, uint256 amount)'
]);

const STORAGE_KEY_PREFIX = 'shadow_claims_';

// Utility function to clear all Shadow APY cache data
export function clearShadowAPYCache() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    // Failed to clear Shadow APY cache
  }
}

interface ClaimEvent {
  period: bigint;
  positionHash: string;
  receiver: string;
  reward: string;
  amount: bigint;
  blockNumber: bigint;
  timestamp: number;
}

interface CachedData {
  events: Array<{
    period: string;
    positionHash: string;
    receiver: string;
    reward: string;
    amount: string;
    blockNumber: string;
    timestamp: number;
  }>;
  firstEventTimestamp: number | null;
  lastFetch: number;
}

/**
 * Calculates Shadow vault APY from accumulated historical rewards
 */
export function useShadowAPY(
  stratAddress: string,
  shadowRewardsAddress: string,
  shadowTokenAddress: string,
  vaultTVL: number,
  shadowPrice: number
) {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !stratAddress || !shadowRewardsAddress || !shadowTokenAddress) {
      setIsLoading(false);
      return;
    }
    
    if (!vaultTVL || !shadowPrice) {
      setIsLoading(true);
      return;
    }

    let isMounted = true;
    const storageKey = `${STORAGE_KEY_PREFIX}${stratAddress.toLowerCase()}`;

    const fetchAndCalculateAPY = async () => {
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
        const blocksPerMonth = blocksPerDay * 30n; // Fetch 30 days of history instead of 7
        const fromBlock = currentBlock > blocksPerMonth ? currentBlock - blocksPerMonth : 0n;

        const logs = await publicClient.getLogs({
          address: shadowRewardsAddress as `0x${string}`,
          event: CLAIM_REWARDS_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        });

        if (!isMounted) return;

        const filteredLogs = logs.filter(log => 
          (log.args.receiver as string).toLowerCase() === stratAddress.toLowerCase() &&
          (log.args.reward as string).toLowerCase() === shadowTokenAddress.toLowerCase()
        );

        const newEvents = await Promise.all(
          filteredLogs.map(async (log) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            return {
              period: (log.args.period as bigint).toString(),
              positionHash: log.args._positionHash as string,
              receiver: log.args.receiver as string,
              reward: log.args.reward as string,
              amount: (log.args.amount as bigint).toString(),
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

        if (allEvents.length > 0 && vaultTVL > 0 && shadowPrice > 0) {
          // 🎯 NOUVELLE LOGIQUE: Prendre seulement les 3 derniers events
          const lastFewEvents = allEvents.slice(-2);
          
          if (lastFewEvents.length >= 2) { // Besoin min de 2 events pour calculer intervalle
            // Calculer récompenses des 3 derniers events seulement
            const recentTokens = lastFewEvents.reduce((sum, event) => {
              return sum + (Number(event.amount) / (10 ** 18));
            }, 0);
            const recentRewardUSD = recentTokens * shadowPrice;

            // Calculer intervalle de temps entre premier et dernier des 3 events
            const oldestTimestamp = Math.min(...lastFewEvents.map(e => e.timestamp));
            const newestTimestamp = Math.max(...lastFewEvents.map(e => e.timestamp));
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
  }, [publicClient, stratAddress, shadowRewardsAddress, shadowTokenAddress, vaultTVL, shadowPrice]);

  return { apy, isLoading };
}
