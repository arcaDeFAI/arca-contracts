'use client';

import { useMemo, useState, type ReactNode } from 'react';
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
  showAllVaults?: boolean;
  interactiveRows?: boolean;
  visibleVaultAddresses?: string[];
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

export function VaultTableView({
  vaults,
  userAddress,
  onVaultClick,
  selectedVault,
  showAllVaults = false,
  interactiveRows = true,
  visibleVaultAddresses,
}: VaultTableViewProps) {
  const [depositModalVault, setDepositModalVault] = useState<string | null>(null);
  const [withdrawModalVault, setWithdrawModalVault] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const depositVault = depositModalVault
    ? vaults.find((v) => v.vaultAddress === depositModalVault) ?? null
    : null;

  const { tokenXBalance, tokenYBalance } = useDepositBalances(depositVault, userAddress);

  const vaultMetrics = vaults.map((config) => useVaultMetrics(config, userAddress));
  const harvestedData = vaults.map((vault) => useUserHarvestedForVault(vault.vaultAddress, userAddress));
  const positionData = vaults.map((vault) =>
    useVaultPositionData({
      vaultAddress: vault.vaultAddress,
      stratAddress: vault.stratAddress,
      lbBookAddress: vault.lbBookAddress,
      clpoolAddress: vault.clpoolAddress,
      name: vault.name,
      tokenX: vault.tokenX,
      tokenY: vault.tokenY,
    }),
  );

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

  const SortableHeader = ({ column, children }: { column: SortColumn; children: ReactNode }) => {
    const isActive = sortColumn === column;
    const isAsc = isActive && sortDirection === 'asc';
    const isDesc = isActive && sortDirection === 'desc';

    return (
      <button
        type="button"
        className="grid w-full grid-cols-[1fr,auto,1fr] items-center text-center cursor-pointer hover:text-arca-green transition-colors group outline-none select-none"
        onClick={() => handleSort(column)}
      >
        <span aria-hidden="true" />
        <span>{children}</span>
        <div className="justify-self-start flex flex-col gap-0.5 opacity-40 group-hover:opacity-80 transition-opacity">
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
      </button>
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

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [vaults, vaultMetrics, harvestedData, sortColumn, sortDirection]);

  const visibleVaultSet = useMemo(
    () => (visibleVaultAddresses ? new Set(visibleVaultAddresses) : null),
    [visibleVaultAddresses],
  );

  return (
    <>
      <div className="overflow-hidden rounded-[22px] border border-white/[0.04] bg-arca-gray/80 shadow-card backdrop-blur-sm">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-[2.15fr,1.2fr,1fr,1fr,1fr,0.9fr,0.95fr,112px] gap-4 border-b border-white/[0.04] bg-white/[0.02] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-arca-text-tertiary">
              <div className="pl-11">Vault</div>
              <div className="text-center pl-[12px]">Range</div>
              <SortableHeader column="deposit">Your Deposit</SortableHeader>
              <SortableHeader column="dailyRewards">Daily</SortableHeader>
              <SortableHeader column="earned">Earned</SortableHeader>
              <SortableHeader column="apr">APR</SortableHeader>
              <div className="text-center">TVL</div>
              <div className="flex w-full items-center justify-center gap-1 text-center">
                <span>Status</span>
                <Tooltip text="Withdrawals can be claimed when ready and canceled while queued." width="sm" ariaLabel="Withdrawal information" />
              </div>
            </div>

            <div>
              {sortedVaultIndices.map((index, sortIndex) => {
                const vault = vaults[index];
                if (visibleVaultSet && !visibleVaultSet.has(vault.vaultAddress)) {
                  return null;
                }
                const metrics = vaultMetrics[index];
                const harvested = harvestedData[index];
                const position = positionData[index];
                const isSelected = selectedVault?.vaultAddress === vault.vaultAddress;
                const isShadow = vault.name.includes('Shadow');
                const hasPosition = Boolean(metrics.depositedValueUSD && metrics.depositedValueUSD > 0);

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
                    return sum + amount * price;
                  }, 0);
                }

                const hasClaimableRewards = isShadow ? totalRewardsUSD >= 0.01 : nonZeroRewards.length > 0;
                const hasQueuedWithdrawal = Boolean(metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n);
                const hasClaimableWithdrawal = Boolean(metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0);
                const hasAnyRewards = nonZeroRewards.length > 0;

                if (!showAllVaults && !hasPosition && !hasAnyRewards && !hasQueuedWithdrawal && !hasClaimableWithdrawal) {
                  return null;
                }

                const rewardApr = metrics.subgraphMetrics.rewardApr ?? 0;
                const dailyRewardsUSD = metrics.depositedValueUSD && rewardApr > 0
                  ? (metrics.depositedValueUSD * (rewardApr / 100)) / 365
                  : 0;
                const dexName = isShadow ? 'Shadow' : 'Metropolis';
                const dexLogo = isShadow ? '/shadow-logo.png' : '/metropolis-logo.png';
                const dexPillClass = isShadow
                  ? 'border-[#8c5a16]/55 bg-[linear-gradient(135deg,rgba(255,184,77,0.22),rgba(255,184,77,0.12)_46%,rgba(89,52,10,0.3))] text-[#ffe2a7] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,238,205,0.18),inset_0_-1px_0_rgba(102,60,12,0.22),0_10px_24px_rgba(27,16,3,0.16)]'
                  : 'border-[#25346f]/70 bg-[linear-gradient(135deg,rgba(126,137,255,0.2),rgba(126,137,255,0.12)_46%,rgba(19,29,74,0.34))] text-[#d8deff] backdrop-blur-md shadow-[inset_0_1px_0_rgba(176,190,255,0.12),inset_0_-1px_0_rgba(17,25,63,0.3),0_10px_24px_rgba(8,12,30,0.22)]';

                return (
                  <div
                    key={vault.vaultAddress}
                    onClick={() => interactiveRows && onVaultClick(vault)}
                    className={`w-full border-l-2 transition-all duration-200 ${
                      sortIndex > 0 ? 'border-t border-white/[0.04]' : ''
                    } ${
                      isSelected
                        ? 'border-l-arca-green bg-arca-green/[0.04]'
                        : interactiveRows
                          ? 'border-l-transparent cursor-pointer hover:border-l-arca-green/40 hover:bg-white/[0.02]'
                          : 'border-l-transparent hover:bg-white/[0.015]'
                    }`}
                  >
                    <div className="grid grid-cols-[2.15fr,1.2fr,1fr,1fr,1fr,0.9fr,0.95fr,112px] items-center gap-4 px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <TokenPairLogos
                          token0Logo={getTokenLogo(vault.tokenX)}
                          token1Logo={getTokenLogo(vault.tokenY)}
                          size={28}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-medium leading-tight text-arca-text">
                            {vault.tokenX} / {vault.tokenY}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[0.375rem] text-[9px] font-medium tracking-[0.08em] ${dexPillClass}`}>
                              <img
                                src={dexLogo}
                                alt={dexName}
                                className="h-4 w-4 object-contain"
                              />
                              {dexName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="w-full max-w-[190px]">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-arca-text-tertiary">
                              Range
                            </span>
                            <span className="text-[10px] font-medium text-arca-text-secondary">
                              {metrics.activePercentage !== undefined ? `${metrics.activePercentage.toFixed(0)}% active` : '--'}
                            </span>
                          </div>
                          <RangeBar
                            position={position}
                            activePercentage={metrics.activePercentage}
                            compact
                            tokenY={vault.tokenY}
                          />
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] text-arca-text-tertiary">
                            <div className="flex items-center gap-1">
                              <div className="h-1.5 w-2.5 rounded-sm bg-arca-green/50" />
                              <span>LP Range</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-[3px] rounded-full bg-red-400" />
                              <span>Price</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center text-sm font-medium text-arca-text">
                        ${metrics.depositedValueUSD?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </div>

                      <div className="text-center text-sm font-medium text-arca-text">
                        ${dailyRewardsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>

                      <div className="text-center text-sm font-medium text-arca-text">
                        ${harvested.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>

                      <div className="text-center text-sm font-semibold text-arca-green">
                        {rewardApr > 0 ? `${rewardApr.toFixed(2)}%` : '-'}
                      </div>

                      <div className="text-center text-sm font-medium text-arca-text-secondary">
                        ${metrics.vaultTVL?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        {metrics.claimableWithdrawals && metrics.claimableWithdrawals.length > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (metrics.handleRedeemWithdrawal && metrics.claimableWithdrawals && !metrics.isRedeemingWithdrawal) {
                                metrics.handleRedeemWithdrawal(metrics.claimableWithdrawals[0].round);
                              }
                            }}
                            disabled={metrics.isRedeemingWithdrawal}
                            className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                              metrics.isRedeemingWithdrawal
                                ? 'cursor-not-allowed bg-white/[0.04] text-arca-text-tertiary'
                                : 'animate-pulse-soft bg-arca-green/[0.1] text-arca-green hover:bg-arca-green/[0.15]'
                            }`}
                            title={metrics.claimableWithdrawals.length > 1 ? `${metrics.claimableWithdrawals.length} withdrawals available` : undefined}
                          >
                            {metrics.isRedeemingWithdrawal ? 'Processing...' : `Claim${metrics.claimableWithdrawals.length > 1 ? ` (${metrics.claimableWithdrawals.length})` : ''}`}
                          </button>
                        ) : metrics.queuedWithdrawal && metrics.queuedWithdrawal > 0n ? (
                          <span className="min-w-[58px] text-center text-xs font-medium text-amber-400">Queued</span>
                        ) : (
                          <span className="min-w-[58px] text-center text-xs text-arca-text-tertiary">-</span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (metrics.handleClaimRewards && !metrics.isClaimingRewards && hasClaimableRewards) {
                              metrics.handleClaimRewards();
                            }
                          }}
                          disabled={metrics.isClaimingRewards || !hasClaimableRewards}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                            metrics.isClaimingRewards || !hasClaimableRewards
                              ? 'cursor-not-allowed opacity-20'
                              : 'bg-white/[0.03] hover:bg-arca-green/[0.08] hover:text-arca-green'
                          }`}
                          title={hasClaimableRewards ? 'Claim Rewards' : 'No Rewards Available'}
                        >
                          <svg
                            className={`h-3.5 w-3.5 ${metrics.isClaimingRewards || !hasClaimableRewards ? 'text-arca-text-tertiary' : 'text-arca-green'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDepositModalVault(vault.vaultAddress);
                          }}
                          disabled={!userAddress}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] transition-all hover:bg-arca-green/[0.08] disabled:cursor-not-allowed disabled:opacity-20"
                          title="Deposit"
                        >
                          <svg className="h-3.5 w-3.5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        </button>

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
                          className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.03] transition-all disabled:cursor-not-allowed disabled:opacity-20 ${
                            hasQueuedWithdrawal ? 'hover:bg-red-500/[0.1]' : 'hover:bg-red-500/[0.08]'
                          }`}
                          title={hasQueuedWithdrawal ? 'Cancel Withdrawal' : 'Withdraw'}
                        >
                          {hasQueuedWithdrawal ? (
                            <svg className="h-3.5 w-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
        const vaultIndex = vaults.findIndex((v) => v.vaultAddress === withdrawModalVault);
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
