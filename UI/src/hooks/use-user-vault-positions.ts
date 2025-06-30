/**
 * useUserVaultPositions Hook - Smart Position Detection
 *
 * Detects which vaults the user has active positions in by checking share balances.
 * This enables the dashboard to only fetch detailed data for relevant vaults,
 * solving both performance and React hooks rule issues.
 *
 * Returns array of vault addresses where user has >0 shares.
 */

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { getActiveVaultConfigs } from "../lib/vault-configs";
import { useVault } from "./use-vault";

export function useUserVaultPositions(): string[] {
  const { isConnected, chainId } = useAccount();
  const vaultConfigs = chainId ? getActiveVaultConfigs(chainId) : [];

  // For now, we'll check a reasonable number of vaults (up to 10)
  // This respects React hooks rules while being practical for most DeFi platforms
  const vault1 = useVault(vaultConfigs[0]?.address);
  const vault2 = useVault(vaultConfigs[1]?.address);
  const vault3 = useVault(vaultConfigs[2]?.address);
  const vault4 = useVault(vaultConfigs[3]?.address);
  const vault5 = useVault(vaultConfigs[4]?.address);
  const vault6 = useVault(vaultConfigs[5]?.address);
  const vault7 = useVault(vaultConfigs[6]?.address);
  const vault8 = useVault(vaultConfigs[7]?.address);
  const vault9 = useVault(vaultConfigs[8]?.address);
  const vault10 = useVault(vaultConfigs[9]?.address);

  const allVaultData = [
    vault1,
    vault2,
    vault3,
    vault4,
    vault5,
    vault6,
    vault7,
    vault8,
    vault9,
    vault10,
  ];

  return useMemo(() => {
    if (!isConnected) return [];

    const activeVaultAddresses: string[] = [];

    vaultConfigs.forEach((config, index) => {
      if (index >= 10) return; // Limit to 10 vaults for hooks rules

      const vaultData = allVaultData[index];
      if (!vaultData) return;

      const sharesX = parseFloat(vaultData.userSharesX || "0");
      const sharesY = parseFloat(vaultData.userSharesY || "0");

      // User has position if they have shares in either token
      if (sharesX > 0 || sharesY > 0) {
        activeVaultAddresses.push(config.address);
      }
    });

    return activeVaultAddresses;
  }, [isConnected, vaultConfigs, ...allVaultData]);
}

/**
 * Alternative implementation for future optimization:
 * This could be replaced with event-based detection or subgraph queries
 * for better performance with >10 vaults:
 *
 * export function useUserVaultPositionsOptimized(): string[] {
 *   // Use The Graph or event logs to detect user's vault interactions
 *   // Much more efficient for large numbers of vaults
 * }
 */
