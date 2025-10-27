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
 * Calculates daily rewards from 8am ET to 8am ET
 * Reads from the existing localStorage caches populated by APY hooks
 * No blockchain calls - just reads cached data
 */
export function useDailyHarvestedRewards(
  stratAddress: string,
  isShadowVault: boolean,
  tokenPrice: number
) {
  const [dailyHarvestedUSD, setDailyHarvestedUSD] = useState(0);

  useEffect(() => {
    if (!stratAddress || !tokenPrice) {
      setDailyHarvestedUSD(0);
      return;
    }

    const calculateDaily = () => {
      try {
        // Calculate today's 8am Eastern Time
        const now = Date.now();
        const today8amET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        today8amET.setHours(8, 0, 0, 0);
        
        // If current time is before 8am ET, use yesterday's 8am ET
        const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        if (nowET < today8amET) {
          today8amET.setDate(today8amET.getDate() - 1);
        }
        
        const startTime8amET = today8amET.getTime();

        // Read from the appropriate cache (Metro or Shadow)
        const storageKeyPrefix = isShadowVault ? SHADOW_STORAGE_KEY_PREFIX : METRO_STORAGE_KEY_PREFIX;
        const storageKey = `${storageKeyPrefix}${stratAddress.toLowerCase()}`;
        
        const cached = localStorage.getItem(storageKey);
        if (!cached) {
          setDailyHarvestedUSD(0);
          return;
        }

        const parsed = JSON.parse(cached);
        const events = parsed.events || [];

        // Filter events since 8am ET today
        const todayEvents = events.filter((e: any) => 
          e.timestamp >= startTime8amET
        );

        // Calculate total tokens - different field names for Metro vs Shadow
        let totalTokens = 0;
        if (isShadowVault) {
          // Shadow uses ClaimRewards events with 'amount' field
          totalTokens = todayEvents.reduce((sum: number, event: ClaimEvent) => {
            return sum + (Number(event.amount) / (10 ** 18));
          }, 0);
        } else {
          // Metro uses Transfer events with 'value' field
          totalTokens = todayEvents.reduce((sum: number, event: TransferEvent) => {
            return sum + (Number(event.value) / (10 ** 18));
          }, 0);
        }

        const totalUSD = totalTokens * tokenPrice;

        setDailyHarvestedUSD(totalUSD);
      } catch (err) {
        console.warn('Failed to calculate daily rewards:', err);
        setDailyHarvestedUSD(0);
      }
    };

    calculateDaily();

    // Refresh every minute to stay current
    const interval = setInterval(calculateDaily, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stratAddress, isShadowVault, tokenPrice]);

  return { dailyHarvestedUSD };
}
