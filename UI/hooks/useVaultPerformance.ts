'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { formatUnits, parseAbiItem } from 'viem';
import { SHADOW_STRAT_ABI, CL_POOL_ABI, METRO_VAULT_ABI } from '@/lib/typechain';
import { usePrices } from '@/contexts/PriceContext';

const STORAGE_KEY = 'vault_perf_wsusdc_v7';
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// SHADOW token for reward tracking
const SHADOW_TOKEN = '0x3333b97138D4b086720b5aE8A7844b1345a33333';

// RewardForwarded event from ShadowStrategy
const REWARD_FORWARDED_EVENT = parseAbiItem(
  'event RewardForwarded(address indexed token, address indexed vault, uint256 amount)'
);

// PoolUpdated event from Vault - emitted when rewards are distributed
const POOL_UPDATED_EVENT = parseAbiItem(
  'event PoolUpdated(uint256 timestamp, uint256 accRewardsPerShare)'
);

interface Snapshot {
  ts: number;
  pricePerShare: number;
  tick: number;
  tvl: number;
  pX: number;
  accRewardsPerShare?: string; // Track reward accumulator
}

interface RewardEvent {
  ts: number;
  amount: string;
  shadowPrice: number;
  valueUSD: number;
  txHash?: string;
}

interface StoredData {
  snapshots: Snapshot[];
  rewards: RewardEvent[];
  lastTs: number;
  lastRewardFetch: number;
}

/**
 * WS/USDC Shadow Vault Performance Tracker
 *
 * Uses blockchain events for accurate tracking:
 * - RewardForwarded: SHADOW tokens sent from strategy to vault
 * - PoolUpdated: Vault updates accRewardsPerShare
 *
 * Components:
 * - Fee APR: From LP trading fees (in price-per-share growth)
 * - Reward APR: From SHADOW token harvests
 * - IL: From price divergence
 *
 * Total Real APR = Fee APR + Reward APR (IL already reflected in fee APR)
 */
