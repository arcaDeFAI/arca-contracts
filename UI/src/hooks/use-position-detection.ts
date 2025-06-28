/**
 * usePositionDetection Hook - Two-Phase Loading (Phase 1)
 *
 * Efficiently detects which vaults the user has positions in by checking balances.
 * This enables the dashboard to only fetch detailed data for relevant vaults.
 *
 * Optimized for 1-10 vaults with balance checking approach.
 * Returns array of vault addresses where user has >0 shares.
 */

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { getActiveVaultConfigs } from "../lib/vault-configs";
import { VAULT_ABI } from "../lib/contracts";

export interface PositionDetectionResult {
  vaultAddressesWithPositions: string[];
  isDetecting: boolean;
  error: string | null;
}

export function usePositionDetection(): PositionDetectionResult {
  const { address: userAddress, isConnected } = useAccount();
  const vaultConfigs = getActiveVaultConfigs();

  // Create balance check contracts for all vaults
  const balanceContracts = useMemo(() => {
    if (!isConnected || !userAddress) return [];

    const contracts = [];

    for (const config of vaultConfigs) {
      // Check both tokenX and tokenY shares for each vault
      contracts.push(
        {
          address: config.address as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "balanceOf",
          args: [userAddress, 0], // TokenX shares (index 0)
        },
        {
          address: config.address as `0x${string}`,
          abi: VAULT_ABI,
          functionName: "balanceOf",
          args: [userAddress, 1], // TokenY shares (index 1)
        },
      );
    }

    return contracts;
  }, [vaultConfigs, userAddress, isConnected]);

  // Execute balance checks
  const {
    data: balanceResults,
    isLoading,
    isError,
  } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: isConnected && !!userAddress && vaultConfigs.length > 0,
    },
  });

  // Process results to find vaults with positions
  const result = useMemo((): PositionDetectionResult => {
    if (!isConnected) {
      return {
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: null,
      };
    }

    if (isError) {
      return {
        vaultAddressesWithPositions: [],
        isDetecting: false,
        error: "Failed to detect vault positions",
      };
    }

    if (isLoading || !balanceResults) {
      return {
        vaultAddressesWithPositions: [],
        isDetecting: true,
        error: null,
      };
    }

    const vaultAddressesWithPositions: string[] = [];

    // Process balance results in pairs (tokenX, tokenY) for each vault
    for (let i = 0; i < vaultConfigs.length; i++) {
      const config = vaultConfigs[i];
      const tokenXResult = balanceResults[i * 2];
      const tokenYResult = balanceResults[i * 2 + 1];

      // Check if user has shares in either token
      const hasTokenXShares = tokenXResult?.result && tokenXResult.result > 0n;
      const hasTokenYShares = tokenYResult?.result && tokenYResult.result > 0n;

      if (hasTokenXShares || hasTokenYShares) {
        vaultAddressesWithPositions.push(config.address);
      }
    }

    return {
      vaultAddressesWithPositions,
      isDetecting: false,
      error: null,
    };
  }, [isConnected, isError, isLoading, balanceResults, vaultConfigs]);

  return result;
}

/**
 * Future optimization notes:
 *
 * When we grow beyond ~10 vaults, we can optimize this by:
 * 1. Event-based detection using transaction history
 * 2. Subgraph queries for efficient position lookup
 * 3. Backend API for cached position data
 *
 * For now, balance checking works well for 1-10 vaults and keeps things simple.
 */
