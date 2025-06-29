import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useVault } from "./use-vault";
import { useVaultMetrics } from "./use-vault-metrics";
import { useVaultRegistry } from "./use-vault-registry";
import { getChainName } from "../config/chains";
import type { RealVault } from "../types/vault";

// Hook to provide real vault data from contracts
export function useRealVaults(): {
  vaults: RealVault[];
  isLoading: boolean;
  error: string | null;
} {
  const { chainId } = useAccount();

  // If no chainId, user needs to connect wallet or switch to supported network
  if (!chainId) {
    return {
      vaults: [],
      isLoading: false,
      error: null, // Let parent components handle wallet connection UI
    };
  }

  // Use registry to discover vaults
  const {
    vaults: registryVaults,
    isLoading: registryLoading,
    error: registryError,
  } = useVaultRegistry();

  // For now, use the first vault from registry (single vault support)
  const firstVault = registryVaults[0];
  const vault = useVault(firstVault?.vault);
  const {
    metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useVaultMetrics();

  // Create vault data from registry info + contract data
  const realVaults: RealVault[] = useMemo(() => {
    if (!firstVault || !vault.vaultConfig) {
      return [];
    }

    const realVault: RealVault = {
      id: firstVault.vault,
      name: firstVault.name || `${vault.tokenXSymbol}-${vault.tokenYSymbol}`,
      tokens: [vault.tokenXSymbol, vault.tokenYSymbol],
      platform: "DLMM",
      chain: getChainName(chainId),

      // Real-time contract data (always available)
      vaultBalanceX: vault.vaultBalanceX,
      vaultBalanceY: vault.vaultBalanceY,
      userSharesX: vault.userSharesX,
      userSharesY: vault.userSharesY,
      pricePerShareX: vault.pricePerShareX,
      pricePerShareY: vault.pricePerShareY,

      // Calculated values from metrics (optional - loaded async)
      totalTvl: metrics?.totalTvlUSD,
      userBalance: metrics?.userTotalUSD,
      apr: metrics?.estimatedApr,
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

      contractAddress: firstVault.vault,
      isActive: true,
      description:
        "Automated liquidity provision for wS/USDC.e on Metropolis DLMM with Metro reward compounding",

      // User balances for deposit/withdraw UI
      userBalanceX: vault.userBalanceX,
      userBalanceY: vault.userBalanceY,

      // Queue status
      pendingDeposits: vault.pendingDeposits,
      pendingWithdraws: vault.pendingWithdraws,

      // Data freshness indicators
      lastUpdated: metrics?.lastUpdated,
      isStale: metrics?.isStale,

      // Loading states for progressive enhancement
      metricsLoading,
      metricsError: metrics?.priceDataError || metricsError,
    };

    return [realVault];
  }, [
    firstVault,
    vault.vaultConfig,
    vault.vaultBalanceX,
    vault.vaultBalanceY,
    vault.userSharesX,
    vault.userSharesY,
    vault.pricePerShareX,
    vault.pricePerShareY,
    vault.userBalanceX,
    vault.userBalanceY,
    vault.pendingDeposits,
    vault.pendingWithdraws,
    metrics,
    metricsLoading,
    metricsError,
    chainId,
  ]);

  // Loading state - show loading only when discovering vaults (not when fetching metrics)
  const isLoading = chainId
    ? registryLoading || !firstVault || !vault.vaultConfig
    : true; // Still loading if we don't have chainId yet

  // Debug logging to trace the issue
  console.log("🔍 useRealVaults debug:", {
    chainId,
    registryLoading,
    registryError,
    firstVault: firstVault?.vault,
    vaultConfig: !!vault.vaultConfig,
    isLoading,
    totalVaults: registryVaults.length,
  });

  // CRITICAL DEBUG: Identify exact blocking point
  if (!chainId) {
    console.error(
      "❌ REAL VAULTS BLOCKED: No chainId - check wallet connection",
    );
  } else if (registryError) {
    console.error("❌ REAL VAULTS BLOCKED: Registry error:", registryError);
  } else if (registryLoading) {
    console.log("⏳ REAL VAULTS WAITING: Registry loading...");
  } else if (!firstVault) {
    console.error("❌ REAL VAULTS BLOCKED: No vault found in registry");
  } else if (!vault.vaultConfig) {
    console.error("❌ REAL VAULTS BLOCKED: Vault config not loaded");
  } else {
    console.log("✅ REAL VAULTS: All dependencies loaded, should show vault");
  }

  // Add error handling for registry and contract data loading only
  // Metrics errors are handled within the metrics object (progressive enhancement)
  const error = useMemo(() => {
    if (registryError) {
      return `Registry error: ${registryError}`;
    }

    if (!firstVault && chainId && !registryLoading) {
      return "No vaults found in registry";
    }

    return null;
  }, [registryError, firstVault, chainId, registryLoading]);

  return {
    vaults: realVaults,
    isLoading,
    error,
  };
}
