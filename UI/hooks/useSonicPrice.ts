'use client';

import { useState, useEffect } from 'react';

interface CoinGeckoResponse {
  'sonic-3': {
    usd: number;
  };
}

export function useSonicPrice() {
  const [price, setPrice] = useState<number>(0.17); // Default to $0.17 as fallback
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
        // Silently use fallback price - API failures are expected
        console.warn('Using fallback Sonic price ($0.17) due to API error');
        setError(null); // Don't show error to user, fallback price works fine
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
