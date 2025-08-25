'use client';

import { useReadContract, useBalance } from 'wagmi';
import { ERC20_ABI, CONTRACTS } from '@/lib/contracts';

export function useTokenBalance(tokenAddress: string, userAddress?: string) {
  // For native S token, use useBalance instead of ERC20 contract call
  const isNativeS = tokenAddress === CONTRACTS.SONIC;
  
  const nativeBalance = useBalance({
    address: userAddress as `0x${string}`,
    query: {
      enabled: !!userAddress && isNativeS,
    },
  });
  
  const erc20Balance = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
    query: {
      enabled: !!userAddress && !!tokenAddress && !isNativeS,
    },
  });
  
  // Return native balance for S token, ERC20 balance for others
  if (isNativeS) {
    return {
      data: nativeBalance.data?.value,
      isLoading: nativeBalance.isLoading,
      isError: nativeBalance.isError,
    };
  }
  
  return erc20Balance;
}
