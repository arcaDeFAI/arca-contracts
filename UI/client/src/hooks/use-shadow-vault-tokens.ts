import { useReadContract } from "wagmi";
import { SHADOW_STRATEGY_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";

export function useShadowVaultTokens(vaultName: string) {
  // Get strategy contract address
  const strategyKey = vaultName.replace(
    "-",
    "/",
  ) as keyof typeof CONTRACT_ADDRESSES.strategies;
  const strategyAddress = CONTRACT_ADDRESSES.strategies[strategyKey];

  // Get vault contract address
  const vaultKey = vaultName.replace(
    "-",
    "/",
  ) as keyof typeof CONTRACT_ADDRESSES.vaults;
  const vaultAddress = CONTRACT_ADDRESSES.vaults[vaultKey];

  // Fetch TokenX address (S token = token0) from strategy
  const {
    data: tokenXAddress,
    isLoading: tokenXLoading,
    error: tokenXError,
  } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: SHADOW_STRATEGY_ABI,
    functionName: "token0",
    query: { enabled: !!strategyAddress },
  });

  // Fetch TokenY address (USDC = token1) from strategy
  const {
    data: tokenYAddress,
    isLoading: tokenYLoading,
    error: tokenYError,
  } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: SHADOW_STRATEGY_ABI,
    functionName: "token1",
    query: { enabled: !!strategyAddress },
  });

  const isLoading = tokenXLoading || tokenYLoading;
  const error = tokenXError || tokenYError;

  // Debug logging
  if (vaultName === "S/USDC-CL") {
    console.log("Shadow vault tokens:", {
      vaultName,
      strategyAddress,
      tokenXAddress: tokenXAddress as string,
      tokenYAddress: tokenYAddress as string,
      isLoading,
      error,
    });
  }

  return {
    vaultAddress,
    tokenXAddress: tokenXAddress as string,
    tokenYAddress: tokenYAddress as string,
    strategyAddress,
    isLoading,
    error,
  };
}
