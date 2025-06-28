/**
 * useDashboardData Hook - Multi-Vault Portfolio Aggregation
 *
 * Aggregates data across all active vaults to provide portfolio-level metrics:
 * - Total portfolio value
 * - Historical deposits
 * - Earnings and ROI calculations
 * - Individual vault positions
 *
 * This hook implements the requirements defined by the TDD tests.
 */

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { getVaultConfig } from "../lib/vault-configs";
import { useVault } from "./use-vault";
import { useVaultMetrics } from "./use-vault-metrics";
import { useTransactionHistory } from "./use-transaction-history";
import { usePositionDetection } from "./use-position-detection";

export interface VaultPosition {
  vaultAddress: string;
  vaultName: string;
  tokenX: {
    symbol: string;
    shares: string;
    value: number;
  };
  tokenY: {
    symbol: string;
    shares: string;
    value: number;
  };
  value: number;
  apy: number;
}

export interface DashboardData {
  // Portfolio totals
  totalPortfolioValue: number;
  totalDeposited: number;
  totalEarnings: number;
  totalROI: number;

  // Individual vault positions
  vaultPositions: VaultPosition[];

  // State management
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  try {
    const { chainId } = useAccount();
    
    // Get transaction history for deposit calculations
    const { transactions } = useTransactionHistory();

    // Phase 1: Position Detection (Fast)
    const {
      vaultAddressesWithPositions,
      isDetecting,
      error: detectionError,
    } = usePositionDetection();

    // Phase 2: Detailed Data Loading (Only for vaults with positions)
    // TODO: This approach hardcodes 10 vault hooks to respect React hooks rules.
    // For >10 user positions, we'll need to either:
    // 1. Use component composition (separate components per vault position)
    // 2. Move vault fetching outside React hooks (external state management)
    // 3. Use custom async state management instead of wagmi hooks
    // For now, this works well for 1-10 vaults which covers realistic usage.
    const vault1 = useVault(vaultAddressesWithPositions[0]);
    const vault2 = useVault(vaultAddressesWithPositions[1]);
    const vault3 = useVault(vaultAddressesWithPositions[2]);
    const vault4 = useVault(vaultAddressesWithPositions[3]);
    const vault5 = useVault(vaultAddressesWithPositions[4]);
    const vault6 = useVault(vaultAddressesWithPositions[5]);
    const vault7 = useVault(vaultAddressesWithPositions[6]);
    const vault8 = useVault(vaultAddressesWithPositions[7]);
    const vault9 = useVault(vaultAddressesWithPositions[8]);
    const vault10 = useVault(vaultAddressesWithPositions[9]);

    const metrics1 = useVaultMetrics(vaultAddressesWithPositions[0]);
    const metrics2 = useVaultMetrics(vaultAddressesWithPositions[1]);
    const metrics3 = useVaultMetrics(vaultAddressesWithPositions[2]);
    const metrics4 = useVaultMetrics(vaultAddressesWithPositions[3]);
    const metrics5 = useVaultMetrics(vaultAddressesWithPositions[4]);
    const metrics6 = useVaultMetrics(vaultAddressesWithPositions[5]);
    const metrics7 = useVaultMetrics(vaultAddressesWithPositions[6]);
    const metrics8 = useVaultMetrics(vaultAddressesWithPositions[7]);
    const metrics9 = useVaultMetrics(vaultAddressesWithPositions[8]);
    const metrics10 = useVaultMetrics(vaultAddressesWithPositions[9]);

    // Collect all vault data
    const allVaultData = [
      { vault: vault1, metrics: metrics1 },
      { vault: vault2, metrics: metrics2 },
      { vault: vault3, metrics: metrics3 },
      { vault: vault4, metrics: metrics4 },
      { vault: vault5, metrics: metrics5 },
      { vault: vault6, metrics: metrics6 },
      { vault: vault7, metrics: metrics7 },
      { vault: vault8, metrics: metrics8 },
      { vault: vault9, metrics: metrics9 },
      { vault: vault10, metrics: metrics10 },
    ];

    // Calculate vault positions
    const vaultPositions: VaultPosition[] = useMemo(() => {
      if (!chainId) return [];
      
      return vaultAddressesWithPositions.map((vaultAddress, index) => {
        const config = getVaultConfig(vaultAddress, chainId);
        const { vault, metrics: vaultMetrics } = allVaultData[index] || {};

        // Fallback if config not found (shouldn't happen in normal operation)
        if (!config) {
          return {
            vaultAddress,
            vaultName: "Unknown Vault",
            tokenX: { symbol: "?", shares: "0", value: 0 },
            tokenY: { symbol: "?", shares: "0", value: 0 },
            value: 0,
            apy: 0,
          };
        }

        // Always create a position object, even if data is missing
        if (!vault || !vaultMetrics) {
          return {
            vaultAddress: config.address,
            vaultName: config.name,
            tokenX: { symbol: config.tokenX.symbol, shares: "0", value: 0 },
            tokenY: { symbol: config.tokenY.symbol, shares: "0", value: 0 },
            value: 0,
            apy: 0,
          };
        }

        // Calculate token values
        const sharesX = parseFloat(vault.userSharesX || "0");
        const sharesY = parseFloat(vault.userSharesY || "0");
        const pricePerShareX = parseFloat(vault.pricePerShareX || "0");
        const pricePerShareY = parseFloat(vault.pricePerShareY || "0");

        // Get token prices (default to 0 if unavailable)
        const tokenPriceX = vaultMetrics.tokenPrices?.tokenX || 0;
        const tokenPriceY = vaultMetrics.tokenPrices?.tokenY || 0;

        // Calculate USD values for each token
        const tokenXValue = sharesX * pricePerShareX * tokenPriceX;
        const tokenYValue = sharesY * pricePerShareY * tokenPriceY;

        return {
          vaultAddress: config.address,
          vaultName: config.name,
          tokenX: {
            symbol: vault.tokenXSymbol || config.tokenX.symbol,
            shares: vault.userSharesX || "0",
            value: tokenXValue,
          },
          tokenY: {
            symbol: vault.tokenYSymbol || config.tokenY.symbol,
            shares: vault.userSharesY || "0",
            value: tokenYValue,
          },
          value: tokenXValue + tokenYValue,
          apy: vaultMetrics.apy || 0,
        };
      });
    }, [
      chainId,
      vaultAddressesWithPositions,
      ...allVaultData.map((d) => d.vault),
      ...allVaultData.map((d) => d.metrics),
    ]);

    // Calculate total portfolio value
    const totalPortfolioValue = useMemo(() => {
      return vaultPositions.reduce(
        (total, position) => total + position.value,
        0,
      );
    }, [vaultPositions]);

    // Calculate total historical deposits from transaction history
    const totalDeposited = useMemo(() => {
      if (!transactions || !Array.isArray(transactions)) return 0;

      return transactions
        .filter((tx) => tx.type === "deposit")
        .reduce((total, tx) => total + (tx.usdValue || 0), 0);
    }, [transactions]);

    // Calculate earnings and ROI
    const totalEarnings = useMemo(() => {
      return totalPortfolioValue - totalDeposited;
    }, [totalPortfolioValue, totalDeposited]);

    const totalROI = useMemo(() => {
      if (totalDeposited === 0) return 0;
      return (totalEarnings / totalDeposited) * 100;
    }, [totalEarnings, totalDeposited]);

    // Determine loading state - includes both phases
    const isLoading = useMemo(() => {
      return isDetecting || transactions === undefined;
    }, [isDetecting, transactions]);

    return {
      totalPortfolioValue,
      totalDeposited,
      totalEarnings,
      totalROI,
      vaultPositions,
      isLoading,
      error: detectionError,
    };
  } catch (error) {
    // Handle any errors gracefully
    return {
      totalPortfolioValue: 0,
      totalDeposited: 0,
      totalEarnings: 0,
      totalROI: 0,
      vaultPositions: [],
      isLoading: false,
      error: "Failed to load dashboard data",
    };
  }
}

// Helper hook for individual vault calculations (used internally)
function useVaultValue(vaultAddress: string): number {
  const vault = useVault(vaultAddress);
  const metrics = useVaultMetrics(vaultAddress);

  return useMemo(() => {
    const sharesX = parseFloat(vault.userSharesX || "0");
    const sharesY = parseFloat(vault.userSharesY || "0");
    const pricePerShareX = parseFloat(vault.pricePerShareX || "0");
    const pricePerShareY = parseFloat(vault.pricePerShareY || "0");

    const tokenPriceX = metrics.tokenPrices?.tokenX || 0;
    const tokenPriceY = metrics.tokenPrices?.tokenY || 0;

    const valueX = sharesX * pricePerShareX * tokenPriceX;
    const valueY = sharesY * pricePerShareY * tokenPriceY;

    return valueX + valueY;
  }, [vault, metrics]);
}
