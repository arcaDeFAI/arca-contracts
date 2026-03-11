'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { formatUnits, parseAbiItem } from 'viem';
import { SHADOW_STRAT_ABI, CL_POOL_ABI, METRO_VAULT_ABI } from '@/lib/typechain';
import { usePrices } from '@/contexts/PriceContext';
import { supabase, VaultSnapshot, VaultReward } from '@/lib/supabase';

const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// SHADOW token for reward tracking
const SHADOW_TOKEN = '0x3333b97138D4b086720b5aE8A7844b1345a33333';

// RewardForwarded event from ShadowStrategy
const REWARD_FORWARDED_EVENT = parseAbiItem(
  'event RewardForwarded(address indexed token, address indexed vault, uint256 amount)'
);

interface Snapshot {
  ts: number;
  pricePerShare: number;
  tick: number;
  tvl: number;
  pX: number;
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
 * Uses Supabase for persistent storage across sessions.
 * Tracks blockchain events for accurate performance metrics:
 * - RewardForwarded: SHADOW tokens sent from strategy to vault
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
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Vault ID for Supabase (normalized address)
  const vaultId = vaultAddress.toLowerCase();

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

  // Load stored data from Supabase on mount
  useEffect(() => {
    if (initialLoadDone.current) return;

    const loadFromSupabase = async () => {
      try {
        // Load snapshots
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from('vault_snapshots')
          .select('*')
          .eq('vault_id', vaultId)
          .order('ts', { ascending: true });

        if (snapshotsError) {
          console.error('Error loading snapshots:', snapshotsError);
        }

        // Load rewards
        const { data: rewardsData, error: rewardsError } = await supabase
          .from('vault_rewards')
          .select('*')
          .eq('vault_id', vaultId)
          .order('ts', { ascending: true });

        if (rewardsError) {
          console.error('Error loading rewards:', rewardsError);
        }

        // Convert Supabase format to internal format
        const snapshots: Snapshot[] = (snapshotsData || []).map((s: VaultSnapshot) => ({
          ts: s.ts,
          pricePerShare: s.price_per_share,
          tick: s.tick,
          tvl: s.tvl,
          pX: s.price_x,
        }));

        const rewards: RewardEvent[] = (rewardsData || []).map((r: VaultReward) => ({
          ts: r.ts,
          amount: r.amount,
          shadowPrice: r.shadow_price,
          valueUSD: r.value_usd,
          txHash: r.tx_hash,
        }));

        const lastTs = snapshots.length > 0 ? snapshots[snapshots.length - 1].ts : 0;
        const lastRewardFetch = rewards.length > 0 ? Date.now() : 0;

        setData({ snapshots, rewards, lastTs, lastRewardFetch });
        initialLoadDone.current = true;
      } catch (error) {
        console.error('Failed to load from Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromSupabase();
  }, [vaultId]);

  // Fetch SHADOW reward events from RewardForwarded
  useEffect(() => {
    if (!publicClient || !stratAddress || shadowPrice === 0 || isLoading) return;

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
        const rewardsToInsert: VaultReward[] = [];

        for (const log of logs) {
          const token = (log.args.token as string).toLowerCase();
          const amount = log.args.amount as bigint;

          // Only track SHADOW rewards
          if (token !== SHADOW_TOKEN.toLowerCase() || !amount || amount === 0n) continue;

          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          const ts = Number(block.timestamp) * 1000;
          const txHash = log.transactionHash;

          // Check if this reward already exists
          const exists = data.rewards.some(r => r.txHash === txHash);
          if (exists) continue;

          const reward: RewardEvent = {
            ts,
            amount: amount.toString(),
            shadowPrice,
            valueUSD: Number(formatUnits(amount, 18)) * shadowPrice,
            txHash,
          };

          newRewards.push(reward);
          rewardsToInsert.push({
            vault_id: vaultId,
            ts,
            amount: amount.toString(),
            shadow_price: shadowPrice,
            value_usd: reward.valueUSD,
            tx_hash: txHash,
          });
        }

        if (rewardsToInsert.length > 0) {
          // Insert new rewards to Supabase
          const { error } = await supabase
            .from('vault_rewards')
            .upsert(rewardsToInsert, { onConflict: 'tx_hash' });

          if (error) {
            console.error('Error inserting rewards:', error);
          }
        }

        setData(prev => ({
          ...prev,
          rewards: [...prev.rewards, ...newRewards],
          lastRewardFetch: now,
        }));
      } catch (e) {
        console.error('Failed to fetch rewards:', e);
      }
    };

    fetchRewards();
  }, [publicClient, stratAddress, shadowPrice, data.lastRewardFetch, data.rewards, isLoading, vaultId]);

  // Take snapshot every 30 min and save to Supabase
  useEffect(() => {
    if (pricePerShare === 0 || currentTick === null || priceWS === 0 || tvl === 0 || isLoading) return;

    const now = Date.now();
    if (now - data.lastTs < SNAPSHOT_INTERVAL_MS) return;

    const saveSnapshot = async () => {
      const snapshot: Snapshot = { ts: now, pricePerShare, tick: currentTick, tvl, pX: priceWS };

      // Save to Supabase
      const { error } = await supabase
        .from('vault_snapshots')
        .insert({
          vault_id: vaultId,
          ts: now,
          price_per_share: pricePerShare,
          tick: currentTick,
          tvl,
          price_x: priceWS,
        });

      if (error) {
        console.error('Error saving snapshot:', error);
        return;
      }

      setData(prev => ({
        ...prev,
        snapshots: [...prev.snapshots, snapshot].slice(-336), // Keep last 336 (7 days at 30min intervals)
        lastTs: now,
      }));
    };

    saveSnapshot();
  }, [pricePerShare, currentTick, priceWS, tvl, data.lastTs, isLoading, vaultId]);

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
      vsHodl: null as number | null,
      hodlValue: null as number | null,
      hodlS: null as number | null,
      hodlUSDC: null as number | null,
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
      result.il = (2 * Math.sqrt(k) / (1 + k) - 1) * 100;

      // HODL comparison
      const initialTVL = firstWithPrice.tvl;
      const initialSPrice = firstWithPrice.pX;
      const hodlUSDC = initialTVL / 2;
      const hodlS = (initialTVL / 2) / initialSPrice;

      result.hodlS = hodlS;
      result.hodlUSDC = hodlUSDC;

      const currentHodlValue = hodlUSDC + (hodlS * priceWS);
      result.hodlValue = currentHodlValue;
      result.vsHodl = ((tvl - currentHodlValue) / currentHodlValue) * 100;
    }

    return result;
  }, [data.snapshots, rewardMetrics, priceWS, tvl]);

  const daysTracked = data.snapshots.length > 0 ? (Date.now() - data.snapshots[0].ts) / (1000 * 60 * 60 * 24) : 0;
  const inRange = currentTick !== null && currentTick >= tickLower && currentTick <= tickUpper;

  const reset = useCallback(async () => {
    // Delete from Supabase
    await supabase.from('vault_snapshots').delete().eq('vault_id', vaultId);
    await supabase.from('vault_rewards').delete().eq('vault_id', vaultId);

    setData({ snapshots: [], rewards: [], lastTs: 0, lastRewardFetch: 0 });
  }, [vaultId]);

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
    isLoading,
  };
}
