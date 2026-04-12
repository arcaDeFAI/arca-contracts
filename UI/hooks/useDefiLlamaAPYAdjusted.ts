'use client';

import { useState, useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useDefiLlamaAPY } from './useDefiLlamaAPY';
import { SHADOW_STRAT_ABI, METRO_VAULT_ABI } from '@/lib/typechain';

// DeFi Llama base ranges per protocol
const DEFI_LLAMA_BASE_TICKS = 1400; // Shadow: assumes 1400 tick range
const DEFI_LLAMA_BASE_BINS = 40;    // Metropolis: assumes 40 bin range

interface APYAdjustedResult {
  apy: number;
  baseAPY: number;
  adjustedAPY: number;
  apy30dMean: number | null;
  tickRange: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to calculate adjusted APY based on DeFi Llama data and vault's range
 * Supports both Shadow (tick-based) and Metropolis (bin-based) protocols
 *
 * @param baseTicksOverride - Override the DeFi Llama assumed base range for this specific vault.
 *   Use when DeFi Llama calculates APY for a different tick width than our standard assumption.
 *   Example: USSD•USDC Shadow pool operates at 8 ticks, not the standard 1400.
 */
export function useDefiLlamaAPYAdjusted(
  stratAddress: string,
  poolId: string,
  protocol: 'shadow' | 'metropolis' = 'shadow',
  vaultAddress: string = '',
  baseTicksOverride?: number
): APYAdjustedResult {
  const [apy, setApy] = useState(0);
  const [baseAPY, setBaseAPY] = useState(0);
  const [adjustedAPY, setAdjustedAPY] = useState(0);
  const [apy30dMean, setApy30dMean] = useState<number | null>(null);
  const [tickRange, setTickRange] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);

  const isShadow = protocol === 'shadow';
  const isMetropolis = protocol === 'metropolis';
  // Allow per-vault override of the DeFi Llama assumed base range.
  // USSD•USDC Shadow uses 8 ticks natively, so its APY is already priced for an 8-tick range.
  const baseRange = baseTicksOverride ?? (isShadow ? DEFI_LLAMA_BASE_TICKS : DEFI_LLAMA_BASE_BINS);

  // Fetch DeFi Llama APY data
  const { getPoolAPY, isLoading: llamaLoading, error: llamaError } = useDefiLlamaAPY();

  // Shadow: get range from strategy contract
  const { data: shadowRangeData, isLoading: shadowRangeLoading } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: { enabled: !!stratAddress && isShadow },
  });

  // Metropolis: get range from vault contract
  const { data: metroRangeData, isLoading: metroRangeLoading } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: { enabled: !!vaultAddress && isMetropolis },
  });

  const rangeData = isShadow ? shadowRangeData : metroRangeData;
  const rangeLoading = isShadow ? shadowRangeLoading : metroRangeLoading;

  useEffect(() => {
    try {
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

      // If we don't have range data yet, use the raw APY
      if (!rangeData) {
        setApy(rawAPY);
        setAdjustedAPY(rawAPY);
        setApy30dMean(raw30dMean);
        setTickRange(null);
        return;
      }

      // Extract range from contract data (works for both ticks and bins)
      const [lower, upper] = rangeData as readonly [number, number];
      const actualRange = Math.abs(Number(upper) - Number(lower));
      setTickRange(actualRange);

      // Guard against division by zero (no active range set)
      if (actualRange === 0) {
        setApy(rawAPY);
        setAdjustedAPY(rawAPY);
        setApy30dMean(raw30dMean);
        return;
      }

      // Adjust APY: narrower range = more concentrated = higher APY per unit
      const adjustmentFactor = baseRange / actualRange;
      const calculatedAPY = rawAPY * adjustmentFactor;
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
  }, [getPoolAPY, poolId, rangeData, baseRange]);

  return {
    apy,
    baseAPY,
    adjustedAPY,
    apy30dMean,
    tickRange,
    isLoading: !hasInitialData && (llamaLoading || rangeLoading),
    error: error || llamaError,
  };
}

/**
 * Get the explanation for how APY is calculated
 */
export function getAPYCalculationExplanation(): string {
  return `APY Calculation Methodology
  
Base APR (Trading Fees):
- Calculated from last 24h volume × fee rate
- Annualized: (daily fees × 365 / TVL) × 100
Reward APR (Token Emissions):
- Based on current emission rate
- Formula: (annual rewards USD / TVL) × 100
Total APR = Base APR + Reward APR

Concentration Adjustment:APR varies with liquidity concentration. Narrower ranges = higher fees but more risk.
**Note: APR is based on the active position only, excluding reserves held for rebalancing.**`;
}
