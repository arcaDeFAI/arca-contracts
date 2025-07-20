import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { VAULT_STRATEGY_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatUnits } from "viem";

// Hook to fetch real-time Sonic price from CoinGecko
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
      return data["sonic-3"]?.usd || 0;
    },
    staleTime: 15000, // Consider data fresh for 15 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// Hook to fetch real-time vault TVL data
export function useVaultTvl(vaultName: string) {
  // Get strategy contract address
  const strategyKey = vaultName.replace(
    "-",
    "/",
  ) as keyof typeof CONTRACT_ADDRESSES.strategies;
  const strategyAddress = CONTRACT_ADDRESSES.strategies[strategyKey];

  // Fetch vault balances from strategy contract using getBalances()
  const {
    data: balances,
    isLoading: balancesLoading,
    error: balancesError,
  } = useReadContract({
    address: strategyAddress as `0x${string}`,
    abi: VAULT_STRATEGY_ABI,
    functionName: "getBalances",
    enabled: !!strategyAddress,
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always consider data stale
    },
  });

  // Fetch real-time Sonic price
  const {
    data: sonicPrice,
    isLoading: priceLoading,
    error: priceError,
  } = useSonicPrice();

  // Calculate TVL in USD using real-time prices
  const calculateTvl = () => {
    if (!balances || !sonicPrice) {
      if (vaultName === "S/USDC") {
        console.log("Farm TVL calculation failed:", {
          vaultName,
          strategyAddress,
          balances: balances ? "available" : "missing",
          sonicPrice: sonicPrice || "missing",
          balancesError: balancesError?.message,
        });
      }
      return 0;
    }

    const [amountX, amountY] = balances as [bigint, bigint];

    // Convert from wei to token amounts (18 decimals for Sonic, 6 decimals for USDC)
    const sonicAmount = parseFloat(formatUnits(amountX, 18));
    const usdcAmount = parseFloat(formatUnits(amountY, 6));

    // Calculate total USD value using real-time prices
    const tvl = sonicAmount * sonicPrice + usdcAmount * 1.0; // USDC is always ~$1

    // Debug logging for S/USDC Farm TVL
    if (vaultName === "S/USDC") {
      console.log("Farm TVL calculation for S/USDC:", {
        strategyAddress,
        balances: [amountX.toString(), amountY.toString()],
        sonicAmount,
        usdcAmount,
        sonicPrice,
        tvl,
        formattedTvl: parseFloat(tvl.toFixed(2)),
      });
    }

    return parseFloat(tvl.toFixed(2));
  };

  const isLoading = balancesLoading || priceLoading;
  const error = balancesError || priceError;

  return {
    tvl: calculateTvl(),
    sonicPrice,
    balances: balances
      ? {
          tokenX: formatUnits((balances as [bigint, bigint])[0], 18),
          tokenY: formatUnits((balances as [bigint, bigint])[1], 6),
        }
      : null,
    isLoading,
    error,
  };
}
