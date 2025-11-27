'use client';

import { useState, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useReadContract } from 'wagmi';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useUserHarvestedForVault } from '@/hooks/useUserHarvestedForVault';
import { METRO_VAULT_ABI, SHADOW_STRAT_ABI, LB_BOOK_ABI, CL_POOL_ABI } from '@/lib/typechain';
import { TokenPairLogos } from './TokenPairLogos';
import { getTokenLogo } from '@/lib/tokenHelpers';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { CONTRACTS } from '@/lib/contracts';

interface VaultTableViewProps {
  vaults: any[];
  userAddress?: string;
  onVaultClick: (vault: any) => void;
  selectedVault?: any;
}

// Helper component to fetch position data for a single vault
function useVaultPositionData(vault: any) {
  const isMetropolis = vault.name.includes('Metropolis');
  const isShadow = vault.name.includes('Shadow');

  // Metropolis: Get active ID
  const { data: activeIdReal } = useReadContract({
    address: vault.lbBookAddress as `0x${string}`,
    abi: LB_BOOK_ABI,
    functionName: 'getActiveId',
    query: { enabled: !!vault.lbBookAddress && isMetropolis },
  });

  // Metropolis: Get range
  const { data: rangeDataMetro } = useReadContract({
    address: vault.vaultAddress as `0x${string}`,
    abi: METRO_VAULT_ABI,
    functionName: 'getRange',
    query: { enabled: !!vault.vaultAddress && isMetropolis },
  });

  // Shadow: Get slot0 for active tick
  const { data: slot0Data } = useReadContract({
    address: vault.clpoolAddress as `0x${string}`,
    abi: CL_POOL_ABI,
    functionName: 'slot0',
    query: { enabled: !!vault.clpoolAddress && isShadow },
  });

  // Shadow: Get range
  const { data: rangeDataShadow } = useReadContract({
    address: vault.stratAddress as `0x${string}`,
    abi: SHADOW_STRAT_ABI,
    functionName: 'getRange',
    query: { enabled: !!vault.stratAddress && isShadow },
  });

  // Extract data
  const shadowActiveTick = slot0Data ? (slot0Data as readonly [bigint, number, number, number, number, number, boolean])[1] : null;
  const shadowRangeData = rangeDataShadow ? (rangeDataShadow as readonly [number, number]) : null;

  const activeId = isMetropolis ? activeIdReal : (shadowActiveTick !== null ? BigInt(shadowActiveTick) : null);
  const rangeData = isMetropolis ? rangeDataMetro : shadowRangeData;

  // Calculate price position percentage
  let pricePosition = 50; // Default to middle
  if (rangeData && activeId !== null) {
    const [lower, upper] = rangeData as readonly [any, any];
    const lowerNum = Number(lower);
    const upperNum = Number(upper);
    const activeNum = Number(activeId);
    
    if (upperNum > lowerNum) {
      pricePosition = ((activeNum - lowerNum) / (upperNum - lowerNum)) * 100;
      // Clamp between 0 and 100
      pricePosition = Math.max(0, Math.min(100, pricePosition));
    }
  }

  return { pricePosition, hasData: !!(rangeData && activeId !== null) };
}

