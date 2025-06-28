import { useAccount, useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getContracts } from "../lib/contracts";
import { REGISTRY_ABI } from "../lib/contracts";

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
    queryKey: ["activeVaults", registryAddress],
    queryFn: async () => {
      if (!registryAddress) return null;

      const { createPublicClient, http } = await import("viem");
      const client = createPublicClient({
        chain: {
          id: 31337,
          name: "localhost",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
        },
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

  // Get detailed info for each vault (we'll start with just the first one for now)
  const firstVaultAddress = vaultAddresses?.[0];
  const { data: vaultInfo, isLoading: isLoadingInfo } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getVaultInfo",
    args: [firstVaultAddress as `0x${string}`],
    query: {
      enabled: !!registryAddress && !!firstVaultAddress,
      staleTime: 30000,
    },
  });

  const isLoading = isLoadingAddresses || isLoadingInfo;

  const vaults: RegistryVaultInfo[] = [];

  if (vaultInfo && firstVaultAddress) {
    vaults.push({
      vault: vaultInfo[0],
      rewardClaimer: vaultInfo[1],
      queueHandler: vaultInfo[2],
      feeManager: vaultInfo[3],
      tokenX: vaultInfo[4],
      tokenY: vaultInfo[5],
      name: vaultInfo[6],
      symbol: vaultInfo[7],
      isActive: vaultInfo[10],
    });
  }

  const error =
    !registryAddress && chainId ? "No registry found for this network" : null;

  // Debug logging
  console.log("🔍 useVaultRegistry debug:", {
    chainId,
    registryAddress,
    isLoadingAddresses,
    isLoadingInfo,
    isLoading,
    vaultAddresses,
    vaultInfo,
    vaults: vaults.length,
    error,
    vaultAddressesError: vaultAddressesError?.message,
  });

  // CRITICAL DEBUG: Check if we have the right setup
  if (!chainId) {
    console.error(
      "❌ CRITICAL: No chainId from useAccount() - wallet not connected or wrong network",
    );
  } else if (chainId !== 31337) {
    console.error(
      `❌ CRITICAL: Wrong chainId ${chainId}, expected 31337 for localhost`,
    );
  } else if (!registryAddress) {
    console.error("❌ CRITICAL: No registry address found for chainId 31337");
  } else if (isLoadingAddresses) {
    console.log("⏳ Waiting for registry.getActiveVaults() call...");
  } else if (!vaultAddresses || vaultAddresses.length === 0) {
    console.error(
      "❌ CRITICAL: Registry returned empty vaults array - vault not registered correctly",
    );
  } else {
    console.log(
      "✅ Registry working correctly, vault discovery should succeed",
    );
  }

  return {
    vaults,
    isLoading,
    error,
    registryAddress,
  };
}
