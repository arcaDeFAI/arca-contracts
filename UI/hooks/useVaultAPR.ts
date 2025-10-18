'use client';

import { useState, useEffect } from 'react';
import { usePrices } from '@/contexts/PriceContext';

interface VaultAPRData {
  apr: number; // Instant APR from latest harvest extrapolation
  dailyApr: number; // Daily average APR from 24h cumulative harvests
  isLoading: boolean;
  error: string | null;
}

interface APRSnapshot {
  totalHarvestedAmount: bigint; // Total amount of tokens harvested
  timestamp: number;
}

interface HarvestRecord {
  amountUSD: number;
  timestamp: number;
}

interface DailyHarvestData {
  harvests: HarvestRecord[]; // Array of harvests in last 24h
}

// LocalStorage keys
const STORAGE_KEY = 'arca_vault_apr_snapshots';
const APR_STORAGE_KEY = 'arca_vault_apr_values';
const DAILY_HARVEST_KEY = 'arca_vault_daily_harvests';

interface StoredAPRData {
  apr: number;
  dailyApr: number;
  tokenPrice: number;
  timestamp: number;
}

// Load snapshots from localStorage on initialization
function loadSnapshots(): Map<string, APRSnapshot> {
  if (typeof window === 'undefined') return new Map();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const snapshots = new Map<string, APRSnapshot>();
      
      // Convert stored data back to APRSnapshot with BigInt
      for (const [key, value] of Object.entries(data)) {
        const snapshot = value as any;
        snapshots.set(key, {
          totalHarvestedAmount: BigInt(snapshot.totalHarvestedAmount || snapshot.accRewardShare || '0'),
          timestamp: snapshot.timestamp,
        });
      }
      
      // Clean up old snapshots (older than 24 hours)
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      let cleaned = false;
      
      for (const [key, snapshot] of snapshots.entries()) {
        if (now - snapshot.timestamp > maxAge) {
          snapshots.delete(key);
          cleaned = true;
          console.log(`🗑️ Removed old snapshot for ${key} (age: ${((now - snapshot.timestamp) / (60 * 60 * 1000)).toFixed(1)}h)`);
        }
      }
      
      if (cleaned) {
        saveSnapshots(snapshots);
      }
      
      console.log('📂 Loaded APY snapshots from localStorage');
      return snapshots;
    }
  } catch (err) {
    console.error('Failed to load APY snapshots:', err);
  }
  return new Map();
}

