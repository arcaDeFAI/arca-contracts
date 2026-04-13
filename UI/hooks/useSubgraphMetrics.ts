'use client';

import { useQuery } from '@tanstack/react-query';
import { querySubgraph } from '@/lib/subgraph';
import { usePrices } from '@/contexts/PriceContext';
import { getTokenPrice, getTokenDecimals } from '@/lib/tokenHelpers';
import { getTokenByAddress } from '@/lib/tokenRegistry';
import { type VaultConfig } from '@/lib/vaultConfigs';

// ---- Raw subgraph response types ----

interface ILSnapshotRaw {
  firstAmountXPerShare: string;
  firstAmountYPerShare: string;
  firstTimestamp: string;
  latestAmountXPerShare: string;
  latestAmountYPerShare: string;
  latestTimestamp: string;
  snapshotCount: string;
  totalBalanceXSum: string;
  totalBalanceYSum: string;
  firstSqrtPriceX96: string;
  latestSqrtPriceX96: string;
  firstLBPrice: string;
  latestLBPrice: string;
  firstPriceXUsd: string | null;
  firstPriceYUsd: string | null;
  vault: { id: string };
}

interface SnapshotRaw {
  amountXPerShare: string;
  amountYPerShare: string;
  sqrtPriceX96: string;
  lbPrice: string;
  timestamp: string;
}

interface RewardEventRaw {
  amount: string;
  timestamp: string;
  rewardToken: string;
  vault: { id: string };
}

interface VaultMetricsQueryResult {
  ilsnapshot: ILSnapshotRaw | null;
  window30d: SnapshotRaw[];
  window7d: SnapshotRaw[];
  rewardEvents: RewardEventRaw[];
}

// ---- GraphQL query ----
// window30d / window7d: oldest snapshot within 30d / 7d of now → window start point.
// fee_apr window: 30d if available, else 7d, else all-time (ILSnapshot first→latest).

const buildQuery = (ts30d: number, ts7d: number) => `
  query GetVaultMetrics($vault: Bytes!) {
    ilsnapshot(id: $vault) {
      firstAmountXPerShare
      firstAmountYPerShare
      firstTimestamp
      latestAmountXPerShare
      latestAmountYPerShare
      latestTimestamp
      snapshotCount
      totalBalanceXSum
      totalBalanceYSum
      firstSqrtPriceX96
      latestSqrtPriceX96
      firstLBPrice
      latestLBPrice
      firstPriceXUsd
      firstPriceYUsd
      vault { id }
    }
    window30d: snapshots(
      where: { vault: $vault, timestamp_gte: "${ts30d}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1
    ) { amountXPerShare amountYPerShare sqrtPriceX96 lbPrice timestamp }
    window7d: snapshots(
      where: { vault: $vault, timestamp_gte: "${ts7d}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1
    ) { amountXPerShare amountYPerShare sqrtPriceX96 lbPrice timestamp }
    rewardEvents(
      where: { vault: $vault }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      amount
      timestamp
      rewardToken
      vault { id }
    }
  }
`;

// ---- Public result type ----

export interface SubgraphMetrics {
  feeApr: number | null;
  rewardApr: number | null;
  totalApr: number | null;
  il: number | null;
  vsHodl: number | null;
  /** Which APR window is active */
  periodLabel: '30d' | '7d' | 'all';
  periodDays: number;
  snapshotCount: number;
  isLoading: boolean;
  error: string | null;
}

// ---- Price conversion helper ----
function rawToHumanPxInY(sqrtBig: bigint, lbBig: bigint, dX: number, dY: number): number {
  const decAdj = 10 ** (dX - dY);
  if (sqrtBig > 0n) {
    const TWO96 = 79228162514264337593543950336n;
    const sqrtScaled = Number(sqrtBig * 1_000_000_000_000n / TWO96) / 1e12;
    return sqrtScaled * sqrtScaled * decAdj;
  }
  if (lbBig > 0n) {
    const TWO128 = 340282366920938463463374607431768211456n;
    return Number(lbBig * 1_000_000_000_000n / TWO128) / 1e12 * decAdj;
  }
  return 0;
}

// ---- Hook ----

