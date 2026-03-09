'use client';

import { usePrices } from '@/contexts/PriceContext';
import { useState, useEffect } from 'react';

export function PriceStalenessIndicator() {
  const { lastUpdated, isLoading } = usePrices();
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastUpdated) {
        setTimeAgo('');
        return;
      }

      const seconds = Math.floor((Date.now() - lastUpdated) / 1000);

      // Consider stale if more than 3 minutes old
      setIsStale(seconds > 180);

      if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  if (isLoading || !timeAgo) {
    return null;
  }

  return (
    <div className={`text-xs ${isStale ? 'text-yellow-400' : 'text-gray-500'}`}>
      Prices: {timeAgo}
    </div>
  );
}
