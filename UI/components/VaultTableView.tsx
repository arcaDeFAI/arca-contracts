'use client';

import { useState, useMemo } from 'react';
import { useVaultMetrics } from '@/hooks/useVaultMetrics';
import { useUserHarvestedForVault } from '@/hooks/useUserHarvestedForVault';
import { useVaultPositionData } from '@/hooks/useVaultPositionData';
import { RangeBar } from './RangeBar';
import { TokenPairLogos } from './TokenPairLogos';
import { getTokenLogo } from '@/lib/tokenHelpers';
import { DepositModal } from './DepositModal';
import { WithdrawModal } from './WithdrawModal';
import { Tooltip } from './Tooltip';
import { getToken, getTokenByAddress } from '@/lib/tokenRegistry';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { type VaultConfig } from '@/lib/vaultConfigs';
import { type UserRewardStructOutput } from '@/lib/typechain';

interface VaultTableViewProps {
  vaults: VaultConfig[];
  userAddress?: string;
  onVaultClick: (vault: VaultConfig) => void;
  selectedVault?: VaultConfig;
}


type SortColumn = 'deposit' | 'dailyRewards' | 'earned' | 'apr' | null;
type SortDirection = 'asc' | 'desc' | null;

function useDepositBalances(vault: VaultConfig | null, userAddress?: string) {
  const tokenXDef = vault ? getToken(vault.tokenX) : undefined;
  const tokenYDef = vault ? getToken(vault.tokenY) : undefined;

  const tokenXBalance = useTokenBalance(
    tokenXDef?.address ?? null,
    vault ? userAddress : undefined,
  );
  const tokenYBalance = useTokenBalance(
    tokenYDef?.address ?? null,
    vault ? userAddress : undefined,
  );

  return {
    tokenXBalance: (tokenXBalance?.data as bigint) || 0n,
    tokenYBalance: (tokenYBalance?.data as bigint) || 0n,
  };
}

