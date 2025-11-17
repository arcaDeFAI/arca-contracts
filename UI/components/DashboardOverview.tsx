'use client'

import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useVaultMetrics } from '@/hooks/useVaultMetrics'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { use24hHarvestedRewards } from '@/hooks/use24hHarvestedRewards'
import { useDailyHarvestedRewards } from '@/hooks/useDailyHarvestedRewards'
import { useTotalEarnedFromCache } from '@/hooks/useTotalEarnedFromCache'
import { useTotalEarnedAllTime } from '@/hooks/useTotalEarnedAllTime'
import { usePositionInRange } from '@/hooks/usePositionInRange'
import { type UserRewardStructOutput } from '@/lib/typechain'
import { CONTRACTS } from '@/lib/contracts'
import { getTokenDecimals } from '@/lib/tokenHelpers'
import { usePrices } from '@/contexts/PriceContext'
import { PortfolioAllocationCard } from './PortfolioAllocationCard'

interface VaultConfig {
  vaultAddress: string
  stratAddress: string
  lbBookAddress?: string
  clpoolAddress?: string
  name: string
  tier: 'Active' | 'Premium' | 'Elite'
  tokenX?: string
  tokenY?: string
}

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

  // Check if each vault's position is in range
  const positionsInRange = vaultConfigs.map(config => 
    usePositionInRange({
      vaultAddress: config.vaultAddress,
      stratAddress: config.stratAddress,
      lbBookAddress: config.lbBookAddress,
      clpoolAddress: config.clpoolAddress,
      name: config.name,
    })
  )

  // Fetch latest reward from APY caches (most recent reward only)
  const latestRewardData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    const tokenPrice = isShadowVault 
      ? (metrics.prices?.shadow || 0) 
      : (metrics.prices?.metro || 0)
    
    return useTotalEarnedFromCache(config.stratAddress, isShadowVault, tokenPrice)
  })

  // Fetch total earned all-time (accumulated historical rewards)
  const totalEarnedAllTimeData = vaultConfigs.map((config, index) => {
    const metrics = vaultMetrics[index]
    const isShadowVault = config.name.includes('Shadow')
    const tokenPrice = isShadowVault 
      ? (metrics.prices?.shadow || 0) 
      : (metrics.prices?.metro || 0)
    
    return useTotalEarnedAllTime(config.stratAddress, isShadowVault, tokenPrice)
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

  const [rewardPeriod, setRewardPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [ratePeriod, setRatePeriod] = useState<'DPR' | 'WPR' | 'APR'>('APR')
  const [showRewardDropdown, setShowRewardDropdown] = useState(false)
  const [showRateDropdown, setShowRateDropdown] = useState(false)

  const firstEarningDate = useMemo(() => {
    const dates = totalEarnedAllTimeData
      .map(data => data.firstEventTimestamp)
      .filter((date): date is number => date !== null)
    
    return dates.length > 0 ? Math.min(...dates) : null
  }, [totalEarnedAllTimeData])



  const avgAPY = useMemo(() => {
    const allAPYs = vaultMetrics
      .map(metrics => metrics.apy)
      .filter(apy => apy > 0)
    
    return allAPYs.length > 0 
      ? allAPYs.reduce((sum, apy) => sum + apy, 0) / allAPYs.length 
      : 0
  }, [vaultMetrics])

  const calculatedRate = useMemo(() => {
    if (ratePeriod === 'DPR') return avgAPY / 365
    if (ratePeriod === 'WPR') return avgAPY / 52
    return avgAPY // APR (monthly)
  }, [avgAPY, ratePeriod])

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
        
        // Get token names from config
        const tokenX = config.tokenX || 'S'
        const tokenY = config.tokenY || 'USDC'
        
        // Token 0 - use dynamic decimals and price
        const token0Decimals = getTokenDecimals(tokenX)
        const token0Amount = Number(formatUnits(metrics.balances[0], token0Decimals)) * shareRatio
        
        // Get token0 price (USDC = 1, S = sonic price, WETH = eth price)
        let token0Price = metrics.sonicPrice || 0 // Default for S
        if (tokenX.toUpperCase() === 'USDC') {
          token0Price = 1
        } else if (tokenX.toUpperCase() === 'WETH' || tokenX.toUpperCase() === 'ETH') {
          token0Price = metrics.prices?.weth || 0
        }
        const token0Value = token0Amount * token0Price
        
        const existing0 = tokenAllocations.get(tokenX) || { amount: 0, usdValue: 0 }
        tokenAllocations.set(tokenX, {
          amount: existing0.amount + token0Amount,
          usdValue: existing0.usdValue + token0Value
        })

        // Track deposited amounts separately (same calculation for now)
        const existingDeposit0 = depositedAmounts.get(tokenX) || { amount: 0, usdValue: 0 }
        depositedAmounts.set(tokenX, {
          amount: existingDeposit0.amount + token0Amount,
          usdValue: existingDeposit0.usdValue + token0Value
        })

        // Token 1 - use dynamic decimals and price
        const token1Decimals = getTokenDecimals(tokenY)
        const token1Amount = Number(formatUnits(metrics.balances[1], token1Decimals)) * shareRatio
        
        // Get token1 price (USDC = 1, WETH = eth price)
        let token1Price = 1 // Default for USDC
        if (tokenY.toUpperCase() === 'WETH' || tokenY.toUpperCase() === 'ETH') {
          token1Price = prices?.weth || 0
        }
        const token1Value = token1Amount * token1Price
        
        const existing1 = tokenAllocations.get(tokenY) || { amount: 0, usdValue: 0 }
        tokenAllocations.set(tokenY, {
          amount: existing1.amount + token1Amount,
          usdValue: existing1.usdValue + token1Value
        })

        // Track deposited token1
        const existingDeposit1 = depositedAmounts.get(tokenY) || { amount: 0, usdValue: 0 }
        depositedAmounts.set(tokenY, {
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

    // Process total earned all-time (accumulated historical rewards)
    totalEarnedAllTimeData.forEach((earnedData, index) => {
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
      if (token === 'S') color = '#00FFA3' // Bright arca-green
      else if (token === 'WS') color = '#059669' // Medium green
      else if (token === 'USDC') color = '#15803D' // Dark green
      else if (token === 'WETH' || token === 'ETH') color = '#10B981' // Emerald green
      
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
  }, [vaultMetrics, vaultConfigs, totalEarnedAllTimeData])
  const extrapolatedReward = useMemo(() => {
    // Calculate rewards based on APR and actual deposited amounts
    const totalDeposited = aggregatedData.totalBalanceUSD
    
    if (totalDeposited === 0 || avgAPY === 0) return 0
    
    // Convert APR (monthly rate) to the selected period
    const periodMultiplier = {
      hourly: 1 / (365 * 24),        // APR / hours in year
      daily: 1 / 365,                 // APR / days in year
      weekly: 1 / 52,                 // APR / weeks in year
      monthly: 1 / 12,                // APR / months in year
      yearly: 1,                      // APR as is
    }

    // Calculate: (Deposited Amount × APR × Period Factor)
    return totalDeposited * (avgAPY / 100) * periodMultiplier[rewardPeriod]
  }, [aggregatedData.totalBalanceUSD, avgAPY, rewardPeriod])
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

  const totalDailyHarvestedUSD = dailyHarvestedData.reduce((sum, data) => sum + data.dailyHarvestedUSD, 0)

  

  const activeLPs = useMemo(() => {
    return vaultMetrics.filter(metrics => 
      metrics.depositedValueUSD && metrics.depositedValueUSD > 0
    ).length
  }, [vaultMetrics])

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
      {/* Top Stats Cards - 5 Equal Width Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        {/* Total Deposits Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-white text-lg font-semibold mb-2">Total Deposits</div>
          <div className="text-arca-green text-xl font-bold">
            ${aggregatedData.totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Earned (All-Time) Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-white text-lg font-semibold mb-2">
            Total Earned
          </div>
          <div className="text-arca-green text-xl font-bold">
            ${aggregatedData.totalHarvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Rewards Dropdown Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5 relative">
          <button
            onClick={() => setShowRewardDropdown(!showRewardDropdown)}
            className="w-full text-left"
          >
            <div className="text-white text-lg font-semibold mb-2 flex items-center justify-between">
              <span className="capitalize">{rewardPeriod} Rewards</span>
              <span className="text-xs">▼</span>
            </div>
            <div className="text-arca-green text-xl font-bold">
              ${extrapolatedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </button>
          {showRewardDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-black border border-gray-700 rounded-lg shadow-lg z-50">
              {(['hourly', 'daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setRewardPeriod(period)
                    setShowRewardDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
                >
                  <span className="capitalize">{period} Rewards</span>
                  {rewardPeriod === period && <span className="text-arca-green">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rate Dropdown Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5 relative">
          <button
            onClick={() => setShowRateDropdown(!showRateDropdown)}
            className="w-full text-left"
          >
            <div className="text-white text-lg font-semibold mb-2 flex items-center justify-between">
              <span>{ratePeriod}</span>
              <span className="text-xs">▼</span>
            </div>
            <div className="text-arca-green text-xl font-bold">
              {calculatedRate.toFixed(2)}%
            </div>
          </button>
          {showRateDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-black border border-gray-700 rounded-lg shadow-lg z-50">
              {(['DPR', 'WPR', 'APR'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setRatePeriod(period)
                    setShowRateDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-left text-white hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
                >
                  <span>{period}</span>
                  {ratePeriod === period && <span className="text-arca-green">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active LPs Card */}
        <div className="bg-black border border-gray-800/60 rounded-xl p-3 md:p-5">
          <div className="text-white text-lg font-semibold mb-2">Active Positions</div>
          <div className="text-arca-green text-xl font-bold">
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


      
    </div>
  )
}
