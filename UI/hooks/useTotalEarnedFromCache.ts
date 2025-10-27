'use client';

import { useState, useEffect } from 'react';

// Storage keys from APY hooks
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
 * Reads from the existing localStorage caches populated by APY hooks
 * No blockchain calls - just reads cached data
 */
export function useTotalEarnedFromCache(
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
        // Read from the appropriate cache (Metro or Shadow)
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

        // Calculate total tokens across ALL events
        let totalTokens = 0;
        if (isShadowVault) {
          // Shadow uses ClaimRewards events with 'amount' field
          totalTokens = events.reduce((sum: number, event: ClaimEvent) => {
            return sum + (Number(event.amount) / (10 ** 18));
          }, 0);
        } else {
          // Metro uses Transfer events with 'value' field
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

    // Refresh every minute to stay current
    const interval = setInterval(calculateTotal, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stratAddress, isShadowVault, tokenPrice]);

  return { totalEarnedUSD, firstEventTimestamp };
}
