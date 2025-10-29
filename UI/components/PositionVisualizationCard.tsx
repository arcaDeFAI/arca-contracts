'use client'

import { useReadContract } from 'wagmi'
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain'
import { TokenPairLogos } from './TokenPairLogos'

interface PositionVisualizationCardProps {
  vaultAddress: string
  stratAddress: string
  lbBookAddress?: string
  clpoolAddress?: string
  name: string
  tier: string
  userAddress?: string
}

export default function PositionVisualizationCard({
  vaultAddress,
  stratAddress,
  lbBookAddress,
  clpoolAddress,
  name,
  tier,
  userAddress
}: PositionVisualizationCardProps) {
  const config = { vaultAddress, stratAddress, name, tier };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5';
      case 'Premium': return 'text-purple-400 border-purple-400/20 bg-purple-400/5';
      case 'Active': return 'text-blue-400 border-blue-400/20 bg-blue-400/5';
      default: return 'text-gray-400 border-gray-400/20 bg-gray-400/5';
    }
  };

  // Determine vault type
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

  // Get active tick from CLPool slot0 (for Shadow)
  const { data: slot0Data, error: slot0Error, isLoading: slot0Loading } = useReadContract({
    address: clpoolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: {
      enabled: !!clpoolAddress && isShadow,
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

  // Get range from Shadow strategy contract
  const { data: rangeDataShadow, error: rangeError, isLoading: rangeLoading } = useReadContract({
    address: stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: {
      enabled: !!stratAddress && isShadow,
    },
  });

  // Extract active tick from slot0 data for Shadow
  // slot0 returns: [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked]
  // We need the tick at index 1 (int24)
  const shadowActiveTick = slot0Data ? (slot0Data as readonly [bigint, number, number, number, number, number, boolean])[1] : null;

  // Extract range data from Shadow strategy
  // getRange returns: [lower, upper] both int24
  const shadowRangeData = rangeDataShadow ? (rangeDataShadow as readonly [number, number]) : null;

  // Debug Shadow vault data loading
  if (isShadow) {
    console.log('🔍 SHADOW POSITION DEBUG:', {
      clpoolAddress,
      stratAddress,
      slot0Data,
      slot0Error: slot0Error?.message,
      slot0Loading,
      rangeDataShadow,
      rangeError: rangeError?.message,
      rangeLoading,
      shadowActiveTick,
      shadowRangeData,
      activeId: shadowActiveTick !== null ? BigInt(shadowActiveTick) : null
    });
  }
  
  // Use appropriate active ID/tick based on vault type - for Shadow, tick IS the activeID (int24, can be negative)
  const activeId = isMetropolis ? activeIdReal : (shadowActiveTick !== null ? BigInt(shadowActiveTick) : null);
  const rangeData = isMetropolis ? rangeDataMetro : shadowRangeData;

  if (!rangeData || activeId === null) {
    return (
      <div className="bg-arca-dark border border-arca-light-gray/20 rounded-xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">Position Range</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getTierColor(tier)}`}>
            {tier}
          </span>
        </div>
        <div className="text-center text-gray-400">
          {isShadow ? 'Loading Shadow position data...' : 'Loading position data...'}
          {isShadow && (
            <div className="text-xs mt-2">
              CLPool: {clpoolAddress ? 'Connected' : 'Missing'}<br/>
              Strategy: {stratAddress ? 'Connected' : 'Missing'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle different data types: Metro uses bigint, Shadow uses int24 (number, can be negative)
  const [lowRange, upperRange] = rangeData as readonly [bigint | number, bigint | number];
  const activeIdNum = Number(activeId);
  const lowRangeNum = Number(lowRange);
  const upperRangeNum = Number(upperRange);

  // Calculate extended range (low-50, upper+50) - handles negative values
  const extendedLow = lowRangeNum - 50;
  const extendedUpper = upperRangeNum + 50;
  const totalRange = extendedUpper - extendedLow;

  // Calculate positions as percentages
  const activeIdPosition = ((activeIdNum - extendedLow) / totalRange) * 100;
  const lowRangePosition = ((lowRangeNum - extendedLow) / totalRange) * 100;
  const upperRangePosition = ((upperRangeNum - extendedLow) / totalRange) * 100;
  const rangeWidth = upperRangePosition - lowRangePosition;

  // Check if position is in range
  const isInRange = activeIdNum >= lowRangeNum && activeIdNum <= upperRangeNum;

  // Enhanced view for Shadow vaults
  if (isShadow) {
    return (
      <div className="bg-arca-dark border border-arca-light-gray/20 rounded-xl p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/SHadowLogo.jpg" alt="Shadow" className="w-7 h-7 rounded-full" />
              <h3 className="text-base font-semibold text-white">Position Range</h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <TokenPairLogos 
                token0Logo="/SonicLogoRound.png" 
                token1Logo="/USDCLogo.png" 
                size={22}
              />
              <p className="text-xs text-gray-400">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              isInRange 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {isInRange ? 'In Range' : 'Out of Range'}
            </div>
          </div>
        </div>

        {/* Price Information Grid */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded p-2 min-w-0">
            <div className="text-xs text-blue-400 mb-1 truncate">Current Tick</div>
            <div className="text-base font-bold text-white truncate">{activeIdNum}</div>
          </div>
          
          <div className="flex-1 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded p-2 min-w-0">
            <div className="text-xs text-purple-400 mb-1 truncate">Range Width</div>
            <div className="text-base font-bold text-white truncate">{upperRangeNum - lowRangeNum}</div>
          </div>
        </div>

        {/* Active Range Display */}
        <div className="bg-black/30 border border-gray-700/30 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-white">Liquidity Distribution</span>
            <span className={`text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap ${
              isInRange ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            }`}>
              {isInRange ? 'Earning' : 'Position Inactive'}
            </span>
          </div>
          
          <div className="space-y-3">
            {/* Range Bar */}
            <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden">
              {/* Active range background */}
              <div 
                className="absolute top-0 h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60"
                style={{
                  left: `${lowRangePosition}%`,
                  width: `${rangeWidth}%`
                }}
              />
              {/* Current price indicator */}
              <div 
                className="absolute top-0 w-0.5 h-full bg-red-400"
                style={{
                  left: `${activeIdPosition}%`,
                  boxShadow: '0 0 10px rgba(248, 113, 113, 0.8)'
                }}
              />
            </div>

            {/* Range Labels */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-col items-start">
                <span className="text-gray-500 mb-0.5">Lower Bound</span>
                <span className="text-white font-semibold">{lowRangeNum}</span>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-gray-500 mb-0.5">Upper Bound</span>
                <span className="text-white font-semibold">{upperRangeNum}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // Enhanced view for Metro vaults
  return (
    <div className="bg-arca-dark border border-arca-light-gray/20 rounded-xl p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="flex items-center gap-2">
            <img src="/MetropolisLogo.png" alt="Metropolis" className="w-7 h-7" />
            <h3 className="text-base font-semibold text-white">Position Range</h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <TokenPairLogos 
              token0Logo="/SonicLogoRound.png" 
              token1Logo="/USDCLogo.png" 
              size={22}
            />
            <p className="text-xs text-gray-400">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
            isInRange 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {isInRange ? 'In Range' : 'Out of Range'}
          </div>
        </div>
      </div>

      {/* Price Information Grid */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded p-2 min-w-0">
          <div className="text-xs text-blue-400 mb-1 truncate">Active ID</div>
          <div className="text-base font-bold text-white truncate">{activeIdNum.toLocaleString()}</div>
        </div>
        
        <div className="flex-1 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded p-2 min-w-0">
          <div className="text-xs text-cyan-400 mb-1 truncate">Bin Range</div>
          <div className="text-base font-bold text-white truncate">{(upperRangeNum - lowRangeNum).toLocaleString()}</div>
        </div>
      </div>

      {/* Active Range Display */}
      <div className="bg-black/30 border border-gray-700/30 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold text-white">Liquidity Distribution</span>
          <span className={`text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap ${
            isInRange ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
          }`}>
            {isInRange ? 'Earning' : 'Position Inactive'}
          </span>
        </div>
        
        <div className="space-y-3">
          {/* Range Bar */}
          <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden">
            {/* Active range background */}
            <div 
              className="absolute top-0 h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60"
              style={{
                left: `${lowRangePosition}%`,
                width: `${rangeWidth}%`
              }}
            />
            {/* Current price indicator */}
            <div 
              className="absolute top-0 w-0.5 h-full bg-red-400"
              style={{
                left: `${activeIdPosition}%`,
                boxShadow: '0 0 10px rgba(248, 113, 113, 0.8)'
              }}
            />
          </div>

          {/* Range Labels */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col items-start">
              <span className="text-gray-500 mb-0.5">Lower Bin</span>
              <span className="text-white font-semibold">{lowRangeNum.toLocaleString()}</span>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-gray-500 mb-0.5">Upper Bin</span>
              <span className="text-white font-semibold">{upperRangeNum.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