// Save snapshots to localStorage
function saveSnapshots(snapshots: Map<string, APRSnapshot>) {
  if (typeof window === 'undefined') return;
  
  try {
    // Convert BigInt to string for JSON serialization
    const data: any = {};
    for (const [key, snapshot] of snapshots.entries()) {
      data[key] = {
        totalHarvestedAmount: snapshot.totalHarvestedAmount.toString(),
        timestamp: snapshot.timestamp,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('💾 Saved APY snapshots to localStorage');
  } catch (err) {
    console.error('Failed to save APY snapshots:', err);
  }
}

// Global storage for APR snapshots per vault (persisted to localStorage)
const vaultSnapshots = loadSnapshots();

// Load daily harvest data from localStorage and filter to last 24h
function loadDailyHarvest(vaultName: string): DailyHarvestData {
  if (typeof window === 'undefined') {
    return { harvests: [] };
  }
  
  try {
    const stored = localStorage.getItem(DAILY_HARVEST_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const dailyData: DailyHarvestData = data[vaultName];
      
      if (dailyData && dailyData.harvests) {
        // Filter out harvests older than 24 hours
        const now = Date.now();
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        const recentHarvests = dailyData.harvests.filter(h => h.timestamp > twentyFourHoursAgo);
        
        console.log(`📦 Loaded ${recentHarvests.length} harvests from last 24h for ${vaultName}`);
        return { harvests: recentHarvests };
      }
    }
  } catch (err) {
    console.error('Failed to load daily harvest data:', err);
  }
  
  return { harvests: [] };
}

// Save daily harvest data to localStorage
function saveDailyHarvest(vaultName: string, dailyData: DailyHarvestData) {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(DAILY_HARVEST_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[vaultName] = dailyData;
    localStorage.setItem(DAILY_HARVEST_KEY, JSON.stringify(data));
    
    const totalUSD = dailyData.harvests.reduce((sum, h) => sum + h.amountUSD, 0);
    const oldestTimestamp = dailyData.harvests.length > 0 ? Math.min(...dailyData.harvests.map(h => h.timestamp)) : Date.now();
    const hoursCovered = (Date.now() - oldestTimestamp) / (1000 * 60 * 60);
    
    console.log(`💾 Saved daily harvest for ${vaultName}:`, {
      totalUSD: `$${totalUSD.toFixed(4)}`,
      harvestCount: dailyData.harvests.length,
      hoursCovered: hoursCovered.toFixed(2),
    });
  } catch (err) {
    console.error('Failed to save daily harvest data:', err);
  }
}

// Load saved APR values from localStorage
function loadSavedAPR(vaultName: string): { apr: number; dailyApr: number } {
  if (typeof window === 'undefined') return { apr: 0, dailyApr: 0 };
  
  try {
    const stored = localStorage.getItem(APR_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const aprData: StoredAPRData = data[vaultName];
      if (aprData && aprData.apr !== undefined) {
        console.log(`📂 Loaded saved APR for ${vaultName}: Instant ${aprData.apr.toFixed(2)}%, Daily ${(aprData.dailyApr || 0).toFixed(2)}% (from ${new Date(aprData.timestamp).toLocaleString()})`);
        return { apr: aprData.apr, dailyApr: aprData.dailyApr || 0 };
      }
    }
  } catch (err) {
    console.error('Failed to load saved APR:', err);
  }
  return { apr: 0, dailyApr: 0 };
}

// Save APR values with token price to localStorage
function saveAPR(vaultName: string, apr: number, dailyApr: number, tokenPrice: number) {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem(APR_STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data[vaultName] = {
      apr,
      dailyApr,
      tokenPrice,
      timestamp: Date.now(),
    } as StoredAPRData;
    localStorage.setItem(APR_STORAGE_KEY, JSON.stringify(data));
    console.log(`💾 Saved APR for ${vaultName}: Instant ${apr.toFixed(2)}%, Daily ${dailyApr.toFixed(2)}% (token price: $${tokenPrice.toFixed(6)})`);
  } catch (err) {
    console.error('Failed to save APR:', err);
  }
}

/**
 * Shared APR calculation hook for both VaultCard and DashboardVaultCard
 * 
 * HARVEST EVENT-DRIVEN APY Calculation:
 * 1. Listens to Harvested events from vault contract
 * 2. When user claims rewards → immediately recalculates APY
 * 3. Tracks time between claims and amount harvested
 * 4. Extrapolates to annual rate based on claim frequency
 * 5. Updates APY instantly
 * 
 * APY Calculation Flow:
 * 1. User claims rewards → Harvested(user, token, amount) event fires
 * 2. Check if token matches vault type (Metro or Shadow)
 * 3. Convert harvested amount to USD using CoinGecko prices
 * 4. Calculate time since last harvest
 * 5. Extrapolate: (Harvest USD / Minutes Elapsed) × 525,600 minutes/year
 * 6. Calculate APY: (Annual Rewards USD / Deposited USD) × 100
 * 
 * Example:
 * - User deposited: $1,000
 * - User claims: 0.05 Metro tokens (Harvested event)
 * - Metro price: $0.50 (from CoinGecko)
 * - Harvest USD: $0.025
 * - Time since last claim: 30 minutes
 * - Per minute: $0.025 / 30 = $0.000833/min
 * - Annual: $0.000833 × 525,600 = $437.81/year
 * - APY: ($437.81 / $1,000) × 100 = 43.78%
 */
export function useVaultAPR(
  vaultName: string,
  isShadowVault: boolean,
  pendingRewards: readonly { token: `0x${string}`; pendingRewards: bigint }[] | undefined,
  userBalanceUSD: number,
  vaultAddress?: `0x${string}`, // Optional vault address for event listening
  userShares?: bigint, // User's shares in the vault
  totalShares?: bigint, // Total vault shares
  vaultTVL?: number // Total vault TVL in USD
): VaultAPRData {
  // Load saved APR from localStorage on mount
  const savedAPR = loadSavedAPR(vaultName);
  const [apr, setApr] = useState(savedAPR.apr);
  const [dailyApr, setDailyApr] = useState(savedAPR.dailyApr);
  const [isLoading, setIsLoading] = useState(false); // Start as false since we load from storage
  const [error, setError] = useState<string | null>(null);
  const [latestHarvestAmount, setLatestHarvestAmount] = useState<bigint | null>(null);
  const [latestHarvestToken, setLatestHarvestToken] = useState<string | null>(null);
  const [dailyHarvestData, setDailyHarvestData] = useState(() => loadDailyHarvest(vaultName));
  const [previousRewards, setPreviousRewards] = useState<bigint>(0n);
  const { prices} = usePrices();

  // Save APR whenever it changes (with current token price)
  useEffect(() => {
    if ((apr > 0 || dailyApr > 0) && prices) {
      const tokenPrice = isShadowVault ? (prices.shadow || 0) : (prices.metro || 0);
      if (tokenPrice > 0) {
        saveAPR(vaultName, apr, dailyApr, tokenPrice);
      }
    }
  }, [apr, dailyApr, vaultName, prices, isShadowVault]);

  // Debug: Log when hook is called
  console.log(`🎯 useVaultAPR HOOK CALLED for: ${vaultName}`, {
    isShadowVault,
    hasPendingRewards: !!pendingRewards,
    rewardsLength: pendingRewards?.length,
    userBalanceUSD,
    hasPrices: !!prices,
    vaultAddress,
  });

  // Detect claims by monitoring pendingRewards changes
  // For Metro: track Metro token only
  // For Shadow: track Shadow token only (first token in array)
  useEffect(() => {
    if (!pendingRewards || pendingRewards.length === 0) {
      console.log(`⏭️ ${vaultName}: No pendingRewards data yet`);
      return;
    }
    
    // Log all rewards for Shadow vaults to debug
    if (isShadowVault) {
      console.log(`🔍 ${vaultName} ALL REWARDS:`, pendingRewards.map((r, i) => ({
        index: i,
        token: r.token,
        amount: r.pendingRewards?.toString() || '0',
      })));
    }
    
    // Get the primary token rewards (Metro for Metro vault, Shadow for Shadow vault)
    const primaryReward = pendingRewards[0];
    const currentRewards = primaryReward?.pendingRewards || 0n;
    const primaryToken = primaryReward?.token;
    
    console.log(`📊 ${vaultName} Rewards Tracking:`, {
      vaultType: isShadowVault ? 'Shadow' : 'Metro',
      primaryToken,
      primaryTokenName: isShadowVault ? 'SHADOW' : 'METRO',
      previousRewards: previousRewards.toString(),
      currentRewards: currentRewards.toString(),
      dropped: previousRewards > currentRewards,
      willTrigger: previousRewards > 0n && currentRewards < previousRewards,
    });
    
    // If rewards dropped, a claim happened
    if (previousRewards > 0n && currentRewards < previousRewards) {
      const claimedAmount = previousRewards - currentRewards;
      
      console.log(`\n💰 Detected claim via pendingRewards drop!`, {
        vaultType: isShadowVault ? 'Shadow' : 'Metro',
        previousRewards: previousRewards.toString(),
        currentRewards: currentRewards.toString(),
        claimedAmount: claimedAmount.toString(),
        primaryToken,
      });
      
      if (claimedAmount > 0n && primaryToken) {
        console.log(`✅ Triggering APY calculation`);
        setLatestHarvestAmount(claimedAmount);
        setLatestHarvestToken(primaryToken);
      }
    }
    
    setPreviousRewards(currentRewards);
  }, [pendingRewards, previousRewards, vaultName, isShadowVault]);

  useEffect(() => {
    const calculateAPR = () => {
      try {
        setIsLoading(true);

        console.log(`\n🔍 ===== APY DEBUG START: ${vaultName} =====`);
        console.log(`📊 Input Data:`, {
          vaultName,
          isShadowVault,
          userBalanceUSD: userBalanceUSD.toFixed(2),
          latestHarvestAmount: latestHarvestAmount?.toString(),
          latestHarvestToken,
          hasPrices: !!prices,
        });

        // Skip if missing essential data (but keep existing APR)
        if (!userBalanceUSD || !prices) {
          console.log(`⚠️ APR SKIPPED - ${vaultName}: Missing data (keeping existing APR)`, {
            userBalanceUSD,
            prices,
            currentAPR: apr,
          });
          setError(null);
          setIsLoading(false);
          return;
        }

        // If no harvest event yet, wait for first claim (but keep existing APR)
        if (!latestHarvestAmount || !latestHarvestToken) {
          console.log(`⏳ Waiting for first Harvested event for ${vaultName}... (keeping existing APR: ${apr.toFixed(2)}%)`);
          setError(null);
          setIsLoading(false);
          return;
        }

        // Check if correct token (Metro or Shadow)
        const normalizedToken = latestHarvestToken.toLowerCase();
        const expectedMetroToken = '0x71e99522ead5e21cf57f1f542dc4ad2e841f7321';
        const expectedShadowToken = '0x3333b97138d4b086720b5ae8a7844b1345a33333';
        const expectedToken = isShadowVault ? expectedShadowToken : expectedMetroToken;
        
        console.log(`🔍 Token Check:`, {
          vaultType: isShadowVault ? 'Shadow' : 'Metro',
          harvestedToken: normalizedToken,
          expectedToken,
          isCorrectToken: normalizedToken === expectedToken,
        });

        if (normalizedToken !== expectedToken) {
          console.log(`⚠️ Ignoring harvest of wrong token for ${vaultName}`);
          setIsLoading(false);
          return;
        }

        // Calculate USD value (same logic for both Metro and Shadow)
        const tokenPrice = isShadowVault ? (prices.shadow || 0) : (prices.metro || 0);
        const harvestAmountTokens = Number(latestHarvestAmount) / (10 ** 18);
        const harvestAmountUSD = harvestAmountTokens * tokenPrice;
        
        console.log(`💰 Token Price & USD Value:`, {
          vaultType: isShadowVault ? 'Shadow' : 'Metro',
          tokenPrice,
          harvestAmountTokens: harvestAmountTokens.toFixed(8),
          harvestAmountUSD: `$${harvestAmountUSD.toFixed(10)}`,
          harvestAmountUSD_scientific: harvestAmountUSD.toExponential(4),
        });

        const currentTime = Date.now();
        const snapshotKey = vaultName;
        const previousSnapshot = vaultSnapshots.get(snapshotKey);

        // Calculate cumulative harvested amount
        const cumulativeHarvested = previousSnapshot 
          ? previousSnapshot.totalHarvestedAmount + latestHarvestAmount
          : latestHarvestAmount;

        console.log(`\n⏰ Snapshot Status:`, {
          hasSnapshot: !!previousSnapshot,
          latestHarvestAmount: latestHarvestAmount.toString(),
          cumulativeHarvested: cumulativeHarvested.toString(),
          currentTime: new Date(currentTime).toLocaleTimeString(),
        });

        // First time - store initial snapshot (keep existing APR)
        if (!previousSnapshot) {
          console.log(`📸 First harvest detected - storing initial snapshot`);
          vaultSnapshots.set(snapshotKey, {
            totalHarvestedAmount: latestHarvestAmount,
            timestamp: currentTime,
          });
          saveSnapshots(vaultSnapshots); // 💾 Save to localStorage!
          setError(null);
          setIsLoading(false);
          return;
        }

        // Calculate time elapsed since last snapshot
        const minutesElapsed = (currentTime - previousSnapshot.timestamp) / (1000 * 60);
        const snapshotAge = new Date(previousSnapshot.timestamp).toLocaleTimeString();

        console.log(`\n⏱️  Time Tracking:`, {
          snapshotTaken: snapshotAge,
          minutesElapsed: minutesElapsed.toFixed(2),
          triggeredBy: 'Claim detected',
        });

        console.log(`\n📈 Harvest Data:`, {
          harvestAmountTokens: (Number(latestHarvestAmount) / (10 ** 18)).toFixed(8),
          harvestAmountUSD: `$${harvestAmountUSD.toFixed(6)}`,
          minutesElapsed: minutesElapsed.toFixed(2),
        });

        // Add new harvest to rolling 24h window
        const newHarvest: HarvestRecord = {
          amountUSD: harvestAmountUSD,
          timestamp: currentTime,
        };
        
        // Filter out harvests older than 24h and add new one
        const twentyFourHoursAgo = currentTime - (24 * 60 * 60 * 1000);
        const recentHarvests = dailyHarvestData.harvests.filter(h => h.timestamp > twentyFourHoursAgo);
        recentHarvests.push(newHarvest);
        
        const updatedDailyData: DailyHarvestData = {
          harvests: recentHarvests,
        };
        setDailyHarvestData(updatedDailyData);
        saveDailyHarvest(vaultName, updatedDailyData);

        // Calculate daily average APR from rolling 24h window
        if (recentHarvests.length > 0) {
          const totalHarvestedUSD = recentHarvests.reduce((sum, h) => sum + h.amountUSD, 0);
          
          // For time calculation, use the span from oldest harvest to now
          // This gives us the actual time period we're averaging over
          const oldestHarvest = Math.min(...recentHarvests.map(h => h.timestamp));
          const hoursCovered = (currentTime - oldestHarvest) / (1000 * 60 * 60);
          
          // Need at least 1 hour of data to extrapolate
          if (hoursCovered >= 1) {
            const dailyRewardsUSD = (totalHarvestedUSD / hoursCovered) * 24; // Extrapolate to 24h
            const annualRewardsUSD = dailyRewardsUSD * 365; // Extrapolate to year
            const calculatedDailyAPR = (annualRewardsUSD / userBalanceUSD) * 100;
            
            console.log(`\n📊 Daily Average APR (Rolling 24h):`, {
              harvestsIn24h: recentHarvests.length,
              totalHarvestedUSD: `$${totalHarvestedUSD.toFixed(6)}`,
              oldestHarvest: new Date(oldestHarvest).toLocaleTimeString(),
              currentTime: new Date(currentTime).toLocaleTimeString(),
              hoursCovered: hoursCovered.toFixed(2),
              dailyRewardsUSD: `$${dailyRewardsUSD.toFixed(4)}`,
              annualRewardsUSD: `$${annualRewardsUSD.toFixed(2)}`,
              dailyAPR: `${calculatedDailyAPR.toFixed(2)}%`,
            });
            
            setDailyApr(Math.max(0, calculatedDailyAPR));
          } else {
            console.log(`\n⏭️ Skipping daily APR calculation - need at least 1 hour of data (have ${hoursCovered.toFixed(2)} hours, ${recentHarvests.length} harvest${recentHarvests.length > 1 ? 'es' : ''})`);
          }
        }

        if (harvestAmountUSD <= 0) {
          console.log(`⚠️ NO REWARDS - ${vaultName} (keeping existing APR: ${apr.toFixed(2)}%)`);
          // Don't reset APR to 0, keep existing value
        } else {
          // Calculate rate per minute
          const rewardsPerMinute = harvestAmountUSD / minutesElapsed;
          const minutesPerYear = 365 * 24 * 60; // 525,600 minutes per year
          const annualRewardsUSD = rewardsPerMinute * minutesPerYear;
          
          // APR = (Annual Rewards / User Balance) * 100
          const calculatedAPR = (annualRewardsUSD / userBalanceUSD) * 100;

          console.log(`\n✅ APY CALCULATION SUCCESS:`, {
            harvestAmountUSD: `$${harvestAmountUSD.toFixed(6)}`,
            minutesElapsed: minutesElapsed.toFixed(2),
            rewardsPerMinute: `$${rewardsPerMinute.toFixed(8)}/min`,
            rewardsPerHour: `$${(rewardsPerMinute * 60).toFixed(4)}/hr`,
            rewardsPerDay: `$${(rewardsPerMinute * 60 * 24).toFixed(2)}/day`,
            annualRewardsUSD: `$${annualRewardsUSD.toFixed(2)}/year`,
            userBalanceUSD: `$${userBalanceUSD.toFixed(2)}`,
            calculatedAPY: `${calculatedAPR.toFixed(2)}%`,
          });

          console.log(`\n🎯 FINAL APY: ${calculatedAPR.toFixed(2)}%`);

          setApr(Math.max(0, calculatedAPR));
        }

        // Update snapshot with cumulative harvested amount
        console.log(`\n💾 Updating snapshot for next calculation`);
        const updatedSnapshot: APRSnapshot = {
          totalHarvestedAmount: cumulativeHarvested,
          timestamp: currentTime,
        };
        vaultSnapshots.set(snapshotKey, updatedSnapshot);
        saveSnapshots(vaultSnapshots);
        
        setError(null);
        console.log(`🔍 ===== APY DEBUG END: ${vaultName} =====\n`);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'APR calculation error';
        console.error(`❌ APR ERROR - ${vaultName}:`, errorMessage);
        setError(errorMessage);
        setApr(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Only calculate when latestHarvestAmount changes (from Harvested event)
    // Don't recalculate on price changes - use stored price from calculation time
    console.log(`\n🔄 useEffect triggered for ${vaultName}:`, {
      latestHarvestAmount: latestHarvestAmount?.toString(),
      latestHarvestToken,
      willCalculate: !!(latestHarvestAmount && latestHarvestToken),
    });
    
    if (latestHarvestAmount && latestHarvestToken) {
      console.log(`✅ Conditions met - calling calculateAPR()`);
      calculateAPR();
    } else {
      console.log(`⏳ Waiting for harvest data before calculating APY`);
    }
  }, [latestHarvestAmount, latestHarvestToken]); // Only Harvested event triggers recalc

  return { apr, dailyApr, isLoading, error };
}