export function VaultTableView({ vaults, userAddress, onVaultClick, selectedVault }: VaultTableViewProps) {
  const [depositModalVault, setDepositModalVault] = useState<string | null>(null);
  const [withdrawModalVault, setWithdrawModalVault] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const depositVault = depositModalVault
    ? vaults.find(v => v.vaultAddress === depositModalVault) ?? null
    : null;

  const { tokenXBalance, tokenYBalance } = useDepositBalances(depositVault, userAddress);

  const vaultMetrics = vaults.map(config =>
    useVaultMetrics(config, userAddress)
  );

  const harvestedData = vaults.map(vault =>
    useUserHarvestedForVault(vault.vaultAddress, userAddress)
  );

  const positionData = vaults.map(vault => useVaultPositionData({
    vaultAddress: vault.vaultAddress,
    stratAddress: vault.stratAddress,
    lbBookAddress: vault.lbBookAddress,
    clpoolAddress: vault.clpoolAddress,
    name: vault.name,
    tokenX: vault.tokenX,
    tokenY: vault.tokenY,
  }));

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === null) {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortableHeader = ({ column, children }: { column: SortColumn; children: React.ReactNode }) => {
    const isActive = sortColumn === column;
    const isAsc = isActive && sortDirection === 'asc';
    const isDesc = isActive && sortDirection === 'desc';

    return (
      <div
        className="text-center flex items-center justify-center gap-1 cursor-pointer hover:text-arca-green transition-colors group outline-none select-none"
        onClick={() => handleSort(column)}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span>{children}</span>
        <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-80 transition-opacity">
          <svg
            className={`w-2 h-2 transition-all ${isDesc ? 'text-arca-green opacity-100' : 'text-arca-text-tertiary'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 12 12"
          >
            <path d="M6 9 L6 3 M6 3 L3 6 M6 3 L9 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg
            className={`w-2 h-2 transition-all ${isAsc ? 'text-arca-green opacity-100' : 'text-arca-text-tertiary'}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 12 12"
          >
            <path d="M6 3 L6 9 M6 9 L3 6 M6 9 L9 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  };

  const sortedVaultIndices = useMemo(() => {
    const indices = vaults.map((_, index) => index);

    if (!sortColumn || !sortDirection) {
      return indices;
    }

    return indices.sort((aIndex, bIndex) => {
      const aMetrics = vaultMetrics[aIndex];
      const bMetrics = vaultMetrics[bIndex];
      const aHarvested = harvestedData[aIndex];
      const bHarvested = harvestedData[bIndex];

      let aValue = 0;
      let bValue = 0;

      switch (sortColumn) {
        case 'deposit':
          aValue = aMetrics.depositedValueUSD || 0;
          bValue = bMetrics.depositedValueUSD || 0;
          break;
        case 'dailyRewards':
          aValue = aMetrics.depositedValueUSD && (aMetrics.subgraphMetrics.rewardApr ?? 0) > 0
            ? (aMetrics.depositedValueUSD * ((aMetrics.subgraphMetrics.rewardApr ?? 0) / 100)) / 365
            : 0;
          bValue = bMetrics.depositedValueUSD && (bMetrics.subgraphMetrics.rewardApr ?? 0) > 0
            ? (bMetrics.depositedValueUSD * ((bMetrics.subgraphMetrics.rewardApr ?? 0) / 100)) / 365
            : 0;
          break;
        case 'earned':
          aValue = aHarvested.totalHarvestedUSD || 0;
          bValue = bHarvested.totalHarvestedUSD || 0;
          break;
        case 'apr':
          aValue = aMetrics.subgraphMetrics.rewardApr ?? 0;
          bValue = bMetrics.subgraphMetrics.rewardApr ?? 0;
          break;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [vaults, vaultMetrics, harvestedData, sortColumn, sortDirection]);

  return (
    <>
      <div className="bg-arca-gray/80 border border-white/[0.04] rounded-2xl overflow-hidden backdrop-blur-sm shadow-card">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto] gap-4 px-6 py-3 border-b border-white/[0.04] text-[14px] font-medium text-arca-text-tertiary uppercase tracking-wider">
          <div className="flex items-center justify-start gap-2 pl-[64px]">
            <span>Vaults</span>
          </div>
          <div className="flex items-center justify-center">Status</div>
          <SortableHeader column="deposit">Deposit</SortableHeader>
          <SortableHeader column="dailyRewards">Daily</SortableHeader>
          <SortableHeader column="earned">Earned</SortableHeader>
          <SortableHeader column="apr">APR</SortableHeader>
          <div className="flex items-center justify-center gap-1">
            <span>Withdraw</span>
            <Tooltip text="Withdrawal are only cancelable while queued" width="sm" ariaLabel="Withdrawal information" />
          </div>
          <div className="w-[100px]"></div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-3 py-3 border-b border-white/[0.04] text-[10px] font-medium text-arca-text-tertiary uppercase tracking-wider">
          <div className="pl-[46px]">Vault</div>
          <div className="text-center flex items-center justify-center gap-1">
            <span>Withdraw</span>
            <Tooltip text="Withdrawal only cancelable while queued" width="sm" ariaLabel="Withdrawal information" />
          </div>
          <div className="text-center">Status</div>
          <div className="text-center">APR</div>
        </div>

        {/* Table Rows */}
        <div>
          {sortedVaultIndices.map((index, sortIndex) => {
            const vault = vaults[index];
            const metrics = vaultMetrics[index];
            const harvested = harvestedData[index];
            const position = positionData[index];
            const isSelected = selectedVault?.vaultAddress === vault.vaultAddress;
            const isShadow = vault.name.includes('Shadow');
            const hasPosition = metrics.depositedValueUSD && metrics.depositedValueUSD > 0;

            const nonZeroRewards = metrics.pendingRewards
              ? metrics.pendingRewards.filter((reward: UserRewardStructOutput) => reward.pendingRewards > 0n)
              : [];

            let totalRewardsUSD = 0;
            if (nonZeroRewards.length > 0 && metrics.prices) {
              totalRewardsUSD = nonZeroRewards.reduce((sum: number, reward: UserRewardStructOutput) => {
                const amount = Number(reward.pendingRewards) / 1e18;
                const tokenDef = getTokenByAddress(reward.token);
                const priceKey = tokenDef?.canonicalName.toLowerCase();
                const price = priceKey && metrics.prices ? (metrics.prices[priceKey] || 0) : 0;
                return sum + (amount * price);
              }, 0);
            }

            let hasClaimableRewards = false;
            if (isShadow) {
              hasClaimableRewards = totalRewardsUSD >= 0.01;
            } else {
              hasClaimableRewards = nonZeroRewards.length > 0;
            }

            const hasQueuedWithdrawal = metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n;
            const hasClaimableWithdrawal = metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0;

            const hasAnyRewards = nonZeroRewards.length > 0;
            if (!hasPosition && !hasAnyRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal) {
              return null;
            }

            const rewardApr = metrics.subgraphMetrics.rewardApr ?? 0;
            const dailyRewardsUSD = metrics.depositedValueUSD && rewardApr > 0
              ? (metrics.depositedValueUSD * (rewardApr / 100)) / 365
              : 0;

            const dexName = isShadow ? 'Shadow' : 'Metropolis';

            return (
              <div
                key={vault.vaultAddress}
                onClick={() => onVaultClick(vault)}
                className={`w-full transition-all duration-200 cursor-pointer ${sortIndex > 0 ? 'border-t border-white/[0.04]' : ''
                  } ${isSelected
                    ? 'bg-arca-green/[0.04] border-l-2 border-l-arca-green'
                    : 'hover:bg-white/[0.02] border-l-2 border-l-transparent hover:border-l-arca-green/40'
                  }`}
              >
                {/* Desktop Row */}
                <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto] gap-4 px-6 py-3.5">
                  {/* Asset */}
                  <div className="flex items-center gap-3">
                    <TokenPairLogos
                      token0Logo={getTokenLogo(vault.tokenX)}
                      token1Logo={getTokenLogo(vault.tokenY)}
                      size={30}
                    />
                    <div>
                      <div className="text-arca-text font-medium text-sm">
                        {vault.tokenX} • {vault.tokenY}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <img
                          src={isShadow ? '/SHadowLogo.jpg' : '/MetropolisLogo.png'}
                          alt={dexName}
                          className="w-3.5 h-3.5 rounded-full"
                        />
                        <span className="text-[12px] text-arca-text-tertiary font-medium">
                          {dexName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center">
                    {hasPosition ? (
                      <div className="w-full max-w-[130px]">
                        <RangeBar position={position} compact tokenY={vault.tokenY} />
                      </div>
                    ) : (
                      <span className="text-xs text-arca-text-tertiary">-</span>
                    )}
                  </div>

                  {/* Deposit */}
                  <div className="flex items-center justify-center">
                    <span className="text-arca-text font-medium text-sm">
                      ${metrics.depositedValueUSD?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </span>
                  </div>

                  {/* Daily Rewards */}
                  <div className="flex items-center justify-center">
                    <span className="text-arca-text font-medium text-sm">
                      ${dailyRewardsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Earned */}
                  <div className="flex items-center justify-center">
                    <span className="text-arca-text font-medium text-sm">
                      ${harvested.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* APR */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-arca-green font-semibold text-sm">
                      {rewardApr > 0 ? `${rewardApr.toFixed(2)}%` : '-'}
                    </span>
                  </div>

                  {/* Withdrawal Status */}
                  <div className="flex items-center justify-center">
                    {metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (metrics.handleRedeemWithdrawal && metrics.claimableWithdrawals && !metrics.isRedeemingWithdrawal) {
                            metrics.handleRedeemWithdrawal(metrics.claimableWithdrawals[0].round);
                          }
                        }}
                        disabled={metrics.isRedeemingWithdrawal}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${metrics.isRedeemingWithdrawal
                          ? 'bg-white/[0.04] text-arca-text-tertiary cursor-not-allowed'
                          : 'bg-arca-green/[0.1] text-arca-green hover:bg-arca-green/[0.15] animate-pulse-soft'
                          }`}
                        title={metrics.claimableWithdrawals.length > 1 ? `${metrics.claimableWithdrawals.length} withdrawals available` : undefined}
                      >
                        {metrics.isRedeemingWithdrawal ? 'Processing...' : `Claim${metrics.claimableWithdrawals.length > 1 ? ` (${metrics.claimableWithdrawals.length})` : ''}`}
                      </button>
                    ) : metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n ? (
                      <span className="text-xs text-amber-400 font-medium">Queued</span>
                    ) : (
                      <span className="text-xs text-arca-text-tertiary">-</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Claim Rewards */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (metrics.handleClaimRewards && !metrics.isClaimingRewards && hasClaimableRewards) {
                          metrics.handleClaimRewards();
                        }
                      }}
                      disabled={metrics.isClaimingRewards || !hasClaimableRewards}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${metrics.isClaimingRewards || !hasClaimableRewards
                        ? 'opacity-20 cursor-not-allowed'
                        : 'bg-white/[0.03] hover:bg-arca-green/[0.08] hover:text-arca-green'
                        }`}
                      title={hasClaimableRewards ? "Claim Rewards" : "No Rewards Available"}
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${metrics.isClaimingRewards || !hasClaimableRewards ? 'text-arca-text-tertiary' : 'text-arca-green'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Deposit */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDepositModalVault(vault.vaultAddress);
                      }}
                      disabled={!userAddress}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-arca-green/[0.08] transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Deposit"
                    >
                      <svg className="w-3.5 h-3.5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>

                    {/* Withdraw / Cancel */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasQueuedWithdrawal && metrics.queuedWithdrawal && metrics.handleCancelWithdrawal) {
                          metrics.handleCancelWithdrawal(metrics.queuedWithdrawal);
                        } else {
                          setWithdrawModalVault(vault.vaultAddress);
                        }
                      }}
                      disabled={!hasPosition && !hasQueuedWithdrawal}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] transition-all disabled:opacity-20 disabled:cursor-not-allowed ${hasQueuedWithdrawal
                        ? 'hover:bg-red-500/[0.1]'
                        : 'hover:bg-red-500/[0.08]'
                        }`}
                      title={hasQueuedWithdrawal ? "Cancel Withdrawal" : "Withdraw"}
                    >
                      {hasQueuedWithdrawal ? (
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Mobile Row */}
                <div className="md:hidden grid grid-cols-[2fr,1fr,1fr,1fr] gap-2 px-3 py-3">
                  {/* Vault Info */}
                  <div className="flex items-center gap-2">
                    <TokenPairLogos
                      token0Logo={getTokenLogo(vault.tokenX)}
                      token1Logo={getTokenLogo(vault.tokenY)}
                      size={22}
                    />
                    <div>
                      <div className="text-arca-text font-medium text-xs">
                        {vault.tokenX} • {vault.tokenY}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <img
                          src={isShadow ? '/SHadowLogo.jpg' : '/MetropolisLogo.png'}
                          alt={dexName}
                          className="w-3 h-3 rounded-full"
                        />
                        <span className="text-[10px] text-arca-text-tertiary">{dexName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Withdraw Status — Mobile */}
                  <div className="flex items-center justify-center">
                    {metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (metrics.handleRedeemWithdrawal && metrics.claimableWithdrawals && !metrics.isRedeemingWithdrawal) {
                            metrics.handleRedeemWithdrawal(metrics.claimableWithdrawals[0].round);
                          }
                        }}
                        disabled={metrics.isRedeemingWithdrawal}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${metrics.isRedeemingWithdrawal
                          ? 'bg-white/[0.04] text-arca-text-tertiary cursor-not-allowed'
                          : 'bg-arca-green/[0.1] text-arca-green hover:bg-arca-green/[0.15] animate-pulse-soft'
                          }`}
                      >
                        {metrics.isRedeemingWithdrawal ? '...' : `Claim${metrics.claimableWithdrawals.length > 1 ? ` (${metrics.claimableWithdrawals.length})` : ''}`}
                      </button>
                    ) : metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n ? (
                      <span className="text-[10px] text-amber-400 font-medium">Queued</span>
                    ) : (
                      <span className="text-[10px] text-arca-text-tertiary">-</span>
                    )}
                  </div>

                  {/* Status — Mobile */}
                  <div className="flex items-center justify-center">
                    {hasPosition && position.hasData ? (
                      <div className="w-full max-w-[55px]">
                        <div className="h-2.5 bg-white/[0.04] rounded-full overflow-visible relative">
                          <div
                            className="h-full bg-gradient-to-r from-arca-green/50 via-arca-green/30 to-arca-green/50 absolute left-0 rounded-full"
                            style={{ width: '100%' }}
                          />
                          <div
                            className="absolute top-0 w-0.5 h-full bg-red-400 rounded-full"
                            style={{
                              left: `${position.pricePosition}%`,
                              boxShadow: '0 0 4px rgba(248, 113, 113, 0.6)',
                              transform: 'translateX(-50%)'
                            }}
                          />
                        </div>
                      </div>
                    ) : hasPosition ? (
                      <div className="w-full max-w-[55px]">
                        <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-arca-green/50 via-arca-green/30 to-arca-green/50 absolute left-0 rounded-full"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-arca-text-tertiary">-</span>
                    )}
                  </div>

                  {/* APR — Mobile */}
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-arca-green font-semibold text-xs">
                      {rewardApr > 0 ? `${rewardApr.toFixed(1)}%` : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {depositVault && (
        <DepositModal
          vaultAddress={depositVault.vaultAddress}
          stratAddress={depositVault.stratAddress}
          vaultName={depositVault.name}
          tokenXBalance={tokenXBalance}
          tokenYBalance={tokenYBalance}
          tokenX={depositVault.tokenX}
          tokenY={depositVault.tokenY}
          onClose={() => setDepositModalVault(null)}
        />
      )}

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
    </>
  );
}
