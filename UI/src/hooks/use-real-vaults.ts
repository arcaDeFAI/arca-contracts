import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useVault } from "./use-vault";
import { useVaultMetrics } from "./use-vault-metrics";
import { useVaultRegistry } from "./use-vault-registry";
import type { RealVault } from "../types/vault";

// Hook to provide real vault data from contracts
export function useRealVaults(): {
  vaults: RealVault[];
  isLoading: boolean;
  error: string | null;
} {
  const { chainId } = useAccount();
  
  // Use registry to discover vaults
  const { 
    vaults: registryVaults, 
    isLoading: registryLoading, 
    error: registryError 
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
    if (!firstVault || !vault.vaultConfig || !metrics) {
      return [];
    }

    const realVault: RealVault = {
      id: firstVault.vault,
      name: firstVault.name || `${vault.tokenXSymbol}-${vault.tokenYSymbol}`,
      tokens: [vault.tokenXSymbol, vault.tokenYSymbol],
      platform: "Arca DLMM",
      chain: chainId === 31337 ? "Localhost" : chainId === 31338 ? "Sonic Fork" : "Sonic",

      // Real-time contract data
      vaultBalanceX: vault.vaultBalanceX,
      vaultBalanceY: vault.vaultBalanceY,
      userSharesX: vault.userSharesX,
      userSharesY: vault.userSharesY,
      pricePerShareX: vault.pricePerShareX,
      pricePerShareY: vault.pricePerShareY,

      // Calculated values from metrics
      totalTvl: metrics.totalTvlUSD,
      userBalance: metrics.userTotalUSD,
      apr: metrics.estimatedApr,
      aprDaily: metrics.dailyApr,

      // Enhanced user metrics
      userEarnings: metrics.userEarnings,
      userROI: metrics.userROI,
      userTotalDeposited: metrics.userTotalDeposited,

      // USD breakdowns for display
      vaultBalanceXUSD: metrics.vaultBalanceXUSD,
      vaultBalanceYUSD: metrics.vaultBalanceYUSD,
      userSharesXUSD: metrics.userSharesXUSD,
      userSharesYUSD: metrics.userSharesYUSD,

      contractAddress: firstVault.vault,
      isActive: true,
      description:
        "Automated liquidity provision for wS/USDC.e on Metropolis DLMM with Metro reward compounding",

      // User balances for deposit/withdraw UI
      userBalanceWS: vault.userBalanceWS,
      userBalanceUSDC: vault.userBalanceUSDC,

      // Queue status
      pendingDeposits: vault.pendingDeposits,
      pendingWithdraws: vault.pendingWithdraws,

      // Data freshness indicators
      lastUpdated: metrics.lastUpdated,
      isStale: metrics.isStale,
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
    chainId,
  ]);

  // Loading state - show loading when discovering vaults or fetching data
  const isLoading = !!chainId && (registryLoading || !firstVault || !vault.vaultConfig || metricsLoading);

  // Add error handling for registry and contract data loading
  const error = useMemo(() => {
    if (registryError) {
      return `Registry error: ${registryError}`;
    }
    
    if (metricsError) {
      return `Metrics error: ${metricsError}`;
    }

    if (!firstVault && chainId && !registryLoading) {
      return "No vaults found in registry";
    }

    return null;
  }, [
    registryError,
    metricsError,
    firstVault,
    chainId,
    registryLoading,
  ]);

  return {
    vaults: realVaults,
    isLoading,
    error,
  };
}
