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
 * Calculates total earned rewards (all time)
 * Reads from localStorage accumulated events cache
 */
export function useTotalEarnedAllTime(
  stratAddress: string,
  isShadowVault: boolean,
  tokenPrice: number
) {
  const [totalEarnedUSD, setTotalEarnedUSD] = useState(0);
  const [firstEventTimestamp, setFirstEventTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!stratAddress || !tokenPrice) {
      setTotalEarnedUSD(0);
      setFirstEventTimestamp(null);
      return;
    }

    const calculateTotal = () => {
      try {
        const storageKeyPrefix = isShadowVault ? SHADOW_STORAGE_KEY_PREFIX : METRO_STORAGE_KEY_PREFIX;
        const storageKey = `${storageKeyPrefix}${stratAddress.toLowerCase()}`;
        
        const cached = localStorage.getItem(storageKey);
        if (!cached) {
          setTotalEarnedUSD(0);
          setFirstEventTimestamp(null);
          return;
        }

        const parsed = JSON.parse(cached);
        const events = parsed.events || [];
        const firstTimestamp = parsed.firstEventTimestamp || null;

        let totalTokens = 0;
        if (isShadowVault) {
          totalTokens = events.reduce((sum: number, event: ClaimEvent) => {
            return sum + (Number(event.amount) / (10 ** 18));
          }, 0);
        } else {
          totalTokens = events.reduce((sum: number, event: TransferEvent) => {
            return sum + (Number(event.value) / (10 ** 18));
          }, 0);
        }

        const totalUSD = totalTokens * tokenPrice;

        setTotalEarnedUSD(totalUSD);
        setFirstEventTimestamp(firstTimestamp);
      } catch (err) {
        console.warn('Failed to calculate total earned:', err);
        setTotalEarnedUSD(0);
        setFirstEventTimestamp(null);
      }
    };

    calculateTotal();

    const interval = setInterval(calculateTotal, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stratAddress, isShadowVault, tokenPrice]);

  return { totalEarnedUSD, firstEventTimestamp };
}
