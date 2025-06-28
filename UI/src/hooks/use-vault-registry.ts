import { useAccount, useReadContract } from "wagmi";
import { getContracts } from "../lib/contracts";

// ABI for the registry contract
const REGISTRY_ABI = [
  "function getActiveVaults() external view returns (address[] memory)",
  "function getVaultInfo(address vault) external view returns (tuple(address vault, address rewardClaimer, address queueHandler, address feeManager, address tokenX, address tokenY, string name, string symbol, uint256 deploymentTimestamp, address deployer, bool isActive, bool isProxy))",
  "function getVaultDetails(address vault) external view returns (string memory name, string memory symbol, address tokenX, address tokenY, bool isActive, bool isProxy)",
] as const;

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

  // Get list of active vault addresses
  const { data: vaultAddresses, isLoading: isLoadingAddresses } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getActiveVaults",
    query: { 
      enabled: !!registryAddress,
      staleTime: 30000, // Cache for 30 seconds
    },
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

  const error = !registryAddress && chainId ? "No registry found for this network" : null;

  return {
    vaults,
    isLoading,
    error,
    registryAddress,
  };
}