export function useSubgraphMetrics(config: VaultConfig): SubgraphMetrics {
  const { tokenX = 'S', tokenY = 'USDC', vaultAddress } = config;
  const { prices } = usePrices();

  const nowSec = Math.floor(Date.now() / 1000);
  const ts30d = nowSec - 30 * 86400;
  const ts7d = nowSec - 7 * 86400;

  const { data, isLoading, error } = useQuery({
    queryKey: ['subgraph-metrics', vaultAddress],
    queryFn: () =>
      querySubgraph<VaultMetricsQueryResult>(buildQuery(ts30d, ts7d), {
        vault: vaultAddress.toLowerCase(),
      }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!vaultAddress,
  });

  const empty: SubgraphMetrics = {
    feeApr: null, rewardApr: null, totalApr: null,
    il: null, vsHodl: null, periodLabel: 'all', periodDays: 0, snapshotCount: 0,
    isLoading, error: error ? String(error) : null,
  };

  if (isLoading || !data) return empty;

  const { ilsnapshot: ilSnapshot, rewardEvents } = data;
  const snapshotCount = Number(ilSnapshot?.snapshotCount ?? 0);

  if (!ilSnapshot || snapshotCount < 2) {
    return { ...empty, isLoading: false, snapshotCount };
  }

  const priceX = getTokenPrice(tokenX, prices);
  const priceY = getTokenPrice(tokenY, prices);
  const decimalsX = getTokenDecimals(tokenX);
  const decimalsY = getTokenDecimals(tokenY);

  const latestTs = Number(ilSnapshot.latestTimestamp);

  // ---- "Latest" endpoint (always from ILSnapshot) ----
  const amtXLatest = Number(ilSnapshot.latestAmountXPerShare) / 10 ** decimalsX;
  const amtYLatest = Number(ilSnapshot.latestAmountYPerShare) / 10 ** decimalsY;
  const pxInYLatest = rawToHumanPxInY(
    BigInt(ilSnapshot.latestSqrtPriceX96 ?? '0'),
    BigInt(ilSnapshot.latestLBPrice ?? '0'),
    decimalsX, decimalsY,
  );

  // ---- Pick best window start: 30d > 7d > all-time ----
  const snap30d = data.window30d?.[0];
  const snap7d = data.window7d?.[0];

  let startAmtX: number;
  let startAmtY: number;
  let startPxInY: number;
  let startTs: number;
  let periodLabel: '30d' | '7d' | 'all';

  if (snap30d && (latestTs - Number(snap30d.timestamp)) >= 25 * 86400) {
    // 30d window available (snapshot spans at least 25 days from latest)
    startAmtX = Number(snap30d.amountXPerShare) / 10 ** decimalsX;
    startAmtY = Number(snap30d.amountYPerShare) / 10 ** decimalsY;
    startPxInY = rawToHumanPxInY(BigInt(snap30d.sqrtPriceX96 ?? '0'), BigInt(snap30d.lbPrice ?? '0'), decimalsX, decimalsY);
    startTs = Number(snap30d.timestamp);
    periodLabel = '30d';
  } else if (snap7d && (latestTs - Number(snap7d.timestamp)) >= 5 * 86400) {
    // 7d window available (snapshot spans at least 5 days)
    startAmtX = Number(snap7d.amountXPerShare) / 10 ** decimalsX;
    startAmtY = Number(snap7d.amountYPerShare) / 10 ** decimalsY;
    startPxInY = rawToHumanPxInY(BigInt(snap7d.sqrtPriceX96 ?? '0'), BigInt(snap7d.lbPrice ?? '0'), decimalsX, decimalsY);
    startTs = Number(snap7d.timestamp);
    periodLabel = '7d';
  } else {
    // All-time: use ILSnapshot first→latest
    startAmtX = Number(ilSnapshot.firstAmountXPerShare) / 10 ** decimalsX;
    startAmtY = Number(ilSnapshot.firstAmountYPerShare) / 10 ** decimalsY;
    startPxInY = rawToHumanPxInY(BigInt(ilSnapshot.firstSqrtPriceX96 ?? '0'), BigInt(ilSnapshot.firstLBPrice ?? '0'), decimalsX, decimalsY);
    startTs = Number(ilSnapshot.firstTimestamp);
    periodLabel = 'all';
  }

  const days = Math.max((latestTs - startTs) / 86400, 0.01);
  const hasHistoricalPrices = startPxInY > 0 && pxInYLatest > 0;

  // ---- fee_apr (windowed) ----
  let feeApr: number | null = null;
  let vaultReturn = 0;

  if (hasHistoricalPrices) {
    const ppsYStart  = startAmtX  * startPxInY  + startAmtY;
    const ppsYLatest = amtXLatest * pxInYLatest + amtYLatest;
    if (ppsYStart > 0 && ppsYLatest > 0) {
      vaultReturn = ppsYLatest / ppsYStart - 1;
      feeApr = vaultReturn * (365 / days) * 100;
    }
  } else {
    const ppsStart  = startAmtX  * priceX + startAmtY  * priceY;
    const ppsLatest = amtXLatest * priceX + amtYLatest * priceY;
    if (ppsStart > 0 && ppsLatest > 0) {
      vaultReturn = ppsLatest / ppsStart - 1;
      feeApr = vaultReturn * (365 / days) * 100;
    }
  }

  // ---- reward_apr (windowed — rewards filtered to same period) ----
  let rewardApr: number | null = null;

  const avgBalXWei = Number(BigInt(ilSnapshot.totalBalanceXSum) / BigInt(snapshotCount));
  const avgBalYWei = Number(BigInt(ilSnapshot.totalBalanceYSum) / BigInt(snapshotCount));
  const avgTvl = (avgBalXWei / 10 ** decimalsX) * priceX + (avgBalYWei / 10 ** decimalsY) * priceY;

  if (avgTvl > 0 && rewardEvents.length > 0) {
    const periodRewards = rewardEvents.filter(
      (e) => Number(e.timestamp) >= startTs && Number(e.timestamp) <= latestTs,
    );
    let totalRewardUsd = 0;
    for (const event of periodRewards) {
      const tokenDef = getTokenByAddress(event.rewardToken);
      const rewardPrice = tokenDef ? getTokenPrice(tokenDef.symbol, prices) : 0;
      totalRewardUsd += Number(event.amount) / 10 ** (tokenDef?.decimals ?? 18) * rewardPrice;
    }
    if (totalRewardUsd > 0) {
      rewardApr = (totalRewardUsd / avgTvl) * (365 / days) * 100;
    }
  }

  // ---- IL / vsHodl (since-inception, vault_tracker USD PPS method) ----
  // vault_return = pps_usd(latest) / pps_usd(first) - 1
  // hodl_return  = 0.5*(priceX_latest/priceX_first - 1) + 0.5*(priceY_latest/priceY_first - 1)
  // vsHodl       = vault_return - hodl_return
  // il           = (1 + vault_return) / (1 + hodl_return) - 1
  //
  // Historical USD prices come from subgraph firstPriceXUsd/Y (set by stable-pair vaults via
  // TokenPrice entity). For stable-paired vaults these are always available. For volatile-volatile
  // pairs (WETH/wS) they're available once any stable-pair vault has rebalanced after v1.0.16.
  // Fallback: derive from in-pair ratio (works for single-stable pairs, approximate for both-volatile).

  const STABLE = new Set(['USDC', 'USSD', 'USDT', 'DAI']);
  const isXStable = STABLE.has(tokenX.toUpperCase());
  const isYStable = STABLE.has(tokenY.toUpperCase());

  let il: number | null = null;
  let vsHodl: number | null = null;

  const amtXFirst = Number(ilSnapshot.firstAmountXPerShare) / 10 ** decimalsX;
  const amtYFirst = Number(ilSnapshot.firstAmountYPerShare) / 10 ** decimalsY;

  // Prefer subgraph-stored historical USD prices (exact, from stable-pair vaults)
  const storedPxFirst = ilSnapshot.firstPriceXUsd ? Number(ilSnapshot.firstPriceXUsd) : 0;
  const storedPyFirst = ilSnapshot.firstPriceYUsd ? Number(ilSnapshot.firstPriceYUsd) : 0;

  let pxFirst: number, pyFirst: number;

  if (storedPxFirst > 0 && storedPyFirst > 0) {
    // Best case: subgraph stored exact historical prices at baseline
    pxFirst = storedPxFirst;
    pyFirst = storedPyFirst;
  } else {
    // Fallback: derive from in-pair price ratio
    const pxInYFirst = rawToHumanPxInY(
      BigInt(ilSnapshot.firstSqrtPriceX96 ?? '0'),
      BigInt(ilSnapshot.firstLBPrice ?? '0'),
      decimalsX, decimalsY,
    );
    if (pxInYFirst > 0) {
      if (isYStable)      { pxFirst = pxInYFirst; pyFirst = 1; }
      else if (isXStable) { pxFirst = 1; pyFirst = 1 / pxInYFirst; }
      else                { pxFirst = priceX; pyFirst = priceY; } // both volatile, no history
    } else {
      pxFirst = 0; pyFirst = 0;
    }
  }

  // Latest prices: always use live feed (most accurate for current point)
  const pxLatest = priceX;
  const pyLatest = priceY;

  if (pxFirst > 0 && pyFirst > 0 && pxLatest > 0 && pyLatest > 0) {
    const ppsUsdFirst  = amtXFirst  * pxFirst  + amtYFirst  * pyFirst;
    const ppsUsdLatest = amtXLatest * pxLatest + amtYLatest * pyLatest;

    if (ppsUsdFirst > 0 && ppsUsdLatest > 0) {
      const vaultReturnFull = ppsUsdLatest / ppsUsdFirst - 1;
      const hodlReturn = 0.5 * (pxLatest / pxFirst - 1) + 0.5 * (pyLatest / pyFirst - 1);
      vsHodl = (vaultReturnFull - hodlReturn) * 100;
      // IL requires separable price history; skip for both-volatile without stored prices
      const hasIndependentHistory = storedPxFirst > 0 || isXStable || isYStable;
      if (hasIndependentHistory && 1 + hodlReturn !== 0) {
        il = ((1 + vaultReturnFull) / (1 + hodlReturn) - 1) * 100;
      }
    }
  }

  const totalApr =
    feeApr !== null || rewardApr !== null
      ? (feeApr ?? 0) + (rewardApr ?? 0)
      : null;

  return {
    feeApr, rewardApr, totalApr, il, vsHodl,
    periodLabel, periodDays: days, snapshotCount,
    isLoading: false, error: null,
  };
}
