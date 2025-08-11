import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { LBP_ABI, LBP_ADDRESSES, TOKEN_ADDRESSES } from "@/lib/contracts";

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

export function useLbpTvl(vaultName: string) {
  const lbpAddress = LBP_ADDRESSES[vaultName as keyof typeof LBP_ADDRESSES];

  // Get liquidity from LBP contract (using Fight Pool/Ramses V3 ABI)
  const { data: liquidity, isLoading: liquidityLoading } = useReadContract({
    address: lbpAddress as `0x${string}`,
    abi: LBP_ABI,
    functionName: "liquidity",
    query: {
      enabled: !!lbpAddress,
      refetchInterval: 10000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    },
  });

  // Get current price from slot0
  const { data: slot0, isLoading: slot0Loading } = useReadContract({
    address: lbpAddress as `0x${string}`,
    abi: LBP_ABI,
    functionName: "slot0",
    query: {
      enabled: !!lbpAddress,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    },
  });

  // Fetch real-time Sonic price
  const {
    data: sonicPrice,
    isLoading: priceDataLoading,
    error: priceError,
  } = useSonicPrice();

  // Calculate TVL based on liquidity using real-time pricing
  const calculateTvl = () => {
    if (!liquidity || !sonicPrice) return 0;

    // Liquidity is a single value representing total liquidity in the pool
    // For simplicity, we'll estimate TVL based on liquidity value
    const liquidityFormatted = Number(liquidity) / 1e18;

    // Approximate TVL calculation (simplified)
    const tvl = liquidityFormatted * sonicPrice * 2; // Multiply by 2 as rough approximation for both sides

    return Math.round(tvl);
  };

  // Extract price from slot0 if available
  const getPrice = () => {
    if (!slot0 || !Array.isArray(slot0)) return null;
    const sqrtPriceX96 = slot0[0] as bigint;
    // Convert sqrtPriceX96 to regular price
    const price = Number(sqrtPriceX96) ** 2 / 2 ** 192;
    return price;
  };

  return {
    tvl: calculateTvl(),
    sonicPrice,
    reserves: null, // Ramses V3 doesn't expose reserves directly
    price: getPrice(),
    isLoading: liquidityLoading || slot0Loading || priceDataLoading,
    error: priceError,
  };
}
