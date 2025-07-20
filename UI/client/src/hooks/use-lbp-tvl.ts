
import { useReadContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { LBP_ABI, LBP_ADDRESSES, TOKEN_ADDRESSES } from '@/lib/contracts';

// Hook to fetch real-time Sonic price from CoinGecko
function useSonicPrice() {
  return useQuery({
    queryKey: ['sonic-price'],
    queryFn: async () => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=sonic-3&vs_currencies=usd'
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Sonic price');
      }

      const data = await response.json();
      return data['sonic-3']?.usd || 0;
    },
    staleTime: 15000, // Consider data fresh for 15 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useLbpTvl(vaultName: string) {
  const lbpAddress = LBP_ADDRESSES[vaultName as keyof typeof LBP_ADDRESSES];
  
  // Get reserves from LBP contract
  const { data: reserves, isLoading: reservesLoading } = useReadContract({
    address: lbpAddress as `0x${string}`,
    abi: LBP_ABI,
    functionName: 'getReserves',
    query: {
      enabled: !!lbpAddress,
      refetchInterval: 10000, // Refresh every 10 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    },
  });

  // Get current price from LBP contract
  const { data: price, isLoading: priceLoading } = useReadContract({
    address: lbpAddress as `0x${string}`,
    abi: LBP_ABI,
    functionName: 'getPriceFromId',
    query: {
      enabled: !!lbpAddress,
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    },
  });

  // Fetch real-time Sonic price
  const { data: sonicPrice, isLoading: priceDataLoading, error: priceError } = useSonicPrice();

  // Calculate TVL based on reserves using real-time pricing
  const calculateTvl = () => {
    if (!reserves || !sonicPrice) return 0;

    const [reserveX, reserveY] = reserves as [bigint, bigint];
    
    // Convert reserves to readable numbers (18 decimals for S, 6 decimals for USDC)
    const reserveXFormatted = Number(reserveX) / 1e18; // S token (18 decimals)
    const reserveYFormatted = Number(reserveY) / 1e6;  // USDC (6 decimals)
    
    // Calculate TVL using real-time Sonic price
    // TVL = (reserveX * sonicPrice) + (reserveY * $1.00)
    const tvl = (reserveXFormatted * sonicPrice) + (reserveYFormatted * 1.00);
    
    return Math.round(tvl);
  };

  return {
    tvl: calculateTvl(),
    sonicPrice,
    reserves: reserves ? {
      tokenX: Number(reserves[0]) / 1e18, // S token (18 decimals)
      tokenY: Number(reserves[1]) / 1e6,  // USDC (6 decimals)
    } : null,
    price: price ? Number(price) / Math.pow(2, 128) : null, // LB price is in 128-bit fixed point
    isLoading: reservesLoading || priceLoading || priceDataLoading,
    error: priceError,
  };
}
