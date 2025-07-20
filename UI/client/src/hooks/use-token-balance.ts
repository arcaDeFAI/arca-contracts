import { useReadContract, useBalance } from 'wagmi';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { ERC20_ABI } from '@/lib/contracts';

// Hook to fetch user's token balance
export function useTokenBalance(tokenAddress: string) {
  const { address } = useAccount();

  // Check if this is the native token (address(0), empty, or wrapped S token)
  const isNativeToken = !tokenAddress || 
    tokenAddress === '0x0000000000000000000000000000000000000000' || 
    tokenAddress === '0x...' || 
    tokenAddress === '' ||
    tokenAddress === '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38'; // Wrapped S token address

  // Fetch native token balance
  const { data: nativeBalance, isLoading: nativeLoading, error: nativeError } = useBalance({
    address: address,
    query: {
      enabled: !!address && isNativeToken,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  });

  // Fetch ERC20 token balance
  const { data: erc20Balance, isLoading: erc20BalanceLoading, error: erc20BalanceError } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: {
      enabled: !!address && !!tokenAddress && !isNativeToken,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  });

  // Fetch ERC20 token decimals
  const { data: erc20Decimals, isLoading: erc20DecimalsLoading, error: erc20DecimalsError } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!tokenAddress && !isNativeToken,
    }
  });

  // Determine which values to use
  const balance = isNativeToken ? nativeBalance?.value : erc20Balance;
  const decimals = isNativeToken ? 18 : erc20Decimals; // Native tokens typically have 18 decimals
  const isLoading = isNativeToken ? nativeLoading : (erc20BalanceLoading || erc20DecimalsLoading);
  const error = isNativeToken ? nativeError : (erc20BalanceError || erc20DecimalsError);

  const formattedBalance = balance && decimals 
    ? formatUnits(balance as bigint, decimals as number)
    : '0';

  return {
    balance: formattedBalance,
    rawBalance: balance as bigint,
    decimals: decimals as number,
    isLoading,
    error,
  };
}