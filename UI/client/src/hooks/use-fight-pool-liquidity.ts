import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, FIGHT_POOL_ABI } from "@/lib/contracts";

export function useFightPoolLiquidity() {
  // Get token addresses
  const { data: token0 } = useReadContract({
    address: CONTRACT_ADDRESSES.fightPool as `0x${string}`,
    abi: FIGHT_POOL_ABI,
    functionName: "token0",
  });

  const { data: token1 } = useReadContract({
    address: CONTRACT_ADDRESSES.fightPool as `0x${string}`,
    abi: FIGHT_POOL_ABI,
    functionName: "token1",
  });

  // Get liquidity amount
  const { data: liquidity, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.fightPool as `0x${string}`,
    abi: FIGHT_POOL_ABI,
    functionName: "liquidity",
  });

  // Get slot0 data for additional pool info
  const { data: slot0 } = useReadContract({
    address: CONTRACT_ADDRESSES.fightPool as `0x${string}`,
    abi: FIGHT_POOL_ABI,
    functionName: "slot0",
  });

  // Get fee tier
  const { data: fee } = useReadContract({
    address: CONTRACT_ADDRESSES.fightPool as `0x${string}`,
    abi: FIGHT_POOL_ABI,
    functionName: "fee",
  });

  console.log("Fight Pool Data:", {
    poolAddress: CONTRACT_ADDRESSES.fightPool,
    token0,
    token1,
    liquidity: liquidity?.toString(),
    slot0,
    fee: fee?.toString(),
    isLoading,
  });

  return {
    liquidity: liquidity ? Number(liquidity) : 0,
    token0,
    token1,
    slot0,
    fee,
    isLoading,
    poolAddress: CONTRACT_ADDRESSES.fightPool,
  };
}