export function VaultTableView({ vaults, userAddress, onVaultClick, selectedVault }: VaultTableViewProps) {
  const [depositModalVault, setDepositModalVault] = useState<string | null>(null);
  const [withdrawModalVault, setWithdrawModalVault] = useState<string | null>(null);
  
  // Fetch token balances
  const sonicBalance = useBalance({
    address: userAddress as `0x${string}` | undefined,
    token: CONTRACTS.SONIC as `0x${string}`,
  });
  
  const wsBalance = useBalance({
    address: userAddress as `0x${string}` | undefined,
    token: CONTRACTS.WS as `0x${string}`,
  });
  
  const usdcBalance = useBalance({
    address: userAddress as `0x${string}` | undefined,
    token: CONTRACTS.USDC as `0x${string}`,
  });
  
  const wethBalance = useBalance({
    address: userAddress as `0x${string}` | undefined,
    token: CONTRACTS.WETH as `0x${string}`,
  });
  
  const vaultMetrics = vaults.map(config => 
    useVaultMetrics(config, userAddress)
  );

  // Fetch harvested amounts for each vault
  const harvestedData = vaults.map((vault, index) => {
    const metrics = vaultMetrics[index];
    const isShadow = vault.name.includes('Shadow');
    const tokenPrice = isShadow ? (metrics.prices?.shadow || 0) : (metrics.prices?.metro || 0);
    const hasBalance = !!(metrics.depositedValueUSD && metrics.depositedValueUSD > 0);
    
    return useUserHarvestedForVault(vault.vaultAddress, userAddress, tokenPrice, hasBalance);
  });

  // Fetch position data for each vault
  const positionData = vaults.map(vault => useVaultPositionData(vault));

  return (
    <div className="bg-black/40 border-2 border-gray-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Table Header - Responsive */}
      <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto] gap-4 px-6 py-4 bg-black/60 border-b-2 border-gray-700/50 text-sm font-semibold text-white uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span>Vaults</span>
        </div>
        <div className="text-center">Status</div>
        <div className="text-center">Deposit</div>
        <div className="text-center">Daily Rewards</div>
        <div className="text-center">Earned</div>
        <div className="text-center">APR</div>
        <div className="text-center">Withdraw</div>
        <div className="w-[110px]"></div> {/* Actions column */}
      </div>
      
      {/* Mobile Header */}
      <div className="md:hidden grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-3 py-3 bg-black/60 border-b-2 border-gray-700/50 text-xs font-semibold text-white uppercase tracking-wider">
        <div>Vault</div>
        <div className="text-center">Withdraw</div>
        <div className="text-center">Status</div>
        <div className="text-center">APR</div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-gray-700/40">
        {vaults.map((vault, index) => {
          const metrics = vaultMetrics[index];
          const harvested = harvestedData[index];
          const position = positionData[index];
          const isSelected = selectedVault?.vaultAddress === vault.vaultAddress;
          const isShadow = vault.name.includes('Shadow');
          const hasPosition = metrics.depositedValueUSD && metrics.depositedValueUSD > 0;
          
          // Filter non-zero rewards (same logic as DashboardVaultCard)
          const nonZeroRewards = metrics.pendingRewards 
            ? metrics.pendingRewards.filter((reward: any) => reward.pendingRewards > 0n)
            : [];
          const hasClaimableRewards = nonZeroRewards.length > 0;
          
          // Calculate daily rewards from APR
          const dailyRewardsUSD = metrics.depositedValueUSD && metrics.apy > 0
            ? (metrics.depositedValueUSD * (metrics.apy / 100)) / 365
            : 0;

          // Get DEX name
          const dexName = isShadow ? 'Shadow' : 'Metropolis';

          return (
            <div
              key={vault.vaultAddress}
              onClick={() => onVaultClick(vault)}
              className={`w-full transition-all duration-200 cursor-pointer ${
                isSelected 
                  ? 'bg-arca-green/5 border-l-2 border-arca-green' 
                  : 'hover:bg-gray-900/30 hover:border-l-2 hover:border-arca-green/30'
              }`}
            >
              {/* Desktop Layout */}
              <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto] gap-4 px-6 py-4">
              {/* Asset Column - Token Pair Logos + Name */}
              <div className="flex items-center gap-4">

                <TokenPairLogos 
                  token0Logo={getTokenLogo(vault.tokenX)} 
                  token1Logo={getTokenLogo(vault.tokenY)} 
                  size={32}
                />
                <div>
                  <div className="text-white font-semibold text-base">
                    {vault.tokenX} • {vault.tokenY}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <img 
                      src={isShadow ? '/SHadowLogo.jpg' : '/MetropolisLogo.png'} 
                      alt={dexName}
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="text-sm text-white/70 font-medium">
                      {dexName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Column - Liquidity Distribution Bar with Price Position */}
              <div className="flex items-center justify-center">
                {hasPosition && position.hasData ? (
                  <div className="w-full max-w-[120px]">
                    <div className="h-4 bg-gray-800/50 rounded-full overflow-visible relative">
                      {/* Green bar showing active range - matching PositionVisualizationCard */}
                      <div 
                        className="h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60 absolute left-0 rounded-full"
                        style={{ 
                          width: '100%'
                        }}
                      />
                      {/* Red line showing current price position */}
                      <div 
                        className="absolute top-0 w-1 h-full bg-red-400 rounded-full"
                        style={{
                          left: `${position.pricePosition}%`,
                          boxShadow: '0 0 10px rgba(248, 113, 113, 0.8)',
                          transform: 'translateX(-50%)'
                        }}
                      />
                    </div>
                  </div>
                ) : hasPosition ? (
                  <div className="w-full max-w-[120px]">
                    <div className="h-4 bg-gray-800/50 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60 absolute left-0 rounded-full" 
                        style={{ 
                          width: '100%'
                        }} 
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-arca-green/40">-</span>
                )}
              </div>

              {/* Deposit Column */}
              <div className="flex items-center justify-center">
                <span className="text-white font-medium text-base">
                  ${metrics.depositedValueUSD?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>

              {/* Daily Rewards Column - Extrapolated from APR */}
              <div className="flex items-center justify-center">
                <span className="text-white font-medium text-base">
                  ${dailyRewardsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Earned Column - User's Harvested Amount */}
              <div className="flex items-center justify-center">
                <span className="text-white font-medium text-base">
                  ${harvested.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* APR Column */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-white font-semibold text-base">
                  {metrics.apy > 0 ? `${metrics.apy.toFixed(2)}%` : '-'}
                </span>
              </div>

              {/* Withdraw Status Column */}
              <div className="flex items-center justify-center">
                {/* Show claim button if claimable withdrawal exists */}
                {metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0 ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (metrics.handleRedeemWithdrawal && metrics.claimableWithdrawals) {
                        // Claim from the first available round
                        metrics.handleRedeemWithdrawal(metrics.claimableWithdrawals[0].round);
                      }
                    }}
                    className="px-3 py-1 bg-arca-green/10 border border-arca-green/50 rounded text-xs font-semibold text-arca-green hover:bg-arca-green/20 transition-all animate-pulse"
                    title={metrics.claimableWithdrawals.length > 1 ? `${metrics.claimableWithdrawals.length} withdrawals available` : undefined}
                  >
                    Claim{metrics.claimableWithdrawals.length > 1 ? ` (${metrics.claimableWithdrawals.length})` : ''}
                  </button>
                ) : metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n ? (
                  /* Show queued status if withdrawal is queued in current round */
                  <span className="text-xs text-orange-400 font-medium">Queued</span>
                ) : (
                  <span className="text-xs text-gray-500">-</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5">
                {/* Claim Rewards Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (metrics.handleClaimRewards && !metrics.isClaimingRewards && hasClaimableRewards) {
                      metrics.handleClaimRewards();
                    }
                  }}
                  disabled={metrics.isClaimingRewards || !hasClaimableRewards}
                  className={`w-7 h-7 flex items-center justify-center bg-gray-900/50 border border-gray-700/50 rounded transition-all ${
                    metrics.isClaimingRewards || !hasClaimableRewards
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-arca-green/10 hover:border-arca-green/50'
                  }`}
                  title={hasClaimableRewards ? "Claim Rewards" : "No Rewards Available"}
                >
                  <svg 
                    className={`w-3.5 h-3.5 ${
                      metrics.isClaimingRewards || !hasClaimableRewards
                        ? 'text-gray-600'
                        : 'text-arca-green'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* Deposit Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDepositModalVault(vault.vaultAddress);
                  }}
                  disabled={!userAddress}
                  className="w-7 h-7 flex items-center justify-center bg-gray-900/50 border border-gray-700/50 rounded hover:bg-arca-green/10 hover:border-arca-green/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Deposit"
                >
                  <svg className="w-3.5 h-3.5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>

                {/* Withdraw Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWithdrawModalVault(vault.vaultAddress);
                  }}
                  disabled={!hasPosition}
                  className="w-7 h-7 flex items-center justify-center bg-gray-900/50 border border-gray-700/50 rounded hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Withdraw"
                >
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              </div>
              </div>
              
              {/* Mobile Layout */}
              <div className="md:hidden grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-3 py-3">
                {/* Vault Info */}
                <div className="flex items-center gap-2">
                  <TokenPairLogos 
                    token0Logo={getTokenLogo(vault.tokenX)} 
                    token1Logo={getTokenLogo(vault.tokenY)} 
                    size={24}
                  />
                  <div>
                    <div className="text-white font-semibold text-sm">
                      {vault.tokenX} • {vault.tokenY}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <img 
                        src={isShadow ? '/SHadowLogo.jpg' : '/MetropolisLogo.png'} 
                        alt={dexName}
                        className="w-3 h-3 rounded-full"
                      />
                      <span className="text-xs text-white/70">{dexName}</span>
                    </div>
                  </div>
                </div>
                
                {/* Withdraw Status Column - Mobile */}
                <div className="flex items-center justify-center">
                  {metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (metrics.handleRedeemWithdrawal && metrics.claimableWithdrawals) {
                          metrics.handleRedeemWithdrawal(metrics.claimableWithdrawals[0].round);
                        }
                      }}
                      className="px-2 py-1 bg-arca-green/10 border border-arca-green/50 rounded text-xs font-semibold text-arca-green hover:bg-arca-green/20 transition-all animate-pulse"
                      title={metrics.claimableWithdrawals.length > 1 ? `${metrics.claimableWithdrawals.length} withdrawals available` : undefined}
                    >
                      Claim{metrics.claimableWithdrawals.length > 1 ? ` (${metrics.claimableWithdrawals.length})` : ''}
                    </button>
                  ) : metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n ? (
                    <span className="text-xs text-orange-400 font-medium">Queued</span>
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </div>
                
                {/* Status Column - Mobile */}
                <div className="flex items-center justify-center">
                  {hasPosition && position.hasData ? (
                    <div className="w-full max-w-[60px]">
                      <div className="h-3 bg-gray-800/50 rounded-full overflow-visible relative">
                        <div 
                          className="h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60 absolute left-0 rounded-full"
                          style={{ width: '100%' }}
                        />
                        <div 
                          className="absolute top-0 w-0.5 h-full bg-red-400 rounded-full"
                          style={{
                            left: `${position.pricePosition}%`,
                            boxShadow: '0 0 6px rgba(248, 113, 113, 0.8)',
                            transform: 'translateX(-50%)'
                          }}
                        />
                      </div>
                    </div>
                  ) : hasPosition ? (
                    <div className="w-full max-w-[60px]">
                      <div className="h-3 bg-gray-800/50 rounded-full overflow-hidden relative">
                        <div 
                          className="h-full bg-gradient-to-r from-arca-green/60 via-arca-green/40 to-arca-green/60 absolute left-0 rounded-full" 
                          style={{ width: '100%' }} 
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-arca-green/40">-</span>
                  )}
                </div>
                
                {/* APR Column - Mobile */}
                <div className="flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {metrics.apy > 0 ? `${metrics.apy.toFixed(1)}%` : '-'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {depositModalVault && (() => {
        const vault = vaults.find(v => v.vaultAddress === depositModalVault);
        if (!vault) return null;
        return (
          <DepositModal
            vaultAddress={vault.vaultAddress}
            stratAddress={vault.stratAddress}
            vaultName={vault.name}
            sonicBalance={(sonicBalance?.data?.value as bigint) || 0n}
            wsBalance={(wsBalance?.data?.value as bigint) || 0n}
            usdcBalance={(usdcBalance?.data?.value as bigint) || 0n}
            wethBalance={(wethBalance?.data?.value as bigint) || 0n}
            tokenX={vault.tokenX}
            tokenY={vault.tokenY}
            onClose={() => setDepositModalVault(null)}
          />
        );
      })()}

      {withdrawModalVault && (() => {
        const vaultIndex = vaults.findIndex(v => v.vaultAddress === withdrawModalVault);
        const vault = vaults[vaultIndex];
        const metrics = vaultIndex >= 0 ? vaultMetrics[vaultIndex] : null;
        if (!vault) return null;
        return (
          <WithdrawModal
            vaultAddress={vault.vaultAddress}
            vaultName={vault.name}
            userShares={metrics?.userShares || 0n}
            tokenX={vault.tokenX}
            tokenY={vault.tokenY}
            onClose={() => setWithdrawModalVault(null)}
          />
        );
      })()}
    </div>
  );
}
