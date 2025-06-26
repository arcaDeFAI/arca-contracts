import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useVault } from "./use-vault";
import { useVaultMetrics } from "./use-vault-metrics";
import type { RealVault } from "../types/vault";

// Hook to provide real vault data from contracts
export function useRealVaults(): {
  vaults: RealVault[];
  isLoading: boolean;
  error: string | null;
} {
  const { chainId } = useAccount();
  const vault = useVault();
  const {
    metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useVaultMetrics();

  // For now we have one vault - wS/USDC.e on Sonic
  const realVaults: RealVault[] = useMemo(() => {
    if (!vault.contracts || !metrics) {
      return [];
    }

    const realVault: RealVault = {
      id: vault.contracts.vault,
      name: "wS-USDC.e",
      tokens: ["wS", "USDC.e"],
      platform: "Arca DLMM",
      chain: chainId === 31337 ? "Sonic Fork" : "Sonic",

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

      contractAddress: vault.contracts.vault,
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
    vault.contracts,
    vault.vaultBalanceX,
    vault.vaultBalanceY,
    vault.userSharesX,
    vault.userSharesY,
    vault.pricePerShareX,
    vault.pricePerShareY,
    vault.userBalanceWS,
    vault.userBalanceUSDC,
    vault.pendingDeposits,
    vault.pendingWithdraws,
    metrics,
    chainId,
  ]);

  // Loading state - if any key data is still loading
  const isLoading =
    !vault.contracts ||
    metricsLoading ||
    (vault.vaultBalanceX === "0" &&
      vault.vaultBalanceY === "0" &&
      !vault.userBalanceWS);

  // Add error handling for contract data loading
  const error = useMemo(() => {
    if (metricsError) {
      return `Metrics error: ${metricsError}`;
    }

    if (!vault.contracts && chainId) {
      return "Contracts not available for this network";
    }

    // Check if we're getting contract read errors
    // This is a simplified check - in production we'd track individual query errors
    if (
      vault.contracts &&
      vault.vaultBalanceX === "0" &&
      vault.vaultBalanceY === "0" &&
      !isLoading
    ) {
      // This might be normal for an empty vault, so no error
      return null;
    }

    return null;
  }, [
    vault.contracts,
    chainId,
    vault.vaultBalanceX,
    vault.vaultBalanceY,
    isLoading,
    metricsError,
  ]);

  return {
    vaults: realVaults,
    isLoading,
    error,
  };
}
