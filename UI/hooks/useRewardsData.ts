'use client';

import { useReadContracts } from 'wagmi';
import { formatUnits } from 'viem';
import { METRO_VAULT_ABI } from '@/abi/MetroVault.abi';
import { ERC20_ABI } from '@/abi/ERC20.abi';
import { useTokenPrices } from './useTokenPrices';

interface RewardToken {
  address: string;
  symbol: string;
  decimals: number;
  amount: bigint;
  amountFormatted: string;
  priceUSD: number;
  valueUSD: number;
}

interface UseRewardsDataReturn {
  rewards: RewardToken[];
  totalValueUSD: number;
  isLoading: boolean;
  error: string | null;
}

export function useRewardsData(
  vaultAddress: string,
  userAddress?: string
): UseRewardsDataReturn {
  // Get pending rewards from vault
  const { data: pendingRewardsData, isLoading: rewardsLoading } = useReadContracts({
    contracts: [
      {
        address: vaultAddress as `0x${string}`,
        abi: METRO_VAULT_ABI,
        functionName: 'getPendingRewards',
        args: userAddress ? [userAddress as `0x${string}`] : undefined,
      },
    ],
    query: {
      enabled: !!userAddress && !!vaultAddress,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  });

  const pendingRewards = pendingRewardsData?.[0]?.result as Array<{
    token: string;
    pendingRewards: bigint;
  }> | undefined;

  // Extract token addresses
  const tokenAddresses = pendingRewards?.map(r => r.token) || [];

  // Fetch token info (symbol, decimals) for each reward token
  const tokenInfoContracts = tokenAddresses.flatMap(tokenAddress => [
    {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'symbol' as const,
    },
    {
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'decimals' as const,
    },
  ]);

  const { data: tokenInfoData, isLoading: tokenInfoLoading } = useReadContracts({
    contracts: tokenInfoContracts,
    query: {
      enabled: tokenAddresses.length > 0,
    },
  });

  // Fetch prices for all tokens
  const { prices, isLoading: pricesLoading } = useTokenPrices(tokenAddresses);

  // Process and combine all data
  const rewards: RewardToken[] = [];
  let totalValueUSD = 0;

  if (pendingRewards && tokenInfoData && !tokenInfoLoading && !pricesLoading) {
    pendingRewards.forEach((reward, index) => {
      const symbolResult = tokenInfoData[index * 2];
      const decimalsResult = tokenInfoData[index * 2 + 1];

      if (symbolResult?.result && decimalsResult?.result) {
        const symbol = symbolResult.result as string;
        const decimals = decimalsResult.result as number;
        const amount = reward.pendingRewards;
        const amountFormatted = formatUnits(amount, decimals);
        const priceUSD = prices[reward.token.toLowerCase()] || 0;
        const valueUSD = parseFloat(amountFormatted) * priceUSD;

        rewards.push({
          address: reward.token,
          symbol,
          decimals,
          amount,
          amountFormatted,
          priceUSD,
          valueUSD,
        });

        totalValueUSD += valueUSD;
      }
    });
  }

  return {
    rewards,
    totalValueUSD,
    isLoading: rewardsLoading || tokenInfoLoading || pricesLoading,
    error: null,
  };
}
