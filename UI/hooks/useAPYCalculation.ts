'use client';

import { useState, useEffect } from 'react';
import { usePrices } from '@/contexts/PriceContext';

interface APYData {
  apy: number;
  isLoading: boolean;
  error: string | null;
}

// Re-export the centralized price hook for backward compatibility
export function useTokenPrices() {
  const { prices, isLoading, error } = usePrices();
  
  return {
    prices: prices ? {
      metro: prices.metro,
      shadow: prices.shadow,
      sonic: prices.sonic,
      usdc: prices.usdc,
      xShadow: prices.xShadow,
    } : null,
    isLoading,
    error
  };
}

// APR calculation using 5-minute deltas extrapolated to annual rate
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
    const calculateAPR = () => {
      try {
        setIsLoading(true);
        
        console.log(`🔢 APR CALCULATION - ${vaultName}:`, {
          userBalanceUSD,
          currentRewardsToken,
          tokenPrice,
          previousRewards,
          lastUpdateTime
        });
        
        if (!userBalanceUSD || !tokenPrice) {
          console.log(`⚠️ APR SKIPPED - ${vaultName}: Missing balance or price`);
          setApy(0);
          setError(null);
          setIsLoading(false);
          return;
        }

        const currentTime = Date.now();
        const currentRewardsUSD = currentRewardsToken * tokenPrice;
        
        // First time - store initial values
        if (previousRewards === null || lastUpdateTime === null) {
          console.log(`📅 INITIAL SNAPSHOT - ${vaultName}: Storing baseline, APR will calculate in 5 minutes`);
          setPreviousRewards(currentRewardsUSD);
          setLastUpdateTime(currentTime);
          setApy(0);
          setError(null);
          setIsLoading(false);
          return;
        }
        
        // Calculate time elapsed in minutes
        const minutesElapsed = (currentTime - lastUpdateTime) / (1000 * 60);
        
        // Only calculate if at least 5 minutes have passed
        if (minutesElapsed < 5) {
          console.log(`⏳ WAITING - ${vaultName}: Only ${minutesElapsed.toFixed(1)} minutes elapsed, need 5 min`);
          setIsLoading(false);
          return;
        }
        
        // Calculate rewards delta over the elapsed period
        const rewardsDeltaUSD = currentRewardsUSD - previousRewards;
        
        console.log(`📊 REWARDS DELTA - ${vaultName}:`, {
          previousRewards,
          currentRewardsUSD,
          rewardsDeltaUSD,
          minutesElapsed: minutesElapsed.toFixed(2)
        });
        
        if (rewardsDeltaUSD <= 0) {
          console.log(`⚠️ NO REWARDS GROWTH - ${vaultName}: Delta is ${rewardsDeltaUSD}`);
          setApy(0);
        } else {
          // Calculate rate per minute, then extrapolate to annual
          const rewardsPerMinute = rewardsDeltaUSD / minutesElapsed;
          const minutesPerYear = 365 * 24 * 60; // 525,600 minutes per year
          const annualRewardsUSD = rewardsPerMinute * minutesPerYear;
          
          // APR = (Annual Rewards / Balance) * 100
          const calculatedAPR = (annualRewardsUSD / userBalanceUSD) * 100;
          
          console.log(`✅ APR CALCULATED - ${vaultName}:`, {
            rewardsDeltaUSD,
            minutesElapsed: minutesElapsed.toFixed(2),
            rewardsPerMinute,
            annualRewardsUSD,
            userBalanceUSD,
            calculatedAPR,
            percentage: `${calculatedAPR.toFixed(2)}%`
          });
          
          setApy(Math.max(0, calculatedAPR));
        }
        
        // Update stored values for next calculation
        setPreviousRewards(currentRewardsUSD);
        setLastUpdateTime(currentTime);
        setError(null);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'APR calculation error';
        console.error(`❌ APR ERROR - ${vaultName}:`, errorMessage);
        setError(errorMessage);
        setApy(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Calculate immediately
    calculateAPR();
    
    // Recalculate every 5 minutes
    const interval = setInterval(calculateAPR, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [userBalanceUSD, currentRewardsToken, tokenPrice, vaultName, previousRewards, lastUpdateTime]);

  return { apy, isLoading, error };
}
