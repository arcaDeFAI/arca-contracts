import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getContracts } from "../lib/contracts";
import { REGISTRY_ABI } from "../lib/contracts";
import { SUPPORTED_CHAINS } from "../config/chains";

export interface RegistryVaultInfo {
  vault: string;
  rewardClaimer: string;
  queueHandler: string;
  feeManager: string;
  tokenX: string;
  tokenY: string;
  name: string;
  symbol: string;
  isActive: boolean;
}

/**
 * Hook to discover vaults from the registry contract
 */
export function useVaultRegistry() {
  const { chainId } = useAccount();
  const contracts = chainId ? getContracts(chainId) : null;
  const registryAddress = contracts?.registry;

  // Get list of active vault addresses - using direct contract call to bypass wagmi parsing issues
  const {
    data: vaultAddresses,
    isLoading: isLoadingAddresses,
    error: vaultAddressesError,
  } = useQuery({
    queryKey: ["activeVaults", registryAddress, chainId],
    queryFn: async () => {
      if (!registryAddress || !chainId) return null;

      const { createPublicClient, http } = await import("viem");

      // Get the chain configuration based on current chainId
      const chainConfig = Object.values(SUPPORTED_CHAINS).find(
        (chain) => chain.id === chainId,
      );

      if (!chainConfig) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      const client = createPublicClient({
        chain: chainConfig,
        transport: http(),
      });

      const result = await client.readContract({
        address: registryAddress as `0x${string}`,
        abi: [
          {
            name: "getActiveVaults",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "address[]" }],
          },
        ],
        functionName: "getActiveVaults",
      });

      return result as string[];
    },
    enabled: !!registryAddress,
    staleTime: 30000,
  });

  // Get detailed info for ALL vaults
  const vaultInfoQueries = (vaultAddresses || []).map((vaultAddress) => {
    if (!registryAddress || !vaultAddress) {
      return null;
    }
    return {
      address: registryAddress as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "getVaultInfo" as const,
      args: [vaultAddress as `0x${string}`] as const,
      query: {
        staleTime: 30000, // Consider data fresh for 30 seconds
        refetchInterval: 60000, // Refetch every 60 seconds
      },
    };
  });

  // Use multiple useReadContract hooks for each vault
  // This is a temporary solution - ideally we'd use useQueries from React Query
  // For now, we'll handle up to 10 vaults (can be extended as needed)
  const vaultInfoResults = [
    useReadContract(vaultInfoQueries[0] || undefined),
    useReadContract(vaultInfoQueries[1] || undefined),
    useReadContract(vaultInfoQueries[2] || undefined),
    useReadContract(vaultInfoQueries[3] || undefined),
    useReadContract(vaultInfoQueries[4] || undefined),
    useReadContract(vaultInfoQueries[5] || undefined),
    useReadContract(vaultInfoQueries[6] || undefined),
    useReadContract(vaultInfoQueries[7] || undefined),
    useReadContract(vaultInfoQueries[8] || undefined),
    useReadContract(vaultInfoQueries[9] || undefined),
  ];

  // Check if any vault info is still loading
  const isLoadingInfo = vaultInfoResults.some(
    (result, index) =>
      index < (vaultAddresses?.length || 0) && result?.isLoading,
  );

  const isLoading = isLoadingAddresses || isLoadingInfo;

  // Build vaults array from all vault info results - MEMOIZED to prevent infinite loops
  const vaults = useMemo(() => {
    const result: RegistryVaultInfo[] = [];

    if (vaultAddresses) {
      vaultAddresses.forEach((vaultAddress, index) => {
        const vaultInfo = vaultInfoResults[index]?.data;
        if (vaultInfo) {
          result.push({
            vault: vaultInfo.vault,
            rewardClaimer: vaultInfo.rewardClaimer,
            queueHandler: vaultInfo.queueHandler,
            feeManager: vaultInfo.feeManager,
            tokenX: vaultInfo.tokenX,
            tokenY: vaultInfo.tokenY,
            name: vaultInfo.name,
            symbol: vaultInfo.symbol,
            isActive: vaultInfo.isActive,
          });
        }
      });
    }

    return result;
  }, [vaultAddresses, vaultInfoResults]);

  const error = vaultAddressesError
    ? vaultAddressesError.message || "Failed to fetch vaults from registry"
    : !registryAddress && chainId
      ? "No registry found for this network"
      : null;

  // Development logging for critical registry issues
  if (!chainId) {
    console.error(
      "❌ CRITICAL: No chainId from useAccount() - wallet not connected or wrong network",
    );
  } else if (!registryAddress) {
    console.error(
      `❌ CRITICAL: No registry address found for chainId ${chainId}`,
    );
  } else if (!vaultAddresses || vaultAddresses.length === 0) {
    console.warn(
      "⚠️ Registry returned empty vaults array - no vaults registered yet",
    );
  }

  return {
    vaults,
    isLoading,
    error,
    registryAddress,
  };
}
