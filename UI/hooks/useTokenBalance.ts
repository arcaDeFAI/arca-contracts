'use client';

import { useReadContract, useBalance } from 'wagmi';
import { ERC20_ABI } from '@/lib/contracts';

export function useTokenBalance(tokenAddress: string | null, userAddress?: string) {
  // For native S token (null address), use useBalance instead of ERC20 contract call
  const isNativeToken = tokenAddress === null;

  const nativeBalance = useBalance({
    address: userAddress as `0x${string}`,
    query: {
      enabled: !!userAddress && isNativeToken,
    },
  });

  const erc20Balance = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
    query: {
      enabled: !!userAddress && !!tokenAddress && !isNativeToken,
    },
  });

  // Return native balance for native token, ERC20 balance for others
  if (isNativeToken) {
    return {
      data: nativeBalance.data?.value,
      isLoading: nativeBalance.isLoading,
      isError: nativeBalance.isError,
    };
  }

  return erc20Balance;
}
