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
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

        // Load cached events
        let cachedEvents: ClaimEvent[] = [];
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            cachedEvents = parsed.events
              .filter((e: any) => e.timestamp >= twentyFourHoursAgo)
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
          console.log(`🔍 Fetching Shadow ClaimRewards events:`, {
            shadowRewardsAddress,
            stratAddress,
            shadowTokenAddress,
            fromBlock: fromBlock.toString(),
            toBlock: currentBlock.toString(),
            blocksToScan: (currentBlock - fromBlock).toString()
          });

          const logs = await publicClient.getLogs({
            address: shadowRewardsAddress as `0x${string}`,
            event: CLAIM_REWARDS_ABI[0],
            fromBlock,
            toBlock: currentBlock,
          });

          console.log(`📥 Shadow ClaimRewards events fetched: ${logs.length} total events`);

          // Filter for events where receiver is the strat address and reward is Shadow token
          const filteredLogs = logs.filter(log => 
            (log.args.receiver as string).toLowerCase() === stratAddress.toLowerCase() &&
            (log.args.reward as string).toLowerCase() === shadowTokenAddress.toLowerCase()
          );

          console.log(`🎯 Filtered Shadow events: ${filteredLogs.length} events (receiver=${stratAddress}, reward=Shadow)`);

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
        const recentEvents = allEvents.filter(e => e.timestamp >= twentyFourHoursAgo);

        // Save to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            events: recentEvents.map(e => ({
              period: e.period.toString(),
              positionHash: e.positionHash,
              receiver: e.receiver,
              reward: e.reward,
              amount: e.amount.toString(),
              blockNumber: e.blockNumber.toString(),
              timestamp: e.timestamp,
            })),
            lastFetch: now,
          }));
        } catch (err) {
          console.warn('Failed to cache Shadow claims:', err);
        }

        // Calculate total Shadow claimed
        const totalShadowToken = recentEvents.reduce(
          (sum, event) => sum + Number(event.amount) / (10 ** 18),
          0
        );

        const totalShadowUSD = totalShadowToken * shadowPrice;

        // Extrapolate if less than 24h
        const oldestEventTime = recentEvents.length > 0 
          ? Math.min(...recentEvents.map(e => e.timestamp))
          : twentyFourHoursAgo;
        
        const timeRangeHours = (now - oldestEventTime) / (1000 * 60 * 60);

        let extrapolatedRewardsUSD = totalShadowUSD;
        if (timeRangeHours > 0 && timeRangeHours < 24) {
          extrapolatedRewardsUSD = (totalShadowUSD / timeRangeHours) * 24;
        }

        // Calculate APY
        if (extrapolatedRewardsUSD > 0 && vaultTVL > 0) {
          const dailyReturn = extrapolatedRewardsUSD / vaultTVL;
          const annualReturn = dailyReturn * 365;
          const calculatedAPY = annualReturn * 100;

          console.log(`✅ Shadow APY Calculated:`, {
            stratAddress,
            eventsFound: recentEvents.length,
            newEventsFetched: newEvents.length,
            timeRangeHours: timeRangeHours.toFixed(1),
            totalShadowToken: totalShadowToken.toFixed(4),
            totalShadowUSD: totalShadowUSD.toFixed(2),
            extrapolatedRewardsUSD: extrapolatedRewardsUSD.toFixed(2),
            vaultTVL: vaultTVL.toFixed(2),
            dailyReturn: (dailyReturn * 100).toFixed(4) + '%',
            apy: calculatedAPY.toFixed(2) + '%'
          });

          if (isMounted) {
            setApy(Math.max(0, calculatedAPY));
          }
        } else {
          console.log(`⚠️ Shadow APY = 0:`, {
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
