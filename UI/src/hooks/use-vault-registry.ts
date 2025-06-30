import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
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
  const vaultInfoQueries = (vaultAddresses || []).map((vaultAddress) => ({
    address: registryAddress as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getVaultInfo" as const,
    args: [vaultAddress as `0x${string}`],
    enabled: !!registryAddress && !!vaultAddress,
  }));

  // Use multiple useReadContract hooks for each vault
  // This is a temporary solution - ideally we'd use useQueries from React Query
  // For now, we'll handle up to 10 vaults (can be extended as needed)
  const vaultInfoResults = [
    useReadContract(vaultInfoQueries[0] || { enabled: false }),
    useReadContract(vaultInfoQueries[1] || { enabled: false }),
    useReadContract(vaultInfoQueries[2] || { enabled: false }),
    useReadContract(vaultInfoQueries[3] || { enabled: false }),
    useReadContract(vaultInfoQueries[4] || { enabled: false }),
    useReadContract(vaultInfoQueries[5] || { enabled: false }),
    useReadContract(vaultInfoQueries[6] || { enabled: false }),
    useReadContract(vaultInfoQueries[7] || { enabled: false }),
    useReadContract(vaultInfoQueries[8] || { enabled: false }),
    useReadContract(vaultInfoQueries[9] || { enabled: false }),
  ];

  // Check if any vault info is still loading
  const isLoadingInfo = vaultInfoResults.some(
    (result, index) =>
      index < (vaultAddresses?.length || 0) && result?.isLoading,
  );

  const isLoading = isLoadingAddresses || isLoadingInfo;

  // Build vaults array from all vault info results
  const vaults: RegistryVaultInfo[] = [];

  if (vaultAddresses) {
    vaultAddresses.forEach((vaultAddress, index) => {
      const vaultInfo = vaultInfoResults[index]?.data;
      if (vaultInfo) {
        vaults.push({
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

  const error = vaultAddressesError
    ? vaultAddressesError.message || "Failed to fetch vaults from registry"
    : !registryAddress && chainId
      ? "No registry found for this network"
      : null;

  // Debug logging
  console.log("🔍 useVaultRegistry debug:", {
    chainId,
    registryAddress,
    isLoadingAddresses,
    isLoadingInfo,
    isLoading,
    vaultAddresses,
    vaultCount: vaults.length,
    error,
    vaultAddressesError: vaultAddressesError?.message,
  });

  // CRITICAL DEBUG: Check if we have the right setup
  if (!chainId) {
    console.error(
      "❌ CRITICAL: No chainId from useAccount() - wallet not connected or wrong network",
    );
  } else if (!registryAddress) {
    console.error(
      `❌ CRITICAL: No registry address found for chainId ${chainId}`,
    );
  } else if (isLoadingAddresses) {
    console.log("⏳ Waiting for registry.getActiveVaults() call...");
  } else if (!vaultAddresses || vaultAddresses.length === 0) {
    console.error(
      "❌ CRITICAL: Registry returned empty vaults array - vault not registered correctly",
    );
  } else {
    console.log(
      `✅ Registry working correctly on chain ${chainId}, vault discovery should succeed`,
    );
  }

  return {
    vaults,
    isLoading,
    error,
    registryAddress,
  };
}
