'use client'

import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useVaultMetrics } from '@/hooks/useVaultMetrics'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { use24hHarvestedRewards } from '@/hooks/use24hHarvestedRewards'
import { useDailyHarvestedRewards } from '@/hooks/useDailyHarvestedRewards'
import { useTotalEarnedFromCache } from '@/hooks/useTotalEarnedFromCache'
import { type UserRewardStructOutput } from '@/lib/typechain'
import { CONTRACTS } from '@/lib/contracts'
import { PortfolioAllocationCard } from './PortfolioAllocationCard'
import { BalanceHistoryCard } from './BalanceHistoryCard'
import { RewardsHistoryCard } from './RewardsHistoryCard'

interface VaultConfig {
  vaultAddress: string
  stratAddress: string
  lbBookAddress?: string
  clpoolAddress?: string
  name: string
  tier: 'Active' | 'Premium' | 'Elite'
}

interface DashboardOverviewProps {
  vaultConfigs: VaultConfig[]
  userAddress?: string
}

export function DashboardOverview({ vaultConfigs, userAddress }: DashboardOverviewProps) {
  // Fetch metrics for all vaults
  const vaultMetrics = vaultConfigs.map(config => 
    useVaultMetrics(config, userAddress)
  )

  // Fetch total earned rewards from APY caches (all time)
  const totalEarnedData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    const tokenPrice = isShadowVault 
      ? (metrics.prices?.shadow || 0) 
      : (metrics.prices?.metro || 0)
    
    return useTotalEarnedFromCache(config.stratAddress, isShadowVault, tokenPrice)
  })

  // Fetch 24h harvested rewards for calculating % change
  const harvested24hData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    // Use appropriate token price based on vault type
    const tokenPrice = isShadowVault 
      ? (metrics.prices?.shadow || 0) 
      : (metrics.prices?.metro || 0)
    
    return use24hHarvestedRewards(config.vaultAddress, userAddress, tokenPrice)
  })

  // Fetch daily harvested rewards (8am ET to 8am ET) - reads from APY caches
  const dailyHarvestedData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    const tokenPrice = isShadowVault 
      ? (metrics.prices?.shadow || 0) 
      : (metrics.prices?.metro || 0)
    
    return useDailyHarvestedRewards(config.stratAddress, isShadowVault, tokenPrice)
  })

  // Get earliest first earning date across all vaults
  const firstEarningDate = useMemo(() => {
    const dates = totalEarnedData
      .map(data => data.firstEventTimestamp)
      .filter((date): date is number => date !== null)
    
    return dates.length > 0 ? Math.min(...dates) : null
  }, [totalEarnedData])

  // Aggregate data from all vaults
  const aggregatedData = useMemo(() => {
    let totalBalanceUSD = 0
    let totalMetroRewardsUSD = 0
    let totalShadowRewardsUSD = 0
    let totalClaimableUSD = 0
    let totalHarvestedMetroUSD = 0
    let totalHarvestedShadowUSD = 0
    
    const tokenAllocations = new Map<string, { amount: number; usdValue: number }>()
    const depositedAmounts = new Map<string, { amount: number; usdValue: number }>()
    const metroRewards: Array<{ token: string; amount: number; usdValue: number; logo?: string }> = []
    const shadowRewards: Array<{ token: string; amount: number; usdValue: number; logo?: string }> = []

    vaultMetrics.forEach((metrics, index) => {
      const config = vaultConfigs[index]
      const isShadowVault = config.name.includes('Shadow')
      
      // Add deposited balance
      if (metrics.depositedValueUSD) {
        totalBalanceUSD += metrics.depositedValueUSD
      }

      // Calculate token allocations from complete strategy balance × user's share %
      // metrics.balances = strategy.getBalances() - the complete strategy balance
      // shareRatio = user's % ownership of the vault
      if (metrics.balances && metrics.userShares && metrics.totalSupply && metrics.totalSupply > 0n) {
        const shareRatio = Number(metrics.userShares) / Number(metrics.totalSupply)
        
        // Token 0 (S or WS) - Complete strategy balance × share %
        const token0Amount = Number(formatUnits(metrics.balances[0], 18)) * shareRatio
        const token0Value = token0Amount * (metrics.sonicPrice || 0)
        const token0Name = isShadowVault ? 'WS' : 'S'
        
        const existing0 = tokenAllocations.get(token0Name) || { amount: 0, usdValue: 0 }
        tokenAllocations.set(token0Name, {
          amount: existing0.amount + token0Amount,
          usdValue: existing0.usdValue + token0Value
        })

        // Track deposited amounts separately (same calculation for now)
        const existingDeposit0 = depositedAmounts.get(token0Name) || { amount: 0, usdValue: 0 }
        depositedAmounts.set(token0Name, {
          amount: existingDeposit0.amount + token0Amount,
          usdValue: existingDeposit0.usdValue + token0Value
        })

        // Token 1 (USDC) - Complete strategy balance × share %
        const token1Amount = Number(formatUnits(metrics.balances[1], 6)) * shareRatio
        const token1Value = token1Amount // USDC is 1:1 with USD
        
        const existing1 = tokenAllocations.get('USDC') || { amount: 0, usdValue: 0 }
        tokenAllocations.set('USDC', {
          amount: existing1.amount + token1Amount,
          usdValue: existing1.usdValue + token1Value
        })

        // Track deposited USDC
        const existingDeposit1 = depositedAmounts.get('USDC') || { amount: 0, usdValue: 0 }
        depositedAmounts.set('USDC', {
          amount: existingDeposit1.amount + token1Amount,
          usdValue: existingDeposit1.usdValue + token1Value
        })
      }

      // Process pending rewards
      if (metrics.pendingRewards) {
        const rewards = metrics.pendingRewards as UserRewardStructOutput[]
        
        rewards.forEach((reward) => {
          const tokenAddress = reward.token.toLowerCase()
          const amount = Number(formatUnits(reward.pendingRewards, 18))
          
          let tokenName = 'Unknown'
          let tokenPrice = 0
          let logo = undefined

          if (tokenAddress === CONTRACTS.METRO.toLowerCase()) {
            tokenName = 'Metro'
            tokenPrice = metrics.prices?.metro || 0
            logo = '/MetropolisLogo.png'
          } else if (tokenAddress === CONTRACTS.SHADOW.toLowerCase()) {
            tokenName = 'Shadow'
            tokenPrice = metrics.prices?.shadow || 0
            logo = '/SHadowLogo.jpg'
          } else if (tokenAddress === CONTRACTS.xSHADOW.toLowerCase()) {
            tokenName = 'xShadow'
            tokenPrice = metrics.prices?.xShadow || 0
            logo = '/SHadowLogo.jpg'
          }

          const usdValue = amount * tokenPrice

          if (amount > 0) {
            if (isShadowVault) {
              shadowRewards.push({ token: tokenName, amount, usdValue, logo })
              totalShadowRewardsUSD += usdValue
            } else {
              metroRewards.push({ token: tokenName, amount, usdValue, logo })
              totalMetroRewardsUSD += usdValue
            }
            totalClaimableUSD += usdValue
          }
        })
      }
    })

    // Process total earned rewards from APY caches
    totalEarnedData.forEach((earnedData, index) => {
      const config = vaultConfigs[index]
      const isShadowVault = config.name.includes('Shadow')

      if (isShadowVault) {
        totalHarvestedShadowUSD += earnedData.totalEarnedUSD
      } else {
        totalHarvestedMetroUSD += earnedData.totalEarnedUSD
      }
    })

    // Convert token allocations to array with percentages
    const allocations = Array.from(tokenAllocations.entries()).map(([token, data]) => {
      const percentage = totalBalanceUSD > 0 ? (data.usdValue / totalBalanceUSD) * 100 : 0
      
      // Assign colors based on token - military/tactical theme
      let color = '#6B7280' // gray fallback
      if (token === 'S') color = '#00FFA3' // Forest Green (military inspired)
      else if (token === 'WS') color = '#059669' // Deep Red (danger/alert accent)
      else if (token === 'USDC') color = '#15803D' // Gunmetal Gray
      
      return {
        token,
        amount: data.amount,
        usdValue: data.usdValue,
        percentage,
        color
      }
    }).sort((a, b) => b.percentage - a.percentage)

    // Convert deposited amounts to array
    const deposited = Array.from(depositedAmounts.entries()).map(([token, data]) => ({
      token,
      amount: data.amount,
      usdValue: data.usdValue
    }))

    return {
      totalBalanceUSD,
      totalRewardsUSD: totalMetroRewardsUSD + totalShadowRewardsUSD,
      totalMetroRewardsUSD,
      totalShadowRewardsUSD,
      totalClaimableUSD,
      totalHarvestedUSD: totalHarvestedMetroUSD + totalHarvestedShadowUSD,
      totalHarvestedMetroUSD,
      totalHarvestedShadowUSD,
      allocations,
      deposited,
      metroRewards,
      shadowRewards
    }
  }, [vaultMetrics, vaultConfigs, totalEarnedData])

  // Track balance history and calculate real 24h changes
  const { calculate24hChange } = useBalanceHistory(
    userAddress,
    aggregatedData.totalBalanceUSD,
    aggregatedData.totalHarvestedUSD
  )

  // Calculate 24h changes based on historical snapshots
  const balanceChange = calculate24hChange(aggregatedData.totalBalanceUSD, 'balance')
  const balanceChange24h = balanceChange.change
  const balanceChangePercentage = balanceChange.percentage

  // Calculate rewards 24h change from actual harvested amounts (from APY data)
  const total24hHarvestedUSD = harvested24hData.reduce((sum, data) => sum + data.harvested24hUSD, 0)
  const rewardsChange24h = total24hHarvestedUSD
  const rewardsChangePercentage = aggregatedData.totalHarvestedUSD > 0 
    ? (total24hHarvestedUSD / (aggregatedData.totalHarvestedUSD - total24hHarvestedUSD)) * 100 
    : 0

  // Calculate daily harvested rewards (8am to 8am)
  const totalDailyHarvestedUSD = dailyHarvestedData.reduce((sum, data) => sum + data.dailyHarvestedUSD, 0)

  // Advanced mode toggle state
  const [advancedMode, setAdvancedMode] = useState(false)

  // Calculate average APY across all vaults
  const avgAPY = useMemo(() => {
    const apys = vaultMetrics.map(m => m.apy).filter(apy => apy > 0)
    return apys.length > 0 ? apys.reduce((sum, apy) => sum + apy, 0) / apys.length : 0
  }, [vaultMetrics])

  // Calculate 30-day APR (APY / 12)
  const avgAPR30d = avgAPY / 12

  // Count active LP positions (vaults with deposits)
  const activeLPs = useMemo(() => {
    return vaultMetrics.filter(metrics => 
      metrics.depositedValueUSD && metrics.depositedValueUSD > 0
    ).length
  }, [vaultMetrics])

  // Format time duration since first earning
  const formatTimeSince = (timestamp: number | null): string => {
    if (!timestamp) return ''
    
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)
    
    if (years > 0) return `${years} year${years > 1 ? 's' : ''}`
    if (months > 0) return `${months} month${months > 1 ? 's' : ''}`
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
    return 'today'
  }

  if (!userAddress) {
    return null
  }

  return (
    <div className="space-y-5 mb-6">
      {/* Top Stats Cards - 6 Equal Width Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
        {/* Balance Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">Balance</div>
          <div className="text-arca-green text-2xl font-bold">
            ${aggregatedData.totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Daily Reward Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">Daily Reward</div>
          <div className="text-arca-green text-2xl font-bold">
            ${totalDailyHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Earned Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">
            Earned {firstEarningDate && (
              <span className="text-gray-500 text-xs ml-1">
                (since {formatTimeSince(firstEarningDate)})
              </span>
            )}
          </div>
          <div className="text-arca-green text-2xl font-bold">
            ${aggregatedData.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* AVG APR (30D) Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">APR (30D)</div>
          <div className="text-arca-green text-2xl font-bold">
            {avgAPR30d.toFixed(0)}%
          </div>
        </div>

        {/* APY Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">AVG APY</div>
          <div className="text-arca-green text-2xl font-bold">
            {avgAPY.toFixed(0)}%
          </div>
        </div>

        {/* Active LPs Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-gray-400 text-sm mb-2">Active Positions</div>
          <div className="text-arca-green text-2xl font-bold">
            {activeLPs}
          </div>
        </div>
      </div>

      {/* Main Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Claimable Rewards */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white text-lg font-semibold">Claimable Rewards</h3>
                <div className="text-arca-green text-xl font-bold mt-1">
                  ${aggregatedData.totalClaimableUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <button
                onClick={() => {
                  // Claim all rewards logic here
                  vaultMetrics.forEach(metrics => {
                    if (metrics.handleClaimRewards) {
                      metrics.handleClaimRewards()
                    }
                  })
                }}
                disabled={aggregatedData.totalClaimableUSD === 0}
                className="bg-arca-green text-black font-semibold px-6 py-2 rounded-lg hover:bg-arca-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Claim Rewards
              </button>
            </div>
            <div className="border-t border-gray-800/50 pt-4 mt-2"></div>

            {/* Metropolis Rewards */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <img src="/MetropolisLogo.png" alt="Metropolis" className="w-5 h-5" />
                <span className="text-white font-semibold">Metropolis Rewards</span>
              </div>
              {aggregatedData.metroRewards.map((reward, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <img src="/MetropolisLogo.png" alt="Metro" className="w-4 h-4" />
                    <span className="text-gray-300 text-sm">Metro</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{reward.amount.toFixed(4)}</div>
                    <div className="text-gray-400 text-xs">${reward.usdValue.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Shadow Rewards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/SHadowLogo.jpg" alt="Shadow" className="w-5 h-5 rounded-full" />
                <span className="text-white font-semibold">Shadow Rewards</span>
              </div>
              {aggregatedData.shadowRewards.map((reward, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <img src="/SHadowLogo.jpg" alt="Shadow" className="w-4 h-4 rounded-full" />
                    <span className="text-gray-300 text-sm">Shadow</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{reward.amount.toFixed(4)}</div>
                    <div className="text-gray-400 text-xs">${reward.usdValue.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
        </div>

        {/* Right Column: Capital Allocation */}
        <div>
          <PortfolioAllocationCard
            allocations={aggregatedData.allocations}
            totalValueUSD={aggregatedData.totalBalanceUSD}
            deposited={aggregatedData.deposited}
          />
        </div>
      </div>

      {/* Advanced Mode Toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setAdvancedMode(!advancedMode)}
          className="text-gray-400 hover:text-arca-green transition-colors text-sm flex items-center gap-2"
        >
          {advancedMode ? '▼' : '▶'} Advanced Mode
        </button>
      </div>

      {/* Advanced Mode: Charts */}
      {advancedMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-5 border-t border-gray-800/50">
          <BalanceHistoryCard
            currentBalance={aggregatedData.totalBalanceUSD}
            change24h={balanceChange24h}
            changePercentage={balanceChangePercentage}
          />
          <RewardsHistoryCard
            totalRewardsUSD={aggregatedData.totalHarvestedUSD}
            metroRewardsUSD={aggregatedData.totalHarvestedMetroUSD}
            shadowRewardsUSD={aggregatedData.totalHarvestedShadowUSD}
            change24h={rewardsChange24h}
            changePercentage={rewardsChangePercentage}
          />
        </div>
      )}
    </div>
  )
}
