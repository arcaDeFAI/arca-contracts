import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { mockVaults } from "../data/mock-vaults";
import { useVaultTokens } from "./use-vault-tokens";
import { useDepositHistory } from "./use-deposit-history";
import { VAULT_ABI } from "@/lib/contracts";
import { useMemo } from "react";

export interface UserPosition {
  vaultName: string;
  shares: bigint;
  deposited: number;
  currentValue: number;
  earnings: number;
  apr: number;
  platform: string;
  tokens: string[];
}

// Hook to fetch real-time S token price from CoinGecko
function useSonicPrice() {
  return useQuery({
    queryKey: ["sonic-price"],
    queryFn: async () => {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=sonic-3&vs_currencies=usd",
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Sonic price");
      }

      const data = await response.json();
      return data["sonic-3"]?.usd || 1; // Default to $1 if fetch fails
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useUserPositions() {
  const { address } = useAccount();
  const { data: sonicPrice, isLoading: priceLoading } = useSonicPrice();

  // Get vault data for all vaults
  const vaultPositions = mockVaults.map((vault) => {
    const { vaultAddress: fetchedVaultAddress } = useVaultTokens(vault.name);
    // Use direct address for S/USDC vault to avoid resolution issues
    const vaultAddress =
      vault.name === "S/USDC"
        ? "0x9541962342A344569FEAD20F6f824856aAC8cad9"
        : fetchedVaultAddress;
    const { totalDeposited: historicalDeposited } = useDepositHistory(
      vaultAddress || "",
    );

    const { data: userShares } = useReadContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
      query: { enabled: !!address && !!vaultAddress },
    });

    // Get total supply of vault shares
    const { data: totalSupply } = useReadContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "totalSupply",
      query: { enabled: !!vaultAddress },
    });

    // Get total assets in vault (total value locked)
    const { data: totalAssets } = useReadContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "totalAssets",
      query: { enabled: !!vaultAddress },
    });

    // Get dollar amounts from shares using previewAmounts
    const { data: previewAmounts } = useReadContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: "previewAmounts",
      args: [userShares || 0n],
      query: { enabled: !!vaultAddress && !!userShares && userShares > 0n },
    });

    // Debug logging for S/USDC vault (after all variables are declared)
    if (vault.name === "S/USDC") {
      console.log(`balanceOf call for ${vault.name}:`, {
        vaultAddress: "0x9541962342A344569FEAD20F6f824856aAC8cad9",
        userAddress: address,
        userShares: userShares ? userShares.toString() : "undefined",
        userSharesDecimal: userShares ? Number(userShares) / 1e12 : 0,
        totalSupply: totalSupply ? totalSupply.toString() : "undefined",
        totalAssets: totalAssets ? totalAssets.toString() : "undefined",
        previewAmounts: previewAmounts
          ? [previewAmounts[0].toString(), previewAmounts[1].toString()]
          : "undefined",
        hasShares: userShares ? userShares > 0n : false,
      });
    }

    return {
      vault,
      vaultAddress,
      userShares: userShares || 0n,
      totalSupply: totalSupply || 0n,
      totalAssets: totalAssets || 0n,
      previewAmounts: previewAmounts || [0n, 0n],
      historicalDeposited,
    };
  });

  const activePositions = useMemo(() => {
    return vaultPositions
      .filter((position) => position.userShares > 0n)
      .map((position) => {
        // Convert preview amounts to dollar values
        const amountX = Number(position.previewAmounts[0]) / 1e18; // S token (18 decimals)
        const amountY = Number(position.previewAmounts[1]) / 1e6; // USDC (6 decimals)

        // Calculate total current value in dollars using real S token price
        const sTokenValue = amountX * (sonicPrice || 1); // Use real S price or fallback to $1
        const usdcValue = amountY; // USDC = $1
        const currentValue = sTokenValue + usdcValue;

        // Use historical deposit data if available, otherwise estimate
        const deposited =
          position.historicalDeposited > 0
            ? position.historicalDeposited
            : currentValue * 0.85;

        // Calculate earnings as the difference between current value and historical deposits
        const earnings = currentValue - deposited;

        // Debug logging for S/USDC vault
        if (position.vault.name === "S/USDC") {
          console.log(`Position calculation for ${position.vault.name}:`, {
            userShares: position.userShares.toString(),
            previewAmounts: position.previewAmounts.map((amt) =>
              amt.toString(),
            ),
            amountX,
            amountY,
            sonicPrice: sonicPrice || "loading",
            sTokenValue,
            usdcValue,
            currentValue,
            deposited,
            earnings,
            totalSupply: position.totalSupply.toString(),
            totalAssets: position.totalAssets.toString(),
          });
        }

        return {
          vaultName: position.vault.name,
          shares: position.userShares,
          deposited,
          currentValue,
          earnings: Math.max(0, earnings), // Ensure earnings aren't negative
          apr: position.vault.apr,
          platform: position.vault.platform,
          tokens: position.vault.tokens,
        } as UserPosition;
      });
  }, [vaultPositions]);

  const totalDeposited = activePositions.reduce(
    (sum, pos) => sum + pos.deposited,
    0,
  );
  const totalEarnings = activePositions.reduce(
    (sum, pos) => sum + pos.earnings,
    0,
  );
  const totalBalance = totalDeposited + totalEarnings;

  return {
    activePositions,
    totalDeposited,
    totalEarnings,
    totalBalance,
    isLoading: vaultPositions.some((p) => !p.vaultAddress) || priceLoading,
    sonicPrice,
  };
}
