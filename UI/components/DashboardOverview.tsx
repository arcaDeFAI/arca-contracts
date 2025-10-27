'use client'

import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { useVaultMetrics } from '@/hooks/useVaultMetrics'
import { useHarvestedRewards } from '@/hooks/useHarvestedRewards'
import { useBalanceHistory } from '@/hooks/useBalanceHistory'
import { use24hHarvestedRewards } from '@/hooks/use24hHarvestedRewards'
import { type UserRewardStructOutput } from '@/lib/typechain'
import { CONTRACTS } from '@/lib/contracts'
import { PortfolioAllocationCard } from './PortfolioAllocationCard'
import { BalanceHistoryCard } from './BalanceHistoryCard'
import { RewardsHistoryCard } from './RewardsHistoryCard'
import { ClaimableRewardsSummary } from './ClaimableRewardsSummary'

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

  // Fetch harvested rewards for all vaults (cumulative, doesn't reset on claim)
  const harvestedRewardsData = vaultConfigs.map(config =>
    useHarvestedRewards(config.vaultAddress, userAddress)
  )

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

  // Aggregate data from all vaults
  const aggregatedData = useMemo(() => {
    let totalBalanceUSD = 0
    let totalMetroRewardsUSD = 0
    let totalShadowRewardsUSD = 0
    let totalClaimableUSD = 0
    let totalHarvestedMetroUSD = 0
    let totalHarvestedShadowUSD = 0
    
    const tokenAllocations = new Map<string, { amount: number; usdValue: number }>()
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

        // Token 1 (USDC) - Complete strategy balance × share %
        const token1Amount = Number(formatUnits(metrics.balances[1], 6)) * shareRatio
        const token1Value = token1Amount // USDC is 1:1 with USD
        
        const existing1 = tokenAllocations.get('USDC') || { amount: 0, usdValue: 0 }
        tokenAllocations.set('USDC', {
          amount: existing1.amount + token1Amount,
          usdValue: existing1.usdValue + token1Value
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

    // Process harvested rewards (cumulative, doesn't reset on claim)
    harvestedRewardsData.forEach((harvestData, index) => {
      const config = vaultConfigs[index]
      const isShadowVault = config.name.includes('Shadow')
      const metrics = vaultMetrics[index]

      if (harvestData.harvestedRewards) {
        harvestData.harvestedRewards.forEach((reward) => {
          const tokenAddress = reward.token.toLowerCase()
          const amount = reward.totalAmount
          
          let tokenPrice = 0

          if (tokenAddress === CONTRACTS.METRO.toLowerCase()) {
            tokenPrice = metrics.prices?.metro || 0
          } else if (tokenAddress === CONTRACTS.SHADOW.toLowerCase()) {
            tokenPrice = metrics.prices?.shadow || 0
          } else if (tokenAddress === CONTRACTS.xSHADOW.toLowerCase()) {
            tokenPrice = metrics.prices?.xShadow || 0
          }

          const usdValue = amount * tokenPrice

          if (isShadowVault) {
            totalHarvestedShadowUSD += usdValue
          } else {
            totalHarvestedMetroUSD += usdValue
          }
        })
      }
    })

    // Convert token allocations to array with percentages
    const allocations = Array.from(tokenAllocations.entries()).map(([token, data]) => {
      const percentage = totalBalanceUSD > 0 ? (data.usdValue / totalBalanceUSD) * 100 : 0
      
      // Assign colors based on token
      let color = '#6B7280' // gray
      if (token === 'S') color = '#1E40AF' // dark royal blue
      else if (token === 'WS') color = '#60A5FA' // lighter blue
      else if (token === 'USDC') color = '#FBBF24' // yellow/gold
      
      return {
        token,
        amount: data.amount,
        usdValue: data.usdValue,
        percentage,
        color
      }
    }).sort((a, b) => b.percentage - a.percentage)

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
      metroRewards,
      shadowRewards
    }
  }, [vaultMetrics, vaultConfigs, harvestedRewardsData])

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

  if (!userAddress) {
    return null
  }

  return (
    <div className="space-y-6 border border-gray-800/50 rounded-xl p-6 mb-8">
      {/* Main Row: Portfolio + Claimable (left) + History Charts (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        {/* Left Column: Portfolio Allocation + Claimable Rewards */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <PortfolioAllocationCard
            allocations={aggregatedData.allocations}
            totalValueUSD={aggregatedData.totalBalanceUSD}
          />
          <ClaimableRewardsSummary
            totalClaimableUSD={aggregatedData.totalClaimableUSD}
            metroRewards={aggregatedData.metroRewards}
            shadowRewards={aggregatedData.shadowRewards}
          />
        </div>

        {/* Right Column: History Charts - Takes 2 columns */}
        <div className="lg:col-span-2 flex flex-col gap-6">
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
      </div>
    </div>
  )
}
