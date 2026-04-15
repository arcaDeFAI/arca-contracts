'use client'
import { type VaultConfig } from '@/lib/vaultConfigs';

import { formatUnits } from 'viem';
import { getTokenByAddress } from '@/lib/tokenRegistry'
import { type UserRewardStructOutput } from '@/lib/typechain';

import { useMemo, useState } from 'react'
import { useVaultMetrics } from '@/hooks/useVaultMetrics'
import { useSubgraphUserHarvested } from '@/hooks/useSubgraphUserHarvested'
import { SUBGRAPH_START_TIMESTAMP_MS } from '@/lib/subgraph'
import { usePrices } from '@/contexts/PriceContext'
import { PortfolioAllocationCard } from './PortfolioAllocationCard'
import { Tooltip } from './Tooltip'
import { StatsCard } from './StatsCard'
import { useDashboardAggregatedData } from '@/hooks/useDashboardAggregatedData'
import { getAPYCalculationExplanation } from '@/hooks/useSubgraphMetrics'



interface DashboardOverviewProps {
  vaultConfigs: VaultConfig[]
  userAddress?: string
}

export function DashboardOverview({ vaultConfigs, userAddress }: DashboardOverviewProps) {
  const { prices } = usePrices()

  const vaultMetrics = vaultConfigs.map(config =>
    useVaultMetrics(config, userAddress)
  )

  const { harvestsByVault, firstHarvestTimestamp, isLoading: harvestsLoading } =
    useSubgraphUserHarvested(userAddress)

  const earnedSinceMs = firstHarvestTimestamp ?? SUBGRAPH_START_TIMESTAMP_MS
  const earnedSinceLabel = new Date(earnedSinceMs).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const totalHarvestedData = vaultConfigs.map(config => {
    const summary = harvestsByVault.get(config.vaultAddress.toLowerCase())
    return {
      totalHarvestedUSD: summary?.totalHarvestedUSD ?? 0,
      firstHarvestTimestamp: summary?.firstTimestamp ?? null,
      isLoading: harvestsLoading,
    }
  })

  const aggregatedData = useDashboardAggregatedData(vaultMetrics, vaultConfigs, totalHarvestedData, prices)

  const activeLPs = useMemo(() => {
    return vaultMetrics.filter(metrics =>
      metrics.depositedValueUSD && metrics.depositedValueUSD > 0
    ).length
  }, [vaultMetrics])

  const [rewardPeriod, setRewardPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [ratePeriod, setRatePeriod] = useState<'DPR' | 'WPR' | 'APR'>('APR')
  const [showRewardDropdown, setShowRewardDropdown] = useState(false)
  const [showRateDropdown, setShowRateDropdown] = useState(false)
  const [showSections, setShowSections] = useState(false)

  const avgAPY = useMemo(() => {
    let totalWeightedAPY = 0
    let totalTVL = 0

    vaultMetrics.forEach(metrics => {
      const userTVL = metrics.depositedValueUSD || 0
      const vaultAPY = metrics.apy || 0

      if (userTVL > 0 && vaultAPY > 0) {
        totalWeightedAPY += userTVL * vaultAPY
        totalTVL += userTVL
      }
    })

    return totalTVL > 0 ? totalWeightedAPY / totalTVL : 0
  }, [vaultMetrics])

  const calculatedRate = useMemo(() => {
    if (ratePeriod === 'DPR') return avgAPY / 365
    if (ratePeriod === 'WPR') return avgAPY / 52
    return avgAPY
  }, [avgAPY, ratePeriod])

  const extrapolatedReward = useMemo(() => {
    const totalDeposited = aggregatedData.totalBalanceUSD

    if (totalDeposited === 0 || avgAPY === 0) return 0

    const periodMultiplier = {
      hourly: 1 / (365 * 24),
      daily: 1 / 365,
      weekly: 1 / 52,
      monthly: 1 / 12,
      yearly: 1,
    }

    return totalDeposited * (avgAPY / 100) * periodMultiplier[rewardPeriod]
  }, [aggregatedData.totalBalanceUSD, avgAPY, rewardPeriod])

  if (!userAddress) {
    return null
  }

  const handleClaimAll = () => {
    const vaultsWithRewards = new Set<string>()
    vaultMetrics.forEach((metrics, index) => {
      const config = vaultConfigs[index]
      const vaultKey = config.vaultAddress.toLowerCase()

      if (metrics.handleClaimRewards &&
        metrics.pendingRewards &&
        metrics.pendingRewards.length > 0 &&
        !vaultsWithRewards.has(vaultKey)) {

        let vaultTotalUSD = 0;
        metrics.pendingRewards.forEach((reward: UserRewardStructOutput) => {
          const amount = Number(formatUnits(reward.pendingRewards, 18));
          const tokenDef = getTokenByAddress(reward.token);
          const priceKey = tokenDef?.canonicalName.toLowerCase();
          const price = priceKey && metrics.prices ? (metrics.prices[priceKey] || 0) : 0;
          vaultTotalUSD += amount * price;
        });

        if (vaultTotalUSD > 0.05) {
          vaultsWithRewards.add(vaultKey)
          metrics.handleClaimRewards()
        }
      }
    })
  }

  // Dropdown components
  const DropdownButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick} className="text-[14px] text-arca-text-tertiary hover:text-arca-text-secondary flex items-center gap-1 transition-colors">
      <span className="capitalize">{label}</span>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  const DropdownMenu = ({ items, active, onSelect }: { items: string[]; active: string; onSelect: (item: string) => void }) => (
    <div className="absolute top-full right-0 mt-1.5 w-28 bg-arca-gray border border-white/[0.08] rounded-xl shadow-elevated z-[300] overflow-hidden animate-fade-in">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className="w-full px-3 py-2 text-left text-arca-text text-xs hover:bg-white/[0.04] flex items-center justify-between transition-colors"
        >
          <span className="capitalize">{item}</span>
          {active === item && <span className="text-arca-green text-[10px]">✓</span>}
        </button>
      ))}
    </div>
  )

  const RewardDropdown = (
    <div className="relative z-[300]">
      <DropdownButton label={rewardPeriod} onClick={() => setShowRewardDropdown(!showRewardDropdown)} />
      {showRewardDropdown && (
        <DropdownMenu
          items={['hourly', 'daily', 'weekly', 'monthly', 'yearly']}
          active={rewardPeriod}
          onSelect={(item) => {
            setRewardPeriod(item as typeof rewardPeriod)
            setShowRewardDropdown(false)
          }}
        />
      )}
    </div>
  )

  const RateDropdown = (
    <div className="relative z-[300]">
      <DropdownButton label={ratePeriod} onClick={() => setShowRateDropdown(!showRateDropdown)} />
      {showRateDropdown && (
        <DropdownMenu
          items={['DPR', 'WPR', 'APR']}
          active={ratePeriod}
          onSelect={(item) => {
            setRatePeriod(item as typeof ratePeriod)
            setShowRateDropdown(false)
          }}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-5 mb-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 overflow-visible">
        <StatsCard
          title="Total Deposits"
          value={`$${aggregatedData.totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          loading={aggregatedData.isLoading}
        />

        <StatsCard
          title={
            <>
              <span>Total Earned</span>
              <Tooltip text={`Total claimed rewards since ${earnedSinceLabel}.`} width="sm" ariaLabel="Total Earned explanation" />
            </>
          }
          value={`$${aggregatedData.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          loading={aggregatedData.isLoading}
          subtitle={
            <span className="text-[12px] text-arca-text-tertiary">Since {earnedSinceLabel}</span>
          }
        />

        <StatsCard
          title="Rewards"
          subtitle={<span className="text-[12px] text-arca-text-tertiary capitalize">Est. {rewardPeriod}</span>}
          value={`$${extrapolatedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          rightElement={RewardDropdown}
          loading={aggregatedData.isLoading && extrapolatedReward === 0}
          className="z-[300]"
        />

        <StatsCard
          title={
            <div className="flex items-center gap-1.5">
              <span>Rate</span>
              <Tooltip text={getAPYCalculationExplanation()} width="lg" position="right" ariaLabel="APY calculation explanation" />
            </div>
          }
          subtitle={<span className="text-[11px] text-arca-text-tertiary">{ratePeriod}</span>}
          value={`${calculatedRate.toFixed(2)}%`}
          rightElement={RateDropdown}
          loading={aggregatedData.isLoading && calculatedRate === 0}
          className="z-[300]"
        />

        <StatsCard
          title="Active Positions"
          value={activeLPs}
          loading={aggregatedData.isLoading}
        />
      </div>

      {/* Claimable Rewards + Capital Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Claimable Rewards */}
        <div className={`bg-arca-gray/80 border border-white/[0.04] rounded-2xl shadow-card transition-all ${showSections ? 'p-5' : 'p-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSections(!showSections)}
                  className="hover:opacity-80 transition-opacity p-0.5 -ml-0.5"
                >
                  <svg
                    className={`w-4 h-4 text-arca-text-tertiary transition-transform duration-200 ${showSections ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <h3 className="text-arca-text text-sm font-semibold">Claimable Rewards</h3>
              </div>
              <div className="text-arca-green text-xl font-bold mt-1.5 ml-6">
                ${aggregatedData.totalClaimableUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={handleClaimAll}
              disabled={aggregatedData.totalClaimableUSD === 0}
              className="bg-arca-green text-arca-dark font-semibold px-5 py-2 rounded-xl text-sm hover:bg-arca-green/90 hover:shadow-glow-green transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none whitespace-nowrap"
            >
              Claim All
            </button>
          </div>

          {showSections && (
            <>
              <div className="border-t border-white/[0.04] mt-4 pt-4 space-y-4">
                {/* Metropolis Rewards */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <img src="/MetropolisLogo.png" alt="Metropolis" className="w-4 h-4" />
                    <span className="text-arca-text text-sm font-medium">Metropolis</span>
                  </div>
                  {aggregatedData.totalMetroRewardsUSD > 0 ? (
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <img src="/MetropolisLogo.png" alt="Metro" className="w-3.5 h-3.5" />
                        <span className="text-arca-text-secondary text-sm">Metro</span>
                      </div>
                      <div className="text-right">
                        <div className="text-arca-text font-medium text-sm">
                          {aggregatedData.metroRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                        </div>
                        <div className="text-arca-text-tertiary text-xs">${aggregatedData.totalMetroRewardsUSD.toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-arca-text-tertiary text-xs py-1.5 px-3">No Metropolis rewards</div>
                  )}
                </div>

                {/* Shadow Rewards */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <img src="/SHadowLogo.jpg" alt="Shadow" className="w-4 h-4 rounded-full" />
                    <span className="text-arca-text text-sm font-medium">Shadow</span>
                  </div>
                  {aggregatedData.totalShadowRewardsUSD > 0 ? (
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <img src="/SHadowLogo.jpg" alt="Shadow" className="w-3.5 h-3.5 rounded-full" />
                        <span className="text-arca-text-secondary text-sm">Shadow</span>
                      </div>
                      <div className="text-right">
                        <div className="text-arca-text font-medium text-sm">
                          {aggregatedData.shadowRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                        </div>
                        <div className="text-arca-text-tertiary text-xs">${aggregatedData.totalShadowRewardsUSD.toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-arca-text-tertiary text-xs py-1.5 px-3">No Shadow rewards</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Capital Allocation */}
        <div>
          <PortfolioAllocationCard
            allocations={aggregatedData.allocations}
            totalValueUSD={aggregatedData.totalBalanceUSD}
            deposited={aggregatedData.deposited}
            isCollapsible={true}
            isExpanded={showSections}
            onToggle={() => setShowSections(!showSections)}
          />
        </div>
      </div>
    </div>
  )
}
