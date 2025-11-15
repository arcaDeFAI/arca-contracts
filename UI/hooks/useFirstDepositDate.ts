'use client';

import { useState, useEffect } from 'react';

/**
 * Tracks when the user first deposited into any vault
 * Stores in localStorage to persist across sessions
 */
export function useFirstDepositDate(userAddress?: string, hasDeposits?: boolean) {
  const [firstDepositDate, setFirstDepositDate] = useState<number | null>(null);
  const [timeSinceFirst, setTimeSinceFirst] = useState<string>('');

  useEffect(() => {
    if (!userAddress) {
      setFirstDepositDate(null);
      setTimeSinceFirst('');
      return;
    }

    const storageKey = `first_deposit_${userAddress.toLowerCase()}`;

    // Load existing first deposit date
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const timestamp = parseInt(stored, 10);
        setFirstDepositDate(timestamp);
      } else if (hasDeposits) {
        // If user has deposits but no stored date, set it now
        const now = Date.now();
        localStorage.setItem(storageKey, now.toString());
        setFirstDepositDate(now);
      }
    } catch (err) {
      console.warn('Failed to load first deposit date:', err);
    }
  }, [userAddress, hasDeposits]);

  // Calculate time since first deposit
  useEffect(() => {
    if (!firstDepositDate) {
      setTimeSinceFirst('');
      return;
    }

    const calculateTimeSince = () => {
      const now = Date.now();
      const diffMs = now - firstDepositDate;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffYears > 0) {
        return `${diffYears} year${diffYears > 1 ? 's' : ''}`;
      } else if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
      } else if (diffWeeks > 0) {
        return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''}`;
      } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        return 'just now';
      }
    };

    setTimeSinceFirst(calculateTimeSince());

    // Update every minute
    const interval = setInterval(() => {
      setTimeSinceFirst(calculateTimeSince());
    }, 60000);

    return () => clearInterval(interval);
  }, [firstDepositDate]);

  return { firstDepositDate, timeSinceFirst };
}
