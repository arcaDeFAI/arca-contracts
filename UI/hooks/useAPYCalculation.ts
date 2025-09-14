'use client';

import { useState, useEffect } from 'react';

interface TokenPrice {
  usd: number;
}

interface APYData {
  apy: number;
  isLoading: boolean;
  error: string | null;
}

// CoinGecko API hook for token prices
export function useTokenPrices() {
  const [prices, setPrices] = useState<{ metro: number; shadow: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=metropolis,shadow-2&vs_currencies=usd'
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch token prices');
        }
        
        const data = await response.json();
        setPrices({
          metro: data.metropolis?.usd || 0,
          shadow: data['shadow-2']?.usd || 0
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPrices(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrices();
    // Refresh prices every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { prices, isLoading, error };
}

// Simple APY calculation hook using daily deltas
export function useAPYCalculation(
  vaultName: string,
  userBalanceUSD: number,
  currentRewardsToken: number,
  tokenPrice: number
): APYData {
  const [apy, setApy] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousRewards, setPreviousRewards] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  useEffect(() => {
    try {
      setIsLoading(true);
      
      console.log(`🔢 SIMPLE APY DEBUG - ${vaultName}:`, {
        userBalanceUSD,
        currentRewardsToken,
        tokenPrice,
        previousRewards,
        lastUpdateTime
      });
      
      if (!userBalanceUSD || !tokenPrice) {
        console.log(`⚠️ APY SKIPPED - ${vaultName}: Missing balance or price`);
        setApy(0);
        setError(null);
        setIsLoading(false);
        return;
      }

      const currentTime = Date.now();
      const currentRewardsUSD = currentRewardsToken * tokenPrice;
      
      // First time or no previous data - just store current values
      if (previousRewards === null || lastUpdateTime === null) {
        console.log(`📅 FIRST DAY - ${vaultName}: Storing initial data, waiting for next day`);
        setPreviousRewards(currentRewardsUSD);
        setLastUpdateTime(currentTime);
        setApy(0); // No APY on first day
        setError(null);
        setIsLoading(false);
        return;
      }
      
      // Check if at least 24 hours have passed
      const hoursElapsed = (currentTime - lastUpdateTime) / (1000 * 60 * 60);
      
      if (hoursElapsed < 24) {
        console.log(`⏳ WAITING - ${vaultName}: Only ${hoursElapsed.toFixed(1)} hours elapsed, need 24h`);
        setIsLoading(false);
        return; // Keep previous APY, don't update yet
      }
      
      // Calculate daily delta
      const dailyDeltaUSD = currentRewardsUSD - previousRewards;
      
      console.log(`📊 DAILY DELTA - ${vaultName}:`, {
        previousRewards,
        currentRewardsUSD,
        dailyDeltaUSD,
        hoursElapsed
      });
      
      if (dailyDeltaUSD <= 0) {
        console.log(`⚠️ NO REWARDS GROWTH - ${vaultName}: Delta is ${dailyDeltaUSD}`);
        setApy(0);
      } else {
        // Simple APY: (Daily Delta / Balance) * 365 * 100
        const calculatedAPY = (dailyDeltaUSD / userBalanceUSD) * 365 * 100;
        
        console.log(`✅ APY CALCULATED - ${vaultName}:`, {
          dailyDeltaUSD,
          userBalanceUSD,
          calculatedAPY,
          percentage: `${calculatedAPY.toFixed(2)}%`
        });
        
        setApy(Math.max(0, calculatedAPY));
      }
      
      // Update stored values for next calculation
      setPreviousRewards(currentRewardsUSD);
      setLastUpdateTime(currentTime);
      setError(null);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'APY calculation error';
      console.error(`❌ APY ERROR - ${vaultName}:`, errorMessage);
      setError(errorMessage);
      setApy(0);
    } finally {
      setIsLoading(false);
    }
  }, [userBalanceUSD, currentRewardsToken, tokenPrice, vaultName, previousRewards, lastUpdateTime]);

  return { apy, isLoading, error };
}
