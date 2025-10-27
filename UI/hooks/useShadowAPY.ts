'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';

const CLAIM_REWARDS_ABI = parseAbi([
  'event ClaimRewards(uint256 period, bytes32 _positionHash, address receiver, address reward, uint256 amount)'
]);

const STORAGE_KEY_PREFIX = 'shadow_claims_';

interface ClaimEvent {
  period: bigint;
  positionHash: string;
  receiver: string;
  reward: string;
  amount: bigint;
  blockNumber: bigint;
  timestamp: number;
}

/**
 * Calculates Shadow vault APY based on ClaimRewards events
 * Uses continuous accumulation: stores ALL historical events and calculates
 * average daily rewards over the entire period, then extrapolates to annual
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
    if (!publicClient || !stratAddress || !shadowRewardsAddress || !shadowTokenAddress || !vaultTVL || !shadowPrice) {
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
        let cachedEvents: ClaimEvent[] = [];
        let firstEventTimestamp: number | null = null;
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            firstEventTimestamp = parsed.firstEventTimestamp || null;
            cachedEvents = parsed.events
              .filter((e: any) => e.timestamp >= oneYearAgo) // Keep up to 1 year
              .map((e: any) => ({
                period: BigInt(e.period),
                positionHash: e.positionHash,
                receiver: e.receiver,
                reward: e.reward,
                amount: BigInt(e.amount),
                blockNumber: BigInt(e.blockNumber),
                timestamp: e.timestamp,
              }));
          }
        } catch (err) {
          console.warn('Failed to load cached Shadow claims:', err);
        }

        const currentBlock = await publicClient.getBlockNumber();
        
        let fromBlock: bigint;
        if (cachedEvents.length > 0) {
          fromBlock = cachedEvents[cachedEvents.length - 1].blockNumber + 1n;
        } else {
          const blocksPerDay = 86400n;
          fromBlock = currentBlock > blocksPerDay ? currentBlock - blocksPerDay : 0n;
        }

        // Fetch ClaimRewards events where receiver is the strat address
        let newEvents: ClaimEvent[] = [];
        if (fromBlock <= currentBlock) {
          const logs = await publicClient.getLogs({
            address: shadowRewardsAddress as `0x${string}`,
            event: CLAIM_REWARDS_ABI[0],
            fromBlock,
            toBlock: currentBlock,
          });

          // Filter for events where receiver is the strat address and reward is Shadow token
          const filteredLogs = logs.filter(log => 
            (log.args.receiver as string).toLowerCase() === stratAddress.toLowerCase() &&
            (log.args.reward as string).toLowerCase() === shadowTokenAddress.toLowerCase()
          );

          newEvents = await Promise.all(
            filteredLogs.map(async (log) => {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              return {
                period: log.args.period as bigint,
                positionHash: log.args._positionHash as string,
                receiver: log.args.receiver as string,
                reward: log.args.reward as string,
                amount: log.args.amount as bigint,
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
              period: e.period.toString(),
              positionHash: e.positionHash,
              receiver: e.receiver,
              reward: e.reward,
              amount: e.amount.toString(),
              blockNumber: e.blockNumber.toString(),
              timestamp: e.timestamp,
            })),
            firstEventTimestamp,
            lastFetch: now,
          }));
        } catch (err) {
          console.warn('Failed to cache Shadow claims:', err);
        }

        // Calculate total Shadow claimed across ALL accumulated events
        const totalShadowToken = allEvents.reduce(
          (sum, event) => sum + Number(event.amount) / (10 ** 18),
          0
        );

        const totalShadowUSD = totalShadowToken * shadowPrice;

        // Calculate time range from first event to now
        const oldestEventTime = allEvents.length > 0 
          ? Math.min(...allEvents.map(e => e.timestamp))
          : now;
        
        const timeRangeDays = (now - oldestEventTime) / (1000 * 60 * 60 * 24);

        // Calculate average daily rewards from accumulated data
        let averageDailyRewardsUSD = 0;
        if (timeRangeDays > 0) {
          averageDailyRewardsUSD = totalShadowUSD / timeRangeDays;
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
        console.warn('Shadow APY calculation failed:', err);
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
