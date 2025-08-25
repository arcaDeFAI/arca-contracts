'use client';

import { useState, useEffect } from 'react';

interface CoinGeckoResponse {
  'sonic-3': {
    usd: number;
  };
}

export function useSonicPrice() {
  const [price, setPrice] = useState<number>(1); // Default to $1 as fallback
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=sonic-3&vs_currencies=usd',
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: CoinGeckoResponse = await response.json();
        
        if (data['sonic-3']?.usd) {
          setPrice(data['sonic-3'].usd);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Failed to fetch Sonic price:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Keep fallback price of $1
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();

    // Refresh price every 5 minutes
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    price,
    isLoading,
    error,
  };
}
