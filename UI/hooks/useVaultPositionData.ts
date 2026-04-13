'use client';

import { useReadContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain';

interface UseVaultPositionDataProps {
  vaultAddress: string;
  stratAddress: string;
  lbBookAddress?: string;
  clpoolAddress?: string;
  name: string;
}

export interface VaultPositionData {
  pricePosition: number;
  hasData: boolean;
}

export function useVaultPositionData({
  vaultAddress,
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  name,
}: UseVaultPositionDataProps): VaultPositionData {
  const isMetropolis = name.includes('Metropolis');
  const isShadow = name.includes('Shadow');

  const { data: activeIdReal } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getActiveId',
    query: { enabled: !!lbBookAddress && isMetropolis },
  });

  const { data: rangeDataMetro } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: { enabled: !!vaultAddress && isMetropolis },
  });

  const { data: slot0Data } = useReadContract({
    address: clpoolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: { enabled: !!clpoolAddress && isShadow },
  });

  const { data: rangeDataShadow } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: { enabled: !!stratAddress && isShadow },
  });

  const shadowActiveTick = slot0Data
    ? (slot0Data as readonly [bigint, number, number, number, number, number, boolean])[1]
    : null;
  const shadowRangeData = rangeDataShadow ? (rangeDataShadow as readonly [number, number]) : null;

  const activeId = isMetropolis
    ? activeIdReal
    : shadowActiveTick !== null ? BigInt(shadowActiveTick) : null;
  const rangeData = isMetropolis ? rangeDataMetro : shadowRangeData;

  let pricePosition = 50;
  if (rangeData && activeId !== null) {
    const [lower, upper] = rangeData as readonly [bigint | number, bigint | number];
    const lowerNum = Number(lower);
    const upperNum = Number(upper);
    const activeNum = Number(activeId);
    if (upperNum > lowerNum) {
      pricePosition = ((activeNum - lowerNum) / (upperNum - lowerNum)) * 100;
      pricePosition = Math.max(0, Math.min(100, pricePosition));
    }
  }

  return { pricePosition, hasData: !!(rangeData && activeId !== null) };
}
