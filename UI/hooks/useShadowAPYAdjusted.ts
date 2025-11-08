'use client';

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useDefiLlamaAPY } from './useDefiLlamaAPY';
import { SHADOW_STRAT_ABI } from '@/lib/typechain';

// DeFi Llama uses a 1400 tick range as the base for APY calculations
const DEFI_LLAMA_BASE_TICKS = 1400;

interface ShadowAPYResult {
  apy: number;
  baseAPY: number; // Raw APY from DeFi Llama
  adjustedAPY: number; // APY adjusted for our tick range
  apy30dMean: number | null; // 30-day average APY
  tickRange: number | null; // Our actual tick range
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to calculate adjusted Shadow APY based on DeFi Llama data and vault's tick range
 * DeFi Llama calculates APY based on a 1400 tick range, so we adjust based on our actual range
 */
export function useShadowAPYAdjusted(
  stratAddress: string,
  poolId: string
): ShadowAPYResult {
  const [apy, setApy] = useState(0);
  const [baseAPY, setBaseAPY] = useState(0);
  const [adjustedAPY, setAdjustedAPY] = useState(0);
  const [apy30dMean, setApy30dMean] = useState<number | null>(null);
  const [tickRange, setTickRange] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);

  // Fetch DeFi Llama APY data
  const { getPoolAPY, isLoading: llamaLoading, error: llamaError } = useDefiLlamaAPY();

  // Get tick range from Shadow strategy contract
  const { data: rangeData, isLoading: rangeLoading } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!stratAddress,
    },
  });

  useEffect(() => {
    try {
      // Get pool data from DeFi Llama using pool ID
      const poolData = getPoolAPY(poolId);
      
      if (!poolData) {
        setError('Pool data not available');
        setApy(0);
        setBaseAPY(0);
        setAdjustedAPY(0);
        return;
      }

      const rawAPY = poolData.apy || 0;
      setBaseAPY(rawAPY);
      
      const raw30dMean = poolData.apyMean30d || null;

      // If we don't have range data yet, use the raw APY and raw 30d mean
      if (!rangeData) {
        setApy(rawAPY);
        setAdjustedAPY(rawAPY);
        setApy30dMean(raw30dMean);
        setTickRange(null);
        return;
      }

      // Extract tick range from contract data
      const [lowerTick, upperTick] = rangeData as readonly [number, number];
      const actualTickRange = Math.abs(upperTick - lowerTick);
      setTickRange(actualTickRange);

      // Calculate adjusted APY based on tick range ratio
      // Formula: Adjusted APY = Base APY × (DeFi Llama Base Ticks / Our Actual Ticks)
      // 
      // Reasoning: DeFi Llama calculates APY assuming a 1400 tick range.
      // If our range is narrower (fewer ticks), we're more concentrated and should earn MORE per unit of liquidity.
      // If our range is wider (more ticks), we're less concentrated and should earn LESS per unit of liquidity.
      //
      // Example:
      // - If we use 700 ticks (half of 1400), we're 2x more concentrated → APY should be 2x higher
      // - If we use 2800 ticks (double of 1400), we're 0.5x concentrated → APY should be 0.5x lower
      const adjustmentFactor = DEFI_LLAMA_BASE_TICKS / actualTickRange;
      const calculatedAPY = rawAPY * adjustmentFactor;
      
      // Apply the same adjustment to the 30-day mean
      const adjusted30dMean = raw30dMean !== null ? raw30dMean * adjustmentFactor : null;

      setAdjustedAPY(calculatedAPY);
      setApy(calculatedAPY);
      setApy30dMean(adjusted30dMean);
      setError(null);
      setHasInitialData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate APY');
      setApy(0);
      setBaseAPY(0);
      setAdjustedAPY(0);
    }
  }, [getPoolAPY, poolId, rangeData]);

  return {
    apy,
    baseAPY,
    adjustedAPY,
    apy30dMean,
    tickRange,
    // Only show loading if we don't have initial data yet
    // Once we have data, don't show loading during background refetches
    isLoading: !hasInitialData && (llamaLoading || rangeLoading),
    error: error || llamaError,
  };
}

/**
 * Get the explanation for how APY is calculated
 */
export function getAPYCalculationExplanation(): string {
  return `APY Calculation Methodology
  
Base APY (Trading Fees):
- Calculated from last 24h volume × fee rate
- Annualized: (daily fees × 365 / TVL) × 100
Reward APY (Token Emissions):
- Based on current emission rate
- Formula: (annual rewards USD / TVL) × 100

Total APY = Base APY + Reward APY

Concentration Adjustment:APY varies with liquidity concentration. Narrower ranges = higher fees but more risk.`;
}
