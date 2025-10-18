'use client';

import { useEffect, useState } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';

interface HarvestEvent {
  user: string;
  token: string;
  amount: string; // Store as string for localStorage
  blockNumber: string;
  timestamp: number;
}

interface HarvestData {
  events: HarvestEvent[];
  totalHarvestedUSD: number;
  lastHarvestTime: number | null;
  apy: number | null;
}

/**
 * Hook to watch for Harvested events from vault contracts and calculate APY
 * Event signature: Harvested(address indexed user, address indexed token, uint256 amount)
 */
export function useHarvestEvents(
  vaultAddress: string,
  userAddress?: string,
  tokenPrice: number = 0,
  depositedValueUSD: number = 0,
  enabled: boolean = true
) {
  const [harvestData, setHarvestData] = useState<HarvestData>({
    events: [],
    totalHarvestedUSD: 0,
    lastHarvestTime: null,
    apy: null,
  });

  // Storage key for persisting harvest events
  const storageKey = `harvest_${vaultAddress}_${userAddress}`.toLowerCase();
  const publicClient = usePublicClient();

  // Load stored events on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !userAddress) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHarvestData(parsed);
        console.log('📦 Loaded stored harvest data:', {
          storageKey,
          events: parsed.events?.length || 0,
          totalHarvestedUSD: parsed.totalHarvestedUSD,
          lastHarvestTime: parsed.lastHarvestTime ? new Date(parsed.lastHarvestTime).toLocaleString() : 'N/A',
          storedAPY: parsed.apy,
          rawData: parsed,
        });
      }
    } catch (error) {
      console.error('Failed to load harvest data:', error);
    }
  }, [storageKey, userAddress]);

  // Fetch past Harvested events on mount (last 7 days)
  useEffect(() => {
    if (!publicClient || !userAddress || !vaultAddress || !enabled) return;

    const fetchPastEvents = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerDay = 86400n / 2n; // ~2 second blocks on Sonic
        const fromBlock = currentBlock - (blocksPerDay * 7n); // Last 7 days

        console.log('🔍 Fetching past Harvested events...', {
          vaultAddress,
          userAddress,
          fromBlock: fromBlock.toString(),
          toBlock: currentBlock.toString(),
        });

        const logs = await publicClient.getLogs({
          address: vaultAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'Harvested',
            inputs: [
              { name: 'user', type: 'address', indexed: true },
              { name: 'token', type: 'address', indexed: true },
              { name: 'amount', type: 'uint256', indexed: false },
            ],
          },
          args: {
            user: userAddress as `0x${string}`,
          },
          fromBlock,
          toBlock: currentBlock,
        });

        console.log(`✅ Found ${logs.length} past Harvested events`);

        if (logs.length > 0) {
          const events: HarvestEvent[] = logs.map((log) => ({
            user: log.args.user as string,
            token: log.args.token as string,
            amount: (log.args.amount as bigint).toString(),
            blockNumber: log.blockNumber.toString(),
            timestamp: Date.now(), // Approximate timestamp
          }));

          setHarvestData((prev) => {
            // Merge with existing events, avoiding duplicates
            const existingBlockNumbers = new Set(prev.events.map(e => e.blockNumber));
            const newEvents = events.filter(e => !existingBlockNumbers.has(e.blockNumber));
            
            if (newEvents.length === 0) return prev;

            const updated = {
              ...prev,
              events: [...prev.events, ...newEvents],
              lastHarvestTime: Date.now(),
            };

            // Save to localStorage
            try {
              localStorage.setItem(storageKey, JSON.stringify(updated));
              console.log(`💾 Saved ${newEvents.length} new past events to localStorage`);
            } catch (error) {
              console.error('Failed to save past events:', error);
            }

            return updated;
          });
        }
      } catch (error) {
        console.error('Failed to fetch past events:', error);
      }
    };

    fetchPastEvents();
  }, [publicClient, userAddress, vaultAddress, enabled, storageKey]);

  // Calculate APY whenever data changes
  useEffect(() => {
    console.log('🔄 APY Recalculation triggered:', {
      events: harvestData.events.length,
      depositedValueUSD: `$${depositedValueUSD.toFixed(4)}`,
      tokenPrice: `$${tokenPrice.toFixed(6)}`,
    });

    if (harvestData.events.length === 0 || depositedValueUSD === 0 || tokenPrice === 0) {
      console.log('⏭️ Skipping APY calculation - missing data');
      return;
    }

    // Calculate total harvested in USD
    const totalHarvestedUSD = harvestData.events.reduce((sum, event) => {
      const amountNum = Number(formatUnits(BigInt(event.amount), 18));
      return sum + (amountNum * tokenPrice);
    }, 0);

    // Calculate time span
    const firstHarvest = harvestData.events[0].timestamp;
    const lastHarvest = harvestData.events[harvestData.events.length - 1].timestamp;
    const timeSpanMs = lastHarvest - firstHarvest;
    const timeSpanHours = timeSpanMs / (1000 * 60 * 60);

    // Calculate APY if we have at least 1 hour of data (for single harvest, use current time)
    let apy = null;
    if (harvestData.events.length === 1) {
      // Single harvest: calculate based on time since harvest
      const timeSinceHarvestMs = Date.now() - firstHarvest;
      const hoursSinceHarvest = timeSinceHarvestMs / (1000 * 60 * 60);
      
      if (hoursSinceHarvest >= 1) {
        const hourlyReturn = totalHarvestedUSD / hoursSinceHarvest;
        const annualReturn = hourlyReturn * 24 * 365;
        apy = (annualReturn / depositedValueUSD) * 100;
      }
    } else if (timeSpanHours >= 1) {
      // Multiple harvests: calculate based on time between first and last
      const hourlyReturn = totalHarvestedUSD / timeSpanHours;
      const annualReturn = hourlyReturn * 24 * 365;
      apy = (annualReturn / depositedValueUSD) * 100;
    }

    setHarvestData(prev => ({
      ...prev,
      totalHarvestedUSD,
      apy,
    }));

    console.log('📊 APY Calculation (Harvest-Based):', {
      events: harvestData.events.length,
      totalHarvestedUSD: `$${totalHarvestedUSD.toFixed(6)}`,
      timeSpanHours: timeSpanHours.toFixed(2),
      depositedValueUSD: `$${depositedValueUSD.toFixed(4)}`,
      tokenPrice: `$${tokenPrice.toFixed(6)}`,
      hourlyReturn: timeSpanHours > 0 ? `$${(totalHarvestedUSD / timeSpanHours).toFixed(8)}` : 'N/A',
      dailyReturn: timeSpanHours > 0 ? `$${(totalHarvestedUSD / timeSpanHours * 24).toFixed(6)}` : 'N/A',
      annualReturn: timeSpanHours > 0 ? `$${(totalHarvestedUSD / timeSpanHours * 24 * 365).toFixed(2)}` : 'N/A',
      apy: apy ? `${apy.toFixed(2)}%` : 'Not enough data',
    });
  }, [harvestData.events, tokenPrice, depositedValueUSD]);

  // Harvested event ABI
  const harvestedEventAbi = [
    {
      type: 'event',
      name: 'Harvested',
      inputs: [
        { name: 'user', type: 'address', indexed: true },
        { name: 'token', type: 'address', indexed: true },
        { name: 'amount', type: 'uint256', indexed: false },
      ],
    },
  ] as const;

  // Watch for new Harvested events
  useWatchContractEvent({
    address: vaultAddress as `0x${string}`,
    abi: harvestedEventAbi,
    eventName: 'Harvested',
    enabled: enabled && !!userAddress,
    onLogs(logs) {
      console.log('🌾 Harvested Event Detected:', logs);
      
      logs.forEach((log) => {
        const { args, blockNumber } = log;
        
        // Only track events for the specific user
        if (args.user?.toLowerCase() === userAddress?.toLowerCase()) {
          const newEvent: HarvestEvent = {
            user: args.user as string,
            token: args.token as string,
            amount: (args.amount as bigint).toString(),
            blockNumber: (blockNumber as bigint).toString(),
            timestamp: Date.now(),
          };

          console.log('✅ User Harvest Event:', {
            user: newEvent.user,
            token: newEvent.token,
            amount: formatUnits(BigInt(newEvent.amount), 18),
            blockNumber: newEvent.blockNumber,
          });

          setHarvestData((prev) => {
            const newEvents = [...prev.events, newEvent];
            const updated = {
              ...prev,
              events: newEvents,
              lastHarvestTime: newEvent.timestamp,
            };

            // Save to localStorage
            try {
              localStorage.setItem(storageKey, JSON.stringify(updated));
            } catch (error) {
              console.error('Failed to save harvest data:', error);
            }

            return updated;
          });
        }
      });
    },
  });

  return harvestData;
}
