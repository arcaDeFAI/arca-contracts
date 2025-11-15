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
 * Calculates daily harvested rewards (8am ET to 8am ET)
 * Returns latest reward if it occurred today
 */
export function useDailyHarvestedRewards(
  stratAddress: string,
  isShadowVault: boolean,
  tokenPrice: number
) {
  const [dailyHarvestedUSD, setDailyHarvestedUSD] = useState(0);

  useEffect(() => {
    if (!stratAddress) {
      return;
    }
    
    if (!tokenPrice) {
      return;
    }

    const calculateDaily = () => {
      try {
        const now = Date.now();
        const today8amET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        today8amET.setHours(8, 0, 0, 0);
        
        const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
        if (nowET < today8amET) {
          today8amET.setDate(today8amET.getDate() - 1);
        }
        
        const startTime8amET = today8amET.getTime();

        const storageKeyPrefix = isShadowVault ? SHADOW_STORAGE_KEY_PREFIX : METRO_STORAGE_KEY_PREFIX;
        const storageKey = `${storageKeyPrefix}${stratAddress.toLowerCase()}`;
        
        const cached = localStorage.getItem(storageKey);
        if (!cached) {
          setDailyHarvestedUSD(0);
          return;
        }

        const parsed = JSON.parse(cached);
        const events = parsed.events || [];

        if (events.length === 0) {
          setDailyHarvestedUSD(0);
          return;
        }

        const todayEvents = events.filter((event: any) => event.timestamp >= startTime8amET);

        if (todayEvents.length === 0) {
          setDailyHarvestedUSD(0);
          return;
        }

        let totalTokens = 0;
        if (isShadowVault) {
          totalTokens = todayEvents.reduce((sum: number, event: any) => {
            return sum + (Number(event.amount) / (10 ** 18));
          }, 0);
        } else {
          totalTokens = todayEvents.reduce((sum: number, event: any) => {
            return sum + (Number(event.value) / (10 ** 18));
          }, 0);
        }

        const rewardUSD = totalTokens * tokenPrice;

        setDailyHarvestedUSD(rewardUSD);
      } catch (err) {
        console.warn('Failed to calculate daily rewards:', err);
        setDailyHarvestedUSD(0);
      }
    };

    calculateDaily();

    const interval = setInterval(calculateDaily, 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stratAddress, isShadowVault, tokenPrice]);

  return { dailyHarvestedUSD };
}
