'use client'
import { VAULT_CONFIGS, type VaultConfig } from '@/lib/vaultConfigs';

import { formatUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts';

import { useMemo, useState } from 'react'
import { useVaultMetrics } from '@/hooks/useVaultMetrics'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { use24hHarvestedRewards } from '@/hooks/use24hHarvestedRewards'
import { useDailyHarvestedRewards } from '@/hooks/useDailyHarvestedRewards'
import { useTotalHarvestedRewards } from '@/hooks/useTotalHarvestedRewards'
import { usePositionInRange } from '@/hooks/usePositionInRange'
import { usePrices } from '@/contexts/PriceContext'
import { PortfolioAllocationCard } from './PortfolioAllocationCard'
import { Tooltip } from './Tooltip'
import { StatsCard } from './StatsCard'
import { useDashboardAggregatedData } from '@/hooks/useDashboardAggregatedData'
import { getAPYCalculationExplanation } from '@/hooks/useShadowAPYAdjusted'



interface DashboardOverviewProps {
  vaultConfigs: VaultConfig[]
  userAddress?: string
}

export function DashboardOverview({ vaultConfigs, userAddress }: DashboardOverviewProps) {
  const { prices } = usePrices()

  // Fetch metrics for all vaults
  const vaultMetrics = vaultConfigs.map(config =>
    useVaultMetrics(config, userAddress)
  )

  // Fetch total harvested rewards for this specific user
  const totalHarvestedData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    const tokenPrice = isShadowVault
      ? (metrics.prices?.shadow || 0)
      : (metrics.prices?.metro || 0)

    // Removed hasBalance dependency to fix lifetime earnings bug
    return useTotalHarvestedRewards(config.vaultAddress, userAddress, tokenPrice)
  })

  // Use the new custom hook for aggregation
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
    return avgAPY // APR (monthly)
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

  // Right Element for Reward Card
  const RewardDropdown = (
    <div className="relative z-[300]">
      <button onClick={() => setShowRewardDropdown(!showRewardDropdown)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
        <span className="capitalize">{rewardPeriod}</span>
        <span>▼</span>
      </button>
      {showRewardDropdown && (
        <div className="absolute top-full right-0 mt-1 w-32 bg-black border border-gray-700 rounded-lg shadow-xl z-[300]">
          {(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
            <button
              key={period}
              onClick={() => {
                setRewardPeriod(period)
                setShowRewardDropdown(false)
              }}
              className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
            >
              <span className="capitalize">{period}</span>
              {rewardPeriod === period && <span className="text-arca-green text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Right Element for Rate Card
  const RateDropdown = (
    <div className="relative z-[300]">
      <button onClick={() => setShowRateDropdown(!showRateDropdown)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
        <span>{ratePeriod}</span>
        <span>▼</span>
      </button>
      {showRateDropdown && (
        <div className="absolute top-full right-0 mt-1 w-32 bg-black border border-gray-700 rounded-lg shadow-xl z-[300]">
          {(['DPR', 'WPR', 'APR'] as const).map((period) => (
            <button
              key={period}
              onClick={() => {
                setRatePeriod(period)
                setShowRateDropdown(false)
              }}
              className="w-full px-3 py-2 text-left text-white text-sm hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
            >
              <span>{period}</span>
              {ratePeriod === period && <span className="text-arca-green text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ... existing imports

  const handleClaimAll = () => {
    const vaultsWithRewards = new Set<string>()
    vaultMetrics.forEach((metrics, index) => {
      const config = vaultConfigs[index]
      const vaultKey = config.vaultAddress.toLowerCase()

      if (metrics.handleClaimRewards &&
        metrics.pendingRewards &&
        metrics.pendingRewards.length > 0 &&
        !vaultsWithRewards.has(vaultKey)) {

        // Calculate total USD value of pending rewards for this vault
        let vaultTotalUSD = 0;
        metrics.pendingRewards.forEach((reward: any) => {
          const amount = Number(formatUnits(reward.pendingRewards, 18));
          const tokenAddress = reward.token.toLowerCase();
          let price = 0;

          if (tokenAddress === CONTRACTS.METRO.toLowerCase()) {
            price = metrics.prices?.metro || 0;
          } else if (tokenAddress === CONTRACTS.SHADOW.toLowerCase()) {
            price = metrics.prices?.shadow || 0;
          } else if (tokenAddress === CONTRACTS.xSHADOW.toLowerCase()) {
            price = metrics.prices?.xShadow || 0;
          }

          vaultTotalUSD += amount * price;
        });

        // Only claim if value is greater than $0.05
        if (vaultTotalUSD > 0.05) {
          vaultsWithRewards.add(vaultKey)
          metrics.handleClaimRewards()
        }
      }
    })
  }

  return (
    <div className="space-y-5 mb-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 overflow-visible">
        <StatsCard
          title="Total Deposits"
          value={`$${aggregatedData.totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          loading={aggregatedData.isLoading}
        />

        <StatsCard
          title={
            <>
              <span>Total Earned</span>
              <Tooltip text="Total claimed rewards since first deposit." width="sm" ariaLabel="Total Earned explanation" />
            </>
          }
          value={`$${aggregatedData.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          loading={aggregatedData.isLoading}
          subtitle={
            aggregatedData.earliestFirstDeposit ? (
              <span className="text-xs text-gray-500 block -mt-1">
                Since {new Date(aggregatedData.earliestFirstDeposit).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : null
          }
        />

        <StatsCard
          title="Rewards"
          subtitle={<span className="text-xs text-gray-500 block -mt-1 capitalize">Est. {rewardPeriod}</span>}
          value={`$${extrapolatedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          rightElement={RewardDropdown}
          loading={aggregatedData.isLoading && extrapolatedReward === 0}
          className="z-[300]"
        />

        <StatsCard
          title={
            <div className="flex items-center gap-2">
              <span>Rate</span>
              <Tooltip text={getAPYCalculationExplanation()} width="lg" position="right" ariaLabel="APY calculation explanation" />
            </div>
          }
          subtitle={<span className="text-xs text-gray-500 block -mt-1">{ratePeriod}</span>}
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

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Claimable Rewards */}
        <div className={`bg-arca-gray border border-gray-800/60 rounded-xl transition-all ${showSections ? 'p-5' : 'p-3'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSections(!showSections)}
                  className="hover:opacity-80 transition-opacity p-1 -ml-1"
                >
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showSections ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <h3 className="text-white text-base md:text-lg font-semibold">Claimable Rewards</h3>
              </div>
              <div className="text-arca-green text-lg md:text-xl font-bold mt-1 pl-1">
                ${aggregatedData.totalClaimableUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <button
              onClick={handleClaimAll}
              disabled={aggregatedData.totalClaimableUSD === 0}
              className="bg-arca-green text-black font-semibold px-4 py-2 md:px-6 rounded-lg text-sm md:text-base hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Claim Rewards
            </button>
          </div>

          {showSections && (
            <>
              <div className="border-t border-gray-800/50 pt-4 mt-4"></div>

              {/* Metropolis Rewards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <img src="/MetropolisLogo.png" alt="Metropolis" className="w-5 h-5" />
                  <span className="text-white font-semibold">Metropolis Rewards</span>
                </div>
                {aggregatedData.totalMetroRewardsUSD > 0 ? (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <img src="/MetropolisLogo.png" alt="Metro" className="w-4 h-4" />
                      <span className="text-gray-300 text-sm">Metro</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        {aggregatedData.metroRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                      </div>
                      <div className="text-gray-400 text-xs">${aggregatedData.totalMetroRewardsUSD.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm py-2">No Metropolis rewards</div>
                )}
              </div>

              {/* Shadow Rewards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <img src="/SHadowLogo.jpg" alt="Shadow" className="w-5 h-5 rounded-full" />
                  <span className="text-white font-semibold">Shadow Rewards</span>
                </div>
                {aggregatedData.totalShadowRewardsUSD > 0 ? (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <img src="/SHadowLogo.jpg" alt="Shadow" className="w-4 h-4 rounded-full" />
                      <span className="text-gray-300 text-sm">Shadow</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        {aggregatedData.shadowRewards.reduce((sum, reward) => sum + reward.amount, 0).toFixed(4)}
                      </div>
                      <div className="text-gray-400 text-xs">${aggregatedData.totalShadowRewardsUSD.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm py-2">No Shadow rewards</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Column: Capital Allocation */}
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
