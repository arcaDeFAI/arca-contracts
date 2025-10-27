'use client';

import { useState, useEffect } from 'react';

interface BalanceSnapshot {
  timestamp: number;
  balance: number;
  rewards: number;
}

const STORAGE_KEY_PREFIX = 'balance_history_';
const MAX_SNAPSHOTS = 1000; // Store up to 1000 rebalance events (plenty for 30+ days)
const CHART_STORAGE_KEY = 'balance_history_chart'; // Shared key for chart display
const MIN_BALANCE_CHANGE = 0.01; // Minimum $0.01 change to trigger snapshot

/**
 * Tracks balance and rewards history for calculating real 24h changes
 */
export function useBalanceHistory(
  userAddress: string | undefined,
  currentBalance: number,
  currentRewards: number
) {
  const [history, setHistory] = useState<BalanceSnapshot[]>([]);

  useEffect(() => {
    if (!userAddress) {
      setHistory([]);
      return;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${userAddress}`;

    // Load existing history
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as BalanceSnapshot[];
        setHistory(parsed);
      }
    } catch (err) {
      console.warn('Failed to load balance history:', err);
    }

    // Function to save snapshot only when balance changes (rebalance)
    const saveSnapshot = () => {
      const now = Date.now();
      
      try {
        const stored = localStorage.getItem(storageKey);
        let snapshots: BalanceSnapshot[] = stored ? JSON.parse(stored) : [];

        // Only save if balance changed significantly (rebalance occurred)
        const lastSnapshot = snapshots[snapshots.length - 1];
        const balanceChanged = lastSnapshot 
          ? Math.abs(currentBalance - lastSnapshot.balance) >= MIN_BALANCE_CHANGE 
          : true;
        
        // Save if: no previous snapshot OR balance changed (rebalance)
        const shouldSave = !lastSnapshot || balanceChanged;

        if (shouldSave && (currentBalance > 0 || currentRewards > 0)) {
          // Add new snapshot
          const newSnapshot = {
            timestamp: now,
            balance: currentBalance,
            rewards: currentRewards
          };
          
          snapshots.push(newSnapshot);

          // Keep only last MAX_SNAPSHOTS
          if (snapshots.length > MAX_SNAPSHOTS) {
            snapshots = snapshots.slice(-MAX_SNAPSHOTS);
          }

          localStorage.setItem(storageKey, JSON.stringify(snapshots));
          
          // Also save to shared chart storage (for chart display)
          try {
            localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify(snapshots));
          } catch (err) {
            console.warn('Failed to save to chart storage:', err);
          }
          
          setHistory(snapshots);
        }
      } catch (err) {
        console.warn('Failed to save balance snapshot:', err);
      }
    };

    // Save snapshot on mount and whenever balance changes
    saveSnapshot();

    // No interval needed - snapshots only on balance changes
  }, [userAddress, currentBalance, currentRewards]);

  // Calculate 24h changes
  const calculate24hChange = (current: number, type: 'balance' | 'rewards') => {
    if (history.length === 0) {
      return { change: 0, percentage: 0 };
    }

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Find snapshot closest to 24h ago
    let closestSnapshot = history[0];
    let minDiff = Math.abs(closestSnapshot.timestamp - oneDayAgo);

    for (const snapshot of history) {
      const diff = Math.abs(snapshot.timestamp - oneDayAgo);
      if (diff < minDiff) {
        minDiff = diff;
        closestSnapshot = snapshot;
      }
    }

    const value24hAgo = type === 'balance' ? closestSnapshot.balance : closestSnapshot.rewards;
    
    if (value24hAgo === 0) {
      return { change: current, percentage: 0 };
    }

    const change = current - value24hAgo;
    const percentage = (change / value24hAgo) * 100;

    return { change, percentage };
  };

  return {
    history,
    calculate24hChange
  };
}
