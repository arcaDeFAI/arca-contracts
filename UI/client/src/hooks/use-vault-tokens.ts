import { useReadContract } from 'wagmi';
import { VAULT_STRATEGY_ABI, CONTRACT_ADDRESSES } from '@/lib/contracts';

// Hook to fetch the actual addresses from the strategy contract
export function useVaultTokens(vaultName: string) {
  // Get strategy contract address
  const strategyKey = vaultName.replace('-', '/') as keyof typeof CONTRACT_ADDRESSES.strategies;
  const strategyAddress = CONTRACT_ADDRESSES.strategies[strategyKey];

  // Fetch TokenX address
  const { data: tokenXAddress, isLoading: loadingX } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: VAULT_STRATEGY_ABI,
    functionName: 'getTokenX',
  });

  // Fetch TokenY address
  const { data: tokenYAddress, isLoading: loadingY } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: VAULT_STRATEGY_ABI,
    functionName: 'getTokenY',
  });

  // Fetch actual Vault address
  const { data: vaultAddress, isLoading: loadingVault } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: VAULT_STRATEGY_ABI,
    functionName: 'getVault',
  });

  return {
    tokenXAddress: tokenXAddress as string,
    tokenYAddress: tokenYAddress as string,
    vaultAddress: vaultAddress as string,
    strategyAddress,
    isLoading: loadingX || loadingY || loadingVault,
  };
}