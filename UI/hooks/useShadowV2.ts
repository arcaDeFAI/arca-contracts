'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { SHADOW_V2_STRATEGY_ABI, SHADOW_V2_VAULT_ABI } from '@/lib/abis/shadowV2Abis';
import { SHADOW_V2 } from '@/lib/shadowV2';

const POOL_SLOT0_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

const POOL_TOKENS_ABI = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
] as const;

const NPM_POSITIONS_ABI = [
  {
    type: 'function',
    name: 'positions',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
] as const;

/** The strategy uses a single pool. */
const V2_POOL_ADDRESSES = [SHADOW_V2.pool] as const;

const REFRESH_MS = 15_000;
const vault = { address: SHADOW_V2.vault, abi: SHADOW_V2_VAULT_ABI } as const;
const strategy = { address: SHADOW_V2.strategy, abi: SHADOW_V2_STRATEGY_ABI } as const;

export interface V2Position {
  pool: `0x${string}`;
  tokenId: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number | null;
  inRange: boolean | null;
  token0: `0x${string}` | null;
  token1: `0x${string}` | null;
  liquidity: bigint | null;
  sqrtPriceX96: bigint | null;
}

/** Spot price of each pool, sqrtPriceX96 keyed by lowercase pool address. */
export interface V2PoolPrice {
  token0: `0x${string}`;
  token1: `0x${string}`;
  sqrtPriceX96: bigint;
}

export interface V2Holding {
  token: `0x${string}`;
  amount: bigint;
  valueUsdc: bigint | null;
}

/** Everything the staking page shows about the Shadow V2 test vault. */
export function useShadowV2(user?: `0x${string}`) {
  const query = { refetchInterval: REFRESH_MS };

  const totalSupply = useReadContract({ ...vault, functionName: 'totalSupply', query });
  const shareDecimals = useReadContract({ ...vault, functionName: 'decimals' });
  const totalValue = useReadContract({ ...strategy, functionName: 'totalValue', query });
  const aumFeeBps = useReadContract({ ...vault, functionName: 'aumFeeBps' });
  const depositsPaused = useReadContract({ ...vault, functionName: 'depositsPaused', query });
  const tokens = useReadContract({ ...strategy, functionName: 'getTokens' });
  const amounts = useReadContract({ ...strategy, functionName: 'totalAmounts', query });
  const positions = useReadContract({ ...strategy, functionName: 'getPositions', query });
  const operator = useReadContract({ ...strategy, functionName: 'operator' });
  const owner = useReadContract({ ...vault, functionName: 'owner' });

  const userShares = useReadContract({
    ...vault,
    functionName: 'balanceOf',
    args: [user ?? '0x0000000000000000000000000000000000000000'],
    query: { ...query, enabled: !!user },
  });
  const pending = useReadContract({
    ...vault,
    functionName: 'pendingRewards',
    args: [user ?? '0x0000000000000000000000000000000000000000'],
    query: { ...query, enabled: !!user },
  });

  const tokenList = tokens.data ?? [];
  const amountList = amounts.data ?? [];

  // Value of each holding in USDC, priced on-chain by the strategy itself
  const values = useReadContracts({
    contracts: tokenList.map((token, i) => ({
      ...strategy,
      functionName: 'valueInY' as const,
      args: [token, amountList[i] ?? 0n] as const,
    })),
    query: { ...query, enabled: tokenList.length > 0 && amountList.length === tokenList.length },
  });

  const positionList = positions.data ?? [];
  const slot0s = useReadContracts({
    contracts: positionList.map(() => ({ address: SHADOW_V2.pool, abi: POOL_SLOT0_ABI, functionName: 'slot0' as const })),
    query: { ...query, enabled: positionList.length > 0 },
  });

  const npm = useReadContract({ ...strategy, functionName: 'npm' });
  const npmPositions = useReadContracts({
    contracts: positionList.map((p) => ({
      address: npm.data ?? '0x0000000000000000000000000000000000000000',
      abi: NPM_POSITIONS_ABI,
      functionName: 'positions' as const,
      args: [p.tokenId] as const,
    })),
    query: { ...query, enabled: positionList.length > 0 && !!npm.data },
  });

  // Token order and spot price of every pool: used to price each token in USDC
  const poolTokens = useReadContracts({
    contracts: V2_POOL_ADDRESSES.flatMap((address) => [
      { address, abi: POOL_TOKENS_ABI, functionName: 'token0' as const },
      { address, abi: POOL_TOKENS_ABI, functionName: 'token1' as const },
    ]),
  });
  const poolSlot0s = useReadContracts({
    contracts: V2_POOL_ADDRESSES.map((address) => ({ address, abi: POOL_SLOT0_ABI, functionName: 'slot0' as const })),
    query,
  });
  const poolPrices: Record<string, V2PoolPrice> = {};
  V2_POOL_ADDRESSES.forEach((address, i) => {
    const t0 = poolTokens.data?.[2 * i];
    const t1 = poolTokens.data?.[2 * i + 1];
    const s0 = poolSlot0s.data?.[i];
    if (t0?.status === 'success' && t1?.status === 'success' && s0?.status === 'success') {
      poolPrices[address.toLowerCase()] = { token0: t0.result, token1: t1.result, sqrtPriceX96: s0.result[0] };
    }
  });

  const holdings: V2Holding[] = tokenList.map((token, i) => {
    const value = values.data?.[i];
    return {
      token,
      amount: amountList[i] ?? 0n,
      valueUsdc: value?.status === 'success' ? value.result : null,
    };
  });

  const positionsView: V2Position[] = positionList.map((p, i) => {
    const slot0 = slot0s.data?.[i];
    const npmPosition = npmPositions.data?.[i];
    const currentTick = slot0?.status === 'success' ? slot0.result[1] : null;
    return {
      pool: SHADOW_V2.pool,
      tokenId: p.tokenId,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      currentTick,
      inRange: currentTick === null ? null : currentTick >= p.tickLower && currentTick < p.tickUpper,
      token0: npmPosition?.status === 'success' ? npmPosition.result[0] : null,
      token1: npmPosition?.status === 'success' ? npmPosition.result[1] : null,
      liquidity: npmPosition?.status === 'success' ? npmPosition.result[5] : null,
      sqrtPriceX96: slot0?.status === 'success' ? slot0.result[0] : null,
    };
  });

  const supply = totalSupply.data ?? 0n;
  const shares = userShares.data ?? 0n;
  const vaultValue = totalValue.data ?? 0n;
  const userValueUsdc = supply > 0n ? (vaultValue * shares) / supply : 0n;

  return {
    isLoading: totalSupply.isLoading || totalValue.isLoading || tokens.isLoading,
    supply,
    shareDecimals: shareDecimals.data ?? 24,
    vaultValueUsdc: vaultValue,
    aumFeeBps: aumFeeBps.data ?? 0,
    depositsPaused: depositsPaused.data ?? false,
    owner: owner.data,
    operator: operator.data,
    holdings,
    positions: positionsView,
    poolPrices,
    userShares: shares,
    userValueUsdc,
    pendingRewards: pending.data
      ? pending.data[0].map((token, i) => ({ token, amount: pending.data[1][i] ?? 0n }))
      : [],
  };
}
