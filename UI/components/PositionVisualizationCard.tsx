'use client'

import { useReadContract, usePublicClient } from 'wagmi'
import { useState, useEffect } from 'react'
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain'
import { TokenPairLogos } from './TokenPairLogos'
import { getTokenLogo, getTokenAddress, getTokenDecimals } from '@/lib/tokenHelpers'
import { parseAbi } from 'viem'
import { useVaultPositionData } from '@/hooks/useVaultPositionData'
import { RangeBar } from './RangeBar'

// Minimal ABI for getLastRebalance
const REBALANCE_ABI = [
  {
    "inputs": [],
    "name": "getLastRebalance",
    "outputs": [{"type": "uint256", "name": "lastRebalance"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// RebalanceStarted event ABI for Shadow vaults
const REBALANCE_EVENT_ABI = parseAbi([
  'event RebalanceStarted(address indexed operator, int24 tickLower, int24 tickUpper, uint256 amountX, uint256 amountY)'
]);

// Helper function to format time elapsed
function formatTimeElapsed(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = Number(timestamp);
  const elapsed = now - timestampNum;
  
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

interface PositionVisualizationCardProps {
  vaultAddress: string
  stratAddress: string
  lbBookAddress?: string
  clpoolAddress?: string
  name: string
  tier: string
  userAddress?: string
  tokenX?: string
  tokenY?: string
}

export default function PositionVisualizationCard({
  vaultAddress,
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  name,
  tier,
  tokenX = 'S',
  tokenY = 'USDC'
}: PositionVisualizationCardProps) {

  const positionData = useVaultPositionData({
    vaultAddress,
    stratAddress,
    lbBookAddress,
    clpoolAddress,
    name,
    tokenX,
    tokenY,
  });

  // Determine vault type and token decimals
  const isMetropolis = name.includes('Metropolis');
  const isShadow = name.includes('Shadow');
  
  // Get active ID from LB Book contract (for Metropolis)
  const { data: activeIdReal } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getActiveId',
    query: {
      enabled: !!lbBookAddress && isMetropolis,
    },
  });

  // Get range from vault contract (Metropolis) or strategy contract (Shadow)
  const { data: rangeDataMetro } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!vaultAddress && isMetropolis,
    },
  });

  // Get active price from active ID (for Metropolis)
  const { data: activePriceRaw } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getPriceFromId',
    args: activeIdReal ? [Number(activeIdReal)] : undefined,
    query: {
      enabled: !!lbBookAddress && isMetropolis && !!activeIdReal,
    },
  });

  // Get lower price from lower bin (for Metropolis)
  const { data: lowerPriceRaw } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getPriceFromId',
    args: rangeDataMetro ? [Number(rangeDataMetro[0])] : undefined,
    query: {
      enabled: !!lbBookAddress && isMetropolis && !!rangeDataMetro,
    },
  });

  // Get upper price from upper bin (for Metropolis)
  const { data: upperPriceRaw } = useReadContract({
    address: lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getPriceFromId',
    args: rangeDataMetro ? [Number(rangeDataMetro[1])] : undefined,
    query: {
      enabled: !!lbBookAddress && isMetropolis && !!rangeDataMetro,
    },
  });

  // Get active tick from CLPool slot0 (for Shadow)
  const { data: slot0Data } = useReadContract({
    address: clpoolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!clpoolAddress && isShadow,
    },
  });

  // Get range from Shadow strategy contract
  const { data: rangeDataShadow } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!stratAddress && isShadow,
    },
  });

  // Extract active tick from slot0 data for Shadow
  const shadowActiveTick = slot0Data ? (slot0Data as readonly [bigint, number, number, number, number, number, boolean])[1] : null;

  // Extract range data from Shadow strategy
  const shadowRangeData = rangeDataShadow ? (rangeDataShadow as readonly [number, number]) : null;

  const tokenXDecimals = getTokenDecimals(tokenX);
  const tokenYDecimals = getTokenDecimals(tokenY);

  // Convert Metro prices from raw to human-readable
  const convertMetroPrice = (raw: bigint | undefined): number | null => {
    if (!raw) return null;
    return Number(raw) / Math.pow(2, 128) * Math.pow(10, tokenXDecimals - tokenYDecimals);
  };

  const activePrice = convertMetroPrice(activePriceRaw);
  const lowerPrice = convertMetroPrice(lowerPriceRaw);
  const upperPrice = convertMetroPrice(upperPriceRaw);

  const token0Address = getTokenAddress(tokenX);
  const token1Address = getTokenAddress(tokenY);
  const isToken0X = token0Address.toLowerCase() < token1Address.toLowerCase();
  
  const token0Decimals = isToken0X ? tokenXDecimals : tokenYDecimals;
  const token1Decimals = isToken0X ? tokenYDecimals : tokenXDecimals;

  const tickToPrice = (tick: number): number => {
    const rawPrice0In1 = Math.pow(1.0001, tick);
    const humanPrice0In1 = rawPrice0In1 * Math.pow(10, token0Decimals - token1Decimals);
    return isToken0X ? humanPrice0In1 : (1 / humanPrice0In1);
  };

  const shadowActivePrice = shadowActiveTick !== null ? tickToPrice(shadowActiveTick) : null;
  const shadowLowerPrice = shadowRangeData ? tickToPrice(shadowRangeData[0]) : null;
  const shadowUpperPrice = shadowRangeData ? tickToPrice(shadowRangeData[1]) : null;

  const formatPrice = (price: number | null): string => {
    if (price === null) return '...';
    return `${price.toFixed(6)} ${tokenY}/${tokenX}`;
  };

  // Get last rebalance timestamp from contract (Metropolis only)
  const { data: contractLastRebalance } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: REBALANCE_ABI,
    functionName: 'getLastRebalance',
    query: {
      enabled: !!stratAddress && isMetropolis,
    },
  });

  // Get last rebalance from RebalanceStarted event for Shadow vaults
  const publicClient = usePublicClient();
  const [shadowLastRebalance, setShadowLastRebalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!isShadow || !publicClient || !stratAddress) return;

    let isMounted = true;

    const fetchLastRebalance = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const blocksPerMonth = 86400n * 30n;
        const fromBlock = currentBlock > blocksPerMonth ? currentBlock - blocksPerMonth : 0n;

        const logs = await publicClient.getLogs({
          address: stratAddress as `0x${string}`,
          event: REBALANCE_EVENT_ABI[0],
          fromBlock,
          toBlock: currentBlock,
        });

        if (!isMounted || logs.length === 0) return;

        const lastLog = logs[logs.length - 1];
        const block = await publicClient.getBlock({ blockNumber: lastLog.blockNumber });
        
        if (isMounted) {
          setShadowLastRebalance(block.timestamp);
        }
      } catch {
        // Silently handle error - not critical for UI
      }
    };

    fetchLastRebalance();

    return () => {
      isMounted = false;
    };
  }, [isShadow, publicClient, stratAddress]);

  const lastRebalance = isMetropolis ? contractLastRebalance : shadowLastRebalance;

  // State to force re-render for time updates
  const [, setTick] = useState(0);
  
  useEffect(() => {
    if (!lastRebalance) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [lastRebalance]);

  const activeId = isMetropolis ? activeIdReal : (shadowActiveTick !== null ? BigInt(shadowActiveTick) : null);
  const rangeData = isMetropolis ? rangeDataMetro : shadowRangeData;

  const dexName = isShadow ? 'Shadow' : 'Metropolis';
  const dexLogo = isShadow ? '/SHadowLogo.jpg' : '/MetropolisLogo.png';

  if (!rangeData || activeId === null) {
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <img src={dexLogo} alt={dexName} className={`w-5 h-5 ${isShadow ? 'rounded-full' : ''}`} />
            <h3 className="text-sm font-semibold text-arca-text">Position Range</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <TokenPairLogos 
            token0Logo={getTokenLogo(tokenX)} 
            token1Logo={getTokenLogo(tokenY)} 
            size={18}
          />
          <p className="text-xs text-arca-text-tertiary">{name}</p>
        </div>
        <div className="text-center text-arca-text-tertiary text-xs py-4 animate-pulse">
          Loading position data...
        </div>
        
        {lastRebalance && (
          <div className="bg-arca-surface rounded-xl p-2.5 mt-3 border border-white/[0.03]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-arca-text-tertiary">Last Rebalance:</span>
              <span className="text-arca-text font-medium">
                {formatTimeElapsed(lastRebalance)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const [lowRange, upperRange] = rangeData as readonly [bigint | number, bigint | number];
  const lowRangeNum = Number(lowRange);
  const upperRangeNum = Number(upperRange);

  const currentActivePrice = isShadow ? shadowActivePrice : activePrice;
  const currentLowerPrice = isShadow ? shadowLowerPrice : lowerPrice;
  const currentUpperPrice = isShadow ? shadowUpperPrice : upperPrice;
  const rangeWidth = upperRangeNum - lowRangeNum;
  const rangeLabel = isShadow ? 'Range Width' : 'Bin Range';
  const currentLastRebalance = isShadow ? shadowLastRebalance : lastRebalance;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <img src={dexLogo} alt={dexName} className={`w-5 h-5 ${isShadow ? 'rounded-full' : ''}`} />
          <h3 className="text-sm font-semibold text-arca-text">Position Range</h3>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <TokenPairLogos 
          token0Logo={getTokenLogo(tokenX)} 
          token1Logo={getTokenLogo(tokenY)} 
          size={18}
        />
        <p className="text-xs text-arca-text-tertiary">{name}</p>
      </div>

      {/* Price Information Grid */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-arca-surface rounded-xl p-2.5 border border-white/[0.03] min-w-0">
          <div className="text-[10px] text-arca-text-tertiary mb-1 uppercase tracking-wider font-medium">Active Price</div>
          <div className="text-sm font-bold text-arca-text truncate">
            {formatPrice(currentActivePrice)}
          </div>
        </div>

        <div className="flex-1 bg-arca-surface rounded-xl p-2.5 border border-white/[0.03] min-w-0">
          <div className="text-[10px] text-arca-text-tertiary mb-1 uppercase tracking-wider font-medium">{rangeLabel}</div>
          <div className="text-sm font-bold text-arca-text truncate">{rangeWidth.toLocaleString()}</div>
        </div>
      </div>

      {/* Range Bar */}
      <div className="bg-arca-surface rounded-xl p-3 mb-3 border border-white/[0.03]">
        <RangeBar position={positionData} tokenY={tokenY} compact />
        <div className="flex items-center justify-between text-xs mt-2.5">
          <div className="flex flex-col items-start">
            <span className="text-arca-text-tertiary text-[10px] mb-0.5">Lower Price</span>
            <span className="text-arca-text font-medium text-[11px]">{formatPrice(currentLowerPrice)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-arca-text-tertiary text-[10px] mb-0.5">Upper Price</span>
            <span className="text-arca-text font-medium text-[11px]">{formatPrice(currentUpperPrice)}</span>
          </div>
        </div>
      </div>

      {/* Last Rebalance */}
      {currentLastRebalance && (
        <div className="bg-arca-surface rounded-xl p-2.5 border border-white/[0.03]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-arca-text-tertiary">Last Rebalance:</span>
            <span className="text-arca-text font-medium">
              {formatTimeElapsed(currentLastRebalance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