export function useVaultPerformance(
  vaultAddress: string,
  stratAddress: string,
  poolAddress: string
) {
  const { prices } = usePrices();
  const publicClient = usePublicClient();
  const [data, setData] = useState<StoredData>({
    snapshots: [],
    rewards: [],
    lastTs: 0,
    lastRewardFetch: 0,
  });

  // Use SHADOW price from PriceContext (already fetched globally)
  const shadowPrice = prices?.shadow || 0;
  const priceWS = prices?.sonic || 0;

  // Contract reads
  const { data: totalSupply } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'totalSupply',
    query: { enabled: !!vaultAddress },
  });

  const { data: balances } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getBalances',
    query: { enabled: !!stratAddress },
  });

  const { data: positionData } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getPosition',
    query: { enabled: !!stratAddress },
  });

  const { data: slot0 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: { enabled: !!poolAddress },
  });

  const currentTick = slot0 ? (slot0 as readonly [bigint, number, ...unknown[]])[1] : null;
  const tickLower = positionData ? (positionData as [bigint, number, number])[1] : 0;
  const tickUpper = positionData ? (positionData as [bigint, number, number])[2] : 0;

  const tvl = useMemo(() => {
    if (!balances || priceWS === 0) return 0;
    const [balX, balY] = balances as [bigint, bigint];
    return Number(formatUnits(balX, 18)) * priceWS + Number(formatUnits(balY, 6));
  }, [balances, priceWS]);

  const pricePerShare = useMemo(() => {
    if (!totalSupply || tvl === 0) return 0;
    const shares = Number(formatUnits(totalSupply as bigint, 12));
    return shares === 0 ? 0 : tvl / shares;
  }, [totalSupply, tvl]);

  // Load stored data
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, []);

  // Fetch SHADOW reward events from RewardForwarded
  useEffect(() => {
    if (!publicClient || !stratAddress || shadowPrice === 0) return;

    const now = Date.now();
    // Only fetch every 30 min
    if (now - data.lastRewardFetch < 30 * 60 * 1000) return;

    const fetchRewards = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 600000n; // ~7 days

        const logs = await publicClient.getLogs({
          address: stratAddress as `0x${string}`,
          event: REWARD_FORWARDED_EVENT,
          fromBlock: fromBlock > 0n ? fromBlock : 0n,
          toBlock: currentBlock,
        });

        const newRewards: RewardEvent[] = [];
        for (const log of logs) {
          const token = (log.args.token as string).toLowerCase();
          const amount = log.args.amount as bigint;

          // Only track SHADOW rewards
          if (token !== SHADOW_TOKEN.toLowerCase() || !amount || amount === 0n) continue;

          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          const ts = Number(block.timestamp) * 1000;

          newRewards.push({
            ts,
            amount: amount.toString(),
            shadowPrice,
            valueUSD: Number(formatUnits(amount, 18)) * shadowPrice,
            txHash: log.transactionHash, // Use txHash for deduplication
          });
        }

        // Merge avoiding duplicates by txHash
        const existingHashes = new Set(data.rewards.map(r => r.txHash).filter(Boolean));
        const unique = newRewards.filter(r => !existingHashes.has(r.txHash));

        const updated: StoredData = {
          ...data,
          rewards: [...data.rewards, ...unique].slice(-500),
          lastRewardFetch: now,
        };
        setData(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to fetch rewards:', e);
      }
    };

    fetchRewards();
  }, [publicClient, stratAddress, shadowPrice, data]);

  // Take snapshot every 2h
  useEffect(() => {
    if (pricePerShare === 0 || currentTick === null || priceWS === 0 || tvl === 0) return;

    const now = Date.now();
    if (now - data.lastTs < SNAPSHOT_INTERVAL_MS) return;

    const snapshot: Snapshot = { ts: now, pricePerShare, tick: currentTick, tvl, pX: priceWS };
    const updated: StoredData = {
      ...data,
      snapshots: [...data.snapshots, snapshot].slice(-336),
      lastTs: now,
    };
    setData(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [pricePerShare, currentTick, priceWS, tvl, data]);

  // Calculate reward period from actual harvest events
  const rewardMetrics = useMemo(() => {
    if (data.rewards.length === 0) {
      return { totalRewardsUSD: 0, rewardPeriodDays: 0 };
    }

    const sortedRewards = [...data.rewards].sort((a, b) => a.ts - b.ts);
    const firstReward = sortedRewards[0];
    const lastReward = sortedRewards[sortedRewards.length - 1];
    const rewardPeriodDays = (lastReward.ts - firstReward.ts) / (1000 * 60 * 60 * 24);
    const totalRewardsUSD = sortedRewards.reduce((sum, r) => sum + r.valueUSD, 0);

    return { totalRewardsUSD, rewardPeriodDays };
  }, [data.rewards]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const result = {
      totalAPR: null as number | null,
      feeAPR: null as number | null,
      rewardAPR: null as number | null,
      il: null as number | null,
      vsHodl: null as number | null, // Vault vs 50/50 HODL comparison
      hodlValue: null as number | null,
      hodlS: null as number | null, // S tokens in HODL portfolio
      hodlUSDC: null as number | null, // USDC in HODL portfolio
      periodDays: 0,
    };

    if (data.snapshots.length < 2) return result;

    const first = data.snapshots[0];
    const last = data.snapshots[data.snapshots.length - 1];
    const days = (last.ts - first.ts) / (1000 * 60 * 60 * 24);

    // Minimum 15 minutes of data (0.01 days) to calculate APR
    if (days < 0.01 || first.pricePerShare === 0 || first.tvl === 0) return result;

    result.periodDays = days;

    // Fee APR (includes IL impact)
    const shareGrowth = (last.pricePerShare - first.pricePerShare) / first.pricePerShare;
    result.feeAPR = (shareGrowth / days) * 365 * 100;

    // Reward APR from SHADOW harvests (use reward period if available)
    const avgTVL = data.snapshots.reduce((sum, s) => sum + s.tvl, 0) / data.snapshots.length;
    if (rewardMetrics.rewardPeriodDays > 0 && avgTVL > 0) {
      result.rewardAPR = (rewardMetrics.totalRewardsUSD / avgTVL) * (365 / rewardMetrics.rewardPeriodDays) * 100;
    } else {
      result.rewardAPR = 0;
    }

    // Total APR
    result.totalAPR = (result.feeAPR || 0) + (result.rewardAPR || 0);

    // IL - find first snapshot with valid price
    const firstWithPrice = data.snapshots.find(s => s.pX > 0);
    if (firstWithPrice && priceWS > 0) {
      const k = priceWS / firstWithPrice.pX;
      // Standard IL formula: 2*sqrt(k)/(1+k) - 1
      // This gives negative values when price diverges (which is IL)
      result.il = (2 * Math.sqrt(k) / (1 + k) - 1) * 100;

      // HODL comparison: What if we just held 50/50 instead of LPing?
      // At first snapshot: split TVL 50/50 into S and USDC
      const initialTVL = firstWithPrice.tvl;
      const initialSPrice = firstWithPrice.pX;
      const hodlUSDC = initialTVL / 2; // Half stays as USDC
      const hodlS = (initialTVL / 2) / initialSPrice; // Half buys S tokens

      // Store token amounts
      result.hodlS = hodlS;
      result.hodlUSDC = hodlUSDC;

      // Current value of HODL portfolio
      const currentHodlValue = hodlUSDC + (hodlS * priceWS);
      result.hodlValue = currentHodlValue;

      // Compare: positive = vault beating HODL, negative = HODL winning
      result.vsHodl = ((tvl - currentHodlValue) / currentHodlValue) * 100;
    }

    return result;
  }, [data.snapshots, rewardMetrics, priceWS, tvl]);

  const daysTracked = data.snapshots.length > 0 ? (Date.now() - data.snapshots[0].ts) / (1000 * 60 * 60 * 24) : 0;
  const inRange = currentTick !== null && currentTick >= tickLower && currentTick <= tickUpper;

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setData({ snapshots: [], rewards: [], lastTs: 0, lastRewardFetch: 0 });
  }, []);

  return {
    totalAPR: metrics.totalAPR,
    feeAPR: metrics.feeAPR,
    rewardAPR: metrics.rewardAPR,
    il: metrics.il,
    vsHodl: metrics.vsHodl,
    hodlValue: metrics.hodlValue,
    hodlS: metrics.hodlS,
    hodlUSDC: metrics.hodlUSDC,
    totalRewardsUSD: rewardMetrics.totalRewardsUSD,
    shadowPrice,
    pricePerShare,
    tvl,
    currentTick,
    tickLower,
    tickUpper,
    inRange,
    priceWS,
    daysTracked: Math.round(daysTracked * 10) / 10,
    periodDays: Math.round(metrics.periodDays * 10) / 10,
    rewardPeriodDays: Math.round(rewardMetrics.rewardPeriodDays * 10) / 10,
    snapshotCount: data.snapshots.length,
    rewardEventCount: data.rewards.length,
    lastUpdate: data.lastTs || null,
    firstSnapshot: data.snapshots[0] || null,
    reset,
  };
}
