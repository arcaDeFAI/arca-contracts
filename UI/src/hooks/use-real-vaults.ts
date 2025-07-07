import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { useVaultMetrics } from "./use-vault-metrics";
import { useVaultRegistry } from "./use-vault-registry";
import { getChainName } from "../config/chains";
import { VAULT_ABI, ERC20_ABI } from "../lib/contracts";
import { createVaultConfigFromRegistry } from "../lib/vault-configs";
import type { RealVault } from "../types/vault";

// Hook to provide real vault data from contracts
export function useRealVaults(): {
  vaults: RealVault[];
  isLoading: boolean;
  error: string | null;
} {
  const { chainId, address: userAddress } = useAccount();

  // Use registry to discover vaults - MUST be called before any conditional returns
  const {
    vaults: registryVaults,
    isLoading: registryLoading,
    error: registryError,
  } = useVaultRegistry();

  // Prepare contract calls for all vaults
  const vaultContractCalls = useMemo(() => {
    // Only prepare calls if we have chainId and vaults
    if (!chainId || !registryVaults.length) return [];

    return registryVaults.flatMap((vault) => {
      // Create config from registry data
      const vaultConfig = createVaultConfigFromRegistry(vault, chainId);

      return [
        // Vault data
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "tokenBalance" as const,
          args: [0], // TokenX
        },
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "tokenBalance" as const,
          args: [1], // TokenY
        },
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "getShares" as const,
          args: userAddress ? [userAddress, 0] : undefined, // User shares for TokenX
        },
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "getShares" as const,
          args: userAddress ? [userAddress, 1] : undefined, // User shares for TokenY
        },
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "getPricePerFullShare" as const,
          args: [0], // TokenX
        },
        {
          address: vault.vault as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "getPricePerFullShare" as const,
          args: [1], // TokenY
        },
        // Token symbols
        {
          address: vaultConfig.tokenX.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "symbol" as const,
        },
        {
          address: vaultConfig.tokenY.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "symbol" as const,
        },
        // User balances
        {
          address: vaultConfig.tokenX.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: userAddress ? [userAddress] : undefined,
        },
        {
          address: vaultConfig.tokenY.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf" as const,
          args: userAddress ? [userAddress] : undefined,
        },
      ];
    });
  }, [chainId, registryVaults, userAddress]);

  // Read all contract data in parallel - MUST be called before any conditional returns
  const { data: contractData, isLoading: contractLoading } = useReadContracts({
    contracts: vaultContractCalls,
  });

  // Get metrics - for now using shared metrics, but can be per-vault in future - MUST be called before any conditional returns
  const {
    metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useVaultMetrics();

  // Process registry data and create RealVault objects with progressive enhancement
  const realVaults: RealVault[] = useMemo(() => {
    // If no chainId or no vaults, return empty array
    if (!chainId || registryVaults.length === 0) return [];

    const vaults: RealVault[] = [];
    const resultsPerVault = 10; // Number of contract calls per vault

    registryVaults.forEach((registryVault, vaultIndex) => {
      const startIdx = vaultIndex * resultsPerVault;

      // Extract data for this vault - handle case where contractData is not available yet
      const vaultBalanceX = contractData?.[startIdx]?.result as
        | bigint
        | undefined;
      const vaultBalanceY = contractData?.[startIdx + 1]?.result as
        | bigint
        | undefined;
      const userSharesX = contractData?.[startIdx + 2]?.result as
        | bigint
        | undefined;
      const userSharesY = contractData?.[startIdx + 3]?.result as
        | bigint
        | undefined;
      const pricePerShareX = contractData?.[startIdx + 4]?.result as
        | bigint
        | undefined;
      const pricePerShareY = contractData?.[startIdx + 5]?.result as
        | bigint
        | undefined;
      const tokenXSymbol = contractData?.[startIdx + 6]?.result as
        | string
        | undefined;
      const tokenYSymbol = contractData?.[startIdx + 7]?.result as
        | string
        | undefined;
      const userBalanceX = contractData?.[startIdx + 8]?.result as
        | bigint
        | undefined;
      const userBalanceY = contractData?.[startIdx + 9]?.result as
        | bigint
        | undefined;

      // Create vault config from registry data (always available)
      const vaultConfig = createVaultConfigFromRegistry(registryVault, chainId);

      // Use token symbols from contract data if available, otherwise fall back to config
      const finalTokenXSymbol = tokenXSymbol || vaultConfig.tokenX.symbol;
      const finalTokenYSymbol = tokenYSymbol || vaultConfig.tokenY.symbol;

      const realVault: RealVault = {
        id: registryVault.vault,
        name: registryVault.name || `${finalTokenXSymbol}-${finalTokenYSymbol}`,
        tokens: [finalTokenXSymbol, finalTokenYSymbol],
        platform: "DLMM",
        chain: getChainName(chainId),

        // Real-time contract data (show 0 while loading)
        vaultBalanceX: (vaultBalanceX || 0n).toString(),
        vaultBalanceY: (vaultBalanceY || 0n).toString(),
        userSharesX: (userSharesX || 0n).toString(),
        userSharesY: (userSharesY || 0n).toString(),
        pricePerShareX: pricePerShareX ? formatEther(pricePerShareX) : "1", // Default to 1:1 while loading
        pricePerShareY: pricePerShareY ? formatEther(pricePerShareY) : "1",

        // Calculated values from metrics (optional - loaded async)
        totalTvl: metrics?.totalTvlUSD,
        userBalance: metrics?.userTotalUSD,
        apr: metrics?.realApr,
        aprDaily: metrics?.dailyApr,

        // Enhanced user metrics (optional - loaded async)
        userEarnings: metrics?.userEarnings,
        userROI: metrics?.userROI,
        userTotalDeposited: metrics?.userTotalDeposited,

        // USD breakdowns for display (optional - loaded async)
        vaultBalanceXUSD: metrics?.vaultBalanceXUSD,
        vaultBalanceYUSD: metrics?.vaultBalanceYUSD,
        userSharesXUSD: metrics?.userSharesXUSD,
        userSharesYUSD: metrics?.userSharesYUSD,

        contractAddress: registryVault.vault,
        isActive: true,
        description: `Automated liquidity provision for ${tokenXSymbol}/${tokenYSymbol} on Metropolis DLMM with Metro reward compounding`,

        // User balances for deposit/withdraw UI - format with proper decimals
        userBalanceX: userBalanceX && vaultConfig ? formatUnits(userBalanceX, vaultConfig.tokenX.decimals) : "0.0",
        userBalanceY: userBalanceY && vaultConfig ? formatUnits(userBalanceY, vaultConfig.tokenY.decimals) : "0.0",

        // Queue status - TODO: fetch these from queue handler
        pendingDeposits: "0",
        pendingWithdraws: "0",

        // Data freshness indicators
        lastUpdated: metrics?.lastUpdated,
        isStale: metrics?.isStale,

        // Loading states for progressive enhancement
        metricsLoading,
        metricsError: metrics?.priceDataError || metricsError,
      };

      vaults.push(realVault);
    });

    return vaults;
  }, [
    contractData,
    registryVaults,
    metrics,
    metricsLoading,
    metricsError,
    chainId,
  ]);

  // Loading state - show loading only when discovering vaults (not when fetching contract data or metrics)
  // This enables progressive enhancement: show vault list immediately, load details async
  const isLoading = chainId ? registryLoading : true; // Only wait for registry, not contract data

  // Add error handling for registry and contract data loading only
  // Metrics errors are handled within the metrics object (progressive enhancement)
  const error = useMemo(() => {
    if (registryError) {
      return `Registry error: ${registryError}`;
    }

    if (registryVaults.length === 0 && chainId && !registryLoading) {
      return null; // Empty vault list is not an error - user may not have any vaults
    }

    return null;
  }, [registryError, registryVaults.length, chainId, registryLoading]);

  // If no chainId, user needs to connect wallet or switch to supported network
  // This MUST come after all hooks to avoid React hooks errors
  if (!chainId) {
    return {
      vaults: [],
      isLoading: false,
      error: null, // Let parent components handle wallet connection UI
    };
  }

  return {
    vaults: realVaults,
    isLoading,
    error,
  };
}
