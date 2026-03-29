import { useState, useEffect } from 'react';

const GOLDSKY_URL = 'https://api.goldsky.com/api/public/project_cm02vlbq40t0001w17lyt8l2p/subgraphs/arca-subgraph/1.0.0/gn';

interface RewardEvent {
  amount: string;
  timestamp: string;
}

export function useSubgraphAPR(vaultAddress: string, vaultTVL: number, rewardPrice: number) {
  const [apr, setApr] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vaultAddress || vaultTVL <= 0 || rewardPrice <= 0) {
      setIsLoading(false);
      return;
    }

    async function fetchRewards() {
      try {
        const query = `
          query GetRewards($vault: Bytes!) {
            rewardEvents(
              where: { vault: $vault }
              orderBy: timestamp
              orderDirection: desc
              first: 10
            ) {
              amount
              timestamp
            }
          }
        `;

        const response = await fetch(GOLDSKY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: { vault: vaultAddress.toLowerCase() }
          }),
        });

        const { data } = await response.json();
        const events = data?.rewardEvents || [];

        if (events.length >= 2) {
          const totalRewards = events.reduce((sum: number, e: RewardEvent) => sum + Number(e.amount) / 1e18, 0);
          const totalRewardUSD = totalRewards * rewardPrice;

          const newest = Number(events[0].timestamp);
          const oldest = Number(events[events.length - 1].timestamp);
          const timeSpanDays = Math.max((newest - oldest) / (60 * 60 * 24), 0.04);

          const annualRewardUSD = (totalRewardUSD / timeSpanDays) * 365;
          const calculatedAPR = (annualRewardUSD / vaultTVL) * 100;

          setApr(Math.max(0, calculatedAPR));
        } else {
          setApr(0);
        }
      } catch (err) {
        console.error('Subgraph fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRewards();
  }, [vaultAddress, vaultTVL, rewardPrice]);

  return { apr, isLoading };
}
