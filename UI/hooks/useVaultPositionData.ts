'use client';

import { useReadContract } from 'wagmi';
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain';
import { getTokenDecimals } from '@/lib/tokenHelpers';

interface UseVaultPositionDataProps {
  vaultAddress: string;
  stratAddress: string;
  lbBookAddress?: string;
  clpoolAddress?: string;
  name: string;
  tokenX?: string;
  tokenY?: string;
}

export interface VaultPositionData {
  /** Where current price falls in the total view (0–100) */
  pricePosition: number;
  /** Where range lower bound falls in the total view (0–100) */
  rangeStart: number;
  /** Where range upper bound falls in the total view (0–100) */
  rangeEnd: number;
  inRange: boolean;
  /** Human-readable prices (tokenY per tokenX) */
  lowerPrice: number | null;
  upperPrice: number | null;
  currentPrice: number | null;
  hasData: boolean;
}

// Shadow: price = 1.0001^tick * 10^(dX-dY)
function tickToPrice(tick: number, dX: number, dY: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, dX - dY);
}

// Metro LB: price = (1 + binStep/10000)^(binId - 2^23) * 10^(dX-dY)
function binToPrice(binId: number, binStep: number, dX: number, dY: number): number {
  return Math.pow(1 + binStep / 10_000, binId - 8_388_608) * Math.pow(10, dX - dY);
}

// Build the total view so both the range and the current price are visible.
// When in-range: green fills 100%, red is inside.
// When out-of-range: total view extends to include red, with 10% padding on extremes.
function computePositions(lower: number, upper: number, current: number) {
  const inRange = current >= lower && current <= upper;
  let viewMin: number, viewMax: number;

  if (inRange) {
    viewMin = lower;
    viewMax = upper;
  } else {
    const outerMin = Math.min(lower, current);
    const outerMax = Math.max(upper, current);
    const pad = (outerMax - outerMin) * 0.10;
    viewMin = outerMin - pad;
    viewMax = outerMax + pad;
  }

  const span = Math.max(viewMax - viewMin, 1e-12);
  return {
    rangeStart:    Math.max(0,   (lower   - viewMin) / span * 100),
    rangeEnd:      Math.min(100, (upper   - viewMin) / span * 100),
    pricePosition: Math.max(0, Math.min(100, (current - viewMin) / span * 100)),
    inRange,
  };
}

export function useVaultPositionData({
  vaultAddress,
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  name,
  tokenX = 'S',
  tokenY = 'USDC',
}: UseVaultPositionDataProps): VaultPositionData {
  const isMetropolis = name.includes('Metropolis');
  const isShadow = name.includes('Shadow');
  const dX = getTokenDecimals(tokenX);
  const dY = getTokenDecimals(tokenY);

  // ── Metro ─────────────────────────────────────────────────────────────────
  const { data: activeIdReal } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getActiveId',
    query: { enabled: !!lbBookAddress && isMetropolis },
  });

  const { data: binStepData } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getBinStep',
    query: { enabled: !!lbBookAddress && isMetropolis },
  });

  const { data: rangeDataMetro } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: { enabled: !!vaultAddress && isMetropolis },
  });

  // ── Shadow ────────────────────────────────────────────────────────────────
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

  // ── Normalise ─────────────────────────────────────────────────────────────
  const noData: VaultPositionData = {
    pricePosition: 50, rangeStart: 0, rangeEnd: 100,
    inRange: true, lowerPrice: null, upperPrice: null, currentPrice: null, hasData: false,
  };

  if (isMetropolis) {
    const rangeData = rangeDataMetro as readonly [bigint, bigint] | undefined;
    if (!rangeData || activeIdReal === undefined) return noData;

    const lower   = Number(rangeData[0]);
    const upper   = Number(rangeData[1]);
    const current = Number(activeIdReal as bigint);
    const binStep = binStepData !== undefined ? Number(binStepData as bigint) : 20; // default 20bp

    const positions = computePositions(lower, upper, current);
    return {
      ...positions,
      lowerPrice:   binToPrice(lower,   binStep, dX, dY),
      upperPrice:   binToPrice(upper,   binStep, dX, dY),
      currentPrice: binToPrice(current, binStep, dX, dY),
      hasData: true,
    };
  }

  if (isShadow) {
    const rangeData = rangeDataShadow as readonly [number, number] | undefined;
    const slot0     = slot0Data as readonly [bigint, number, ...unknown[]] | undefined;
    if (!rangeData || !slot0) return noData;

    const lower   = rangeData[0];
    const upper   = rangeData[1];
    const current = slot0[1]; // tick

    const positions = computePositions(lower, upper, current);
    return {
      ...positions,
      lowerPrice:   tickToPrice(lower,   dX, dY),
      upperPrice:   tickToPrice(upper,   dX, dY),
      currentPrice: tickToPrice(current, dX, dY),
      hasData: true,
    };
  }

  return noData;
}
