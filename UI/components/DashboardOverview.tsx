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
  const [showRewardsSection, setShowRewardsSection] = useState(false)
  const [showCapitalSection, setShowCapitalSection] = useState(false)

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

  const DropdownButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-medium tracking-[0.16em] text-arca-text-secondary transition-colors hover:text-arca-text md:text-xs"
    >
      <span className={label === label.toUpperCase() ? 'uppercase' : 'capitalize'}>{label}</span>
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  const DropdownMenu = ({ items, active, onSelect }: { items: string[]; active: string; onSelect: (item: string) => void }) => (
    <div className="absolute top-full right-0 mt-1.5 z-[300] w-24 overflow-hidden rounded-xl border border-white/[0.08] bg-arca-gray shadow-elevated animate-fade-in md:w-28">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] text-arca-text transition-colors hover:bg-white/[0.04] md:text-xs"
        >
          <span className={item === item.toUpperCase() ? 'uppercase' : 'capitalize'}>{item}</span>
          {active === item && (
            <svg className="h-3.5 w-3.5 text-arca-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
            </svg>
          )}
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
    <div className="mb-6 space-y-5">
      <div className="grid grid-cols-1 gap-3 overflow-visible sm:grid-cols-2 lg:grid-cols-5">
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
            <span className="text-[11px] text-arca-text-tertiary md:text-[12px]">Since {earnedSinceLabel}</span>
          }
        />

        <StatsCard
          title="Rewards"
          subtitle={<span className="text-[11px] text-arca-text-tertiary md:text-[12px] capitalize">Est. {rewardPeriod}</span>}
          value={`$${extrapolatedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          rightElement={RewardDropdown}
          loading={aggregatedData.isLoading && extrapolatedReward === 0}
          className={`${showRewardDropdown ? 'z-[340]' : 'z-[300]'}`}
        />

        <StatsCard
          title={
            <div className="flex items-center gap-1.5">
              <span>Rate</span>
              <Tooltip text={getAPYCalculationExplanation()} width="lg" position="right" ariaLabel="APY calculation explanation" />
            </div>
          }
          subtitle={<span className="text-[11px] text-arca-text-tertiary md:text-[12px]">{ratePeriod}</span>}
          value={`${calculatedRate.toFixed(2)}%`}
          rightElement={RateDropdown}
          loading={aggregatedData.isLoading && calculatedRate === 0}
          className={`${showRateDropdown ? 'z-[330]' : 'z-[290]'}`}
        />

        <StatsCard
          title="Active Positions"
          value={activeLPs}
          loading={aggregatedData.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className={`rounded-2xl border border-white/[0.04] bg-arca-gray/80 shadow-card transition-all duration-300 ${showRewardsSection ? 'h-[286px] p-5' : 'h-[84px] p-4'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRewardsSection(!showRewardsSection)}
                  className="hover:opacity-80 transition-opacity p-0.5 -ml-0.5"
                >
                  <svg
                    className={`h-4 w-4 text-arca-text-tertiary transition-transform duration-300 ${showRewardsSection ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <h3 className="text-sm font-semibold text-arca-text">Claimable Rewards</h3>
              </div>
              <div className="ml-6 mt-1.5 text-xl font-bold text-arca-green">
                ${aggregatedData.totalClaimableUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={handleClaimAll}
              disabled={aggregatedData.totalClaimableUSD === 0}
              className="whitespace-nowrap rounded-xl bg-arca-green px-5 py-2 text-sm font-semibold text-arca-dark transition-all duration-200 hover:bg-arca-green/90 hover:shadow-glow-green active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
            >
              Claim All
            </button>
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showRewardsSection ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0">
              <div className="mt-4 space-y-4 border-t border-white/[0.04] pt-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <img src="/MetropolisLogo.png" alt="Metropolis" className="h-4 w-4" />
                    <span className="text-sm font-medium text-arca-text">Metropolis</span>
                  </div>
                  {aggregatedData.totalMetroRewardsUSD > 0 ? (
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <img src="/MetropolisLogo.png" alt="Metro" className="h-3.5 w-3.5" />
                        <span className="text-sm text-arca-text-secondary">Metro</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-arca-text">
                          {aggregatedData.metroRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-arca-text-tertiary">${aggregatedData.totalMetroRewardsUSD.toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-arca-text-tertiary">No Metropolis rewards</div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <img src="/SHadowLogo.jpg" alt="Shadow" className="h-4 w-4 rounded-full" />
                    <span className="text-sm font-medium text-arca-text">Shadow</span>
                  </div>
                  {aggregatedData.totalShadowRewardsUSD > 0 ? (
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <img src="/SHadowLogo.jpg" alt="Shadow" className="h-3.5 w-3.5 rounded-full" />
                        <span className="text-sm text-arca-text-secondary">Shadow</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-arca-text">
                          {aggregatedData.shadowRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-arca-text-tertiary">${aggregatedData.totalShadowRewardsUSD.toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-arca-text-tertiary">No Shadow rewards</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <PortfolioAllocationCard
            allocations={aggregatedData.allocations}
            totalValueUSD={aggregatedData.totalBalanceUSD}
            deposited={aggregatedData.deposited}
            isCollapsible={true}
            isExpanded={showCapitalSection}
            onToggle={() => setShowCapitalSection(!showCapitalSection)}
          />
        </div>
      </div>
    </div>
  )
}
