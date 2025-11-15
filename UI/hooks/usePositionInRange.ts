'use client';

import { useReadContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain';

interface UsePositionInRangeProps {
  vaultAddress: string;
  stratAddress: string;
  lbBookAddress?: string;
  clpoolAddress?: string;
  name: string;
}

/**
 * Determines if vault position is in range
 */
export function usePositionInRange({
  vaultAddress,
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  name,
}: UsePositionInRangeProps): boolean | null {
  const isMetropolis = name.includes('Metropolis');
  const isShadow = name.includes('Shadow');

  // Get active ID from LB Book contract
  const { data: activeIdReal } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getActiveId',
    query: {
      enabled: !!lbBookAddress && isMetropolis,
    },
  });

  // Get range from vault contract
  const { data: rangeDataMetro } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!vaultAddress && isMetropolis,
    },
  });

  // Get active tick from CLPool slot0
  const { data: slot0Data } = useReadContract({
    address: clpoolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!clpoolAddress && isShadow,
    },
  });

  // Get range from Shadow strategy contract
  const { data: rangeDataShadow } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!stratAddress && isShadow,
    },
  });

  // Extract active tick from slot0 data for Shadow
  const shadowActiveTick = slot0Data ? (slot0Data as readonly [bigint, number, number, number, number, number, boolean])[1] : null;
  const shadowRangeData = rangeDataShadow ? (rangeDataShadow as readonly [number, number]) : null;

  // Use appropriate active ID/tick based on vault type
  const activeId = isMetropolis ? activeIdReal : (shadowActiveTick !== null ? BigInt(shadowActiveTick) : null);
  const rangeData = isMetropolis ? rangeDataMetro : shadowRangeData;

  // If data not loaded yet, return null
  if (!rangeData || activeId === null) {
    return null;
  }

  // Check if position is in range
  const [lowRange, upperRange] = rangeData as readonly [bigint | number, bigint | number];
  const activeIdNum = Number(activeId);
  const lowRangeNum = Number(lowRange);
  const upperRangeNum = Number(upperRange);

  const isInRange = activeIdNum >= lowRangeNum && activeIdNum <= upperRangeNum;

  return isInRange;
}
