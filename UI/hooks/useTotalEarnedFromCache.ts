'use client';

import { useState, useEffect } from 'react';

const METRO_STORAGE_KEY_PREFIX = 'metro_transfers_';
const SHADOW_STORAGE_KEY_PREFIX = 'shadow_claims_';

interface TransferEvent {
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timestamp: number;
}

interface ClaimEvent {
  period: string;
  positionHash: string;
  receiver: string;
  reward: string;
  amount: string;
  blockNumber: string;
  timestamp: number;
}

/**
 * Returns latest reward value and timestamp from accumulated cache
 */
export function useTotalEarnedFromCache(
  stratAddress: string,
  isShadowVault: boolean,
  tokenPrice: number
) {
  const [latestRewardUSD, setLatestRewardUSD] = useState(0);
  const [latestEventTimestamp, setLatestEventTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!stratAddress) {
      return;
    }
    
    if (!tokenPrice) {
      return;
    }

    const calculateLatest = () => {
      try {
        const storageKeyPrefix = isShadowVault ? SHADOW_STORAGE_KEY_PREFIX : METRO_STORAGE_KEY_PREFIX;
        const storageKey = `${storageKeyPrefix}${stratAddress.toLowerCase()}`;
        
        const cached = localStorage.getItem(storageKey);
        if (!cached) {
          setLatestRewardUSD(0);
          setLatestEventTimestamp(null);
          return;
        }

        const parsed = JSON.parse(cached);
        const events = parsed.events || [];

        if (events.length === 0) {
          setLatestRewardUSD(0);
          setLatestEventTimestamp(null);
          return;
        }

        const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
        const latestEvent = sortedEvents[0];

        let rewardUSD = 0;
        if (isShadowVault) {
          const amount = Number(latestEvent.amount) / (10 ** 18);
          rewardUSD = amount * tokenPrice;
        } else {
          const amount = Number(latestEvent.value) / (10 ** 18);
          rewardUSD = amount * tokenPrice;
        }

        setLatestRewardUSD(rewardUSD);
        setLatestEventTimestamp(latestEvent.timestamp);
      } catch (err) {
        console.warn('Failed to get latest reward:', err);
        setLatestRewardUSD(0);
        setLatestEventTimestamp(null);
      }
    };

    calculateLatest();

    const interval = setInterval(calculateLatest, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stratAddress, isShadowVault, tokenPrice]);

  return { latestRewardUSD, latestEventTimestamp };
}
