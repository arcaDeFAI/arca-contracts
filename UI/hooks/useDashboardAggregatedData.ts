import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { getTokenDecimals, getTokenPrice } from '@/lib/tokenHelpers'
import type { VaultConfig } from '@/lib/vaultConfigs'

export interface AggregatedData {
    totalBalanceUSD: number
    totalRewardsUSD: number
    totalMetroRewardsUSD: number
    totalShadowRewardsUSD: number
    totalClaimableUSD: number
    totalHarvestedUSD: number
    totalHarvestedMetroUSD: number
    totalHarvestedShadowUSD: number
    earliestFirstDeposit: number | null
}

// Minimal types for the inputs we need
interface VaultMetric {
    depositedValueUSD?: number
    balances?: [bigint, bigint]
    userShares?: bigint
    totalSupply?: bigint
    sonicPrice?: number
    prices?: {
        metro: number
        shadow: number
        xShadow: number
        weth: number
    }
    pendingRewards?: any[] // Using any for the struct to avoid deep import issues
}



interface TotalHarvestedData {
    totalHarvestedUSD: number
    firstHarvestTimestamp: number | null
}

export function useDashboardAggregatedData(
    vaultMetrics: (VaultMetric | any)[], // Flexible typing
    vaultConfigs: VaultConfig[],
    totalHarvestedData: TotalHarvestedData[],
    prices: any
) {
    return useMemo(() => {
        let totalBalanceUSD = 0
        let totalMetroRewardsUSD = 0
        let totalShadowRewardsUSD = 0
        let totalClaimableUSD = 0
        let totalHarvestedMetroUSD = 0
        let totalHarvestedShadowUSD = 0
        let earliestTimestamp: number | null = null

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

            // Calculate token allocations from strategy balance * user's share %
            if (metrics.balances && metrics.userShares && metrics.totalSupply && metrics.totalSupply > 0n) {
                const shareRatio = Number(metrics.userShares) / Number(metrics.totalSupply)

                // Get token names from config
                const tokenX = config.tokenX || 'S'
                const tokenY = config.tokenY || 'USDC'

                // Token 0 - use dynamic decimals and price
                const token0Decimals = getTokenDecimals(tokenX)
                const token0Amount = Number(formatUnits(metrics.balances[0], token0Decimals)) * shareRatio

                // Get token0 price using centralized utility
                const token0Price = getTokenPrice(tokenX, metrics.prices, metrics.sonicPrice)
                const token0Value = token0Amount * token0Price

                const existing0 = tokenAllocations.get(tokenX) || { amount: 0, usdValue: 0 }
                tokenAllocations.set(tokenX, {
                    amount: existing0.amount + token0Amount,
                    usdValue: existing0.usdValue + token0Value
                })

                // Track deposited amounts
                const existingDeposit0 = depositedAmounts.get(tokenX) || { amount: 0, usdValue: 0 }
                depositedAmounts.set(tokenX, {
                    amount: existingDeposit0.amount + token0Amount,
                    usdValue: existingDeposit0.usdValue + token0Value
                })

                // Token 1
                const token1Decimals = getTokenDecimals(tokenY)
                const token1Amount = Number(formatUnits(metrics.balances[1], token1Decimals)) * shareRatio

                // Get token1 price using centralized utility
                const token1Price = getTokenPrice(tokenY, prices)
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
                // We assume pendingRewards is an array of objects compliant with the ABI output
                const rewards = metrics.pendingRewards

                rewards.forEach((reward: any) => {
                    const tokenAddress = reward.token.toLowerCase()
                    const amount = Number(formatUnits(reward.pendingRewards, 18))

                    let tokenName = 'Unknown'
                    let tokenPrice = 0
                    let logo: string | undefined = undefined

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

        // Process total harvested rewards (user-specific)
        totalHarvestedData.forEach((harvestData, index) => {
            const config = vaultConfigs[index]
            const isShadowVault = config.name.includes('Shadow')

            if (isShadowVault) {
                totalHarvestedShadowUSD += harvestData.totalHarvestedUSD
            } else {
                totalHarvestedMetroUSD += harvestData.totalHarvestedUSD
            }

            if (harvestData.firstHarvestTimestamp) {
                if (earliestTimestamp === null || harvestData.firstHarvestTimestamp < earliestTimestamp) {
                    earliestTimestamp = harvestData.firstHarvestTimestamp
                }
            }
        })

        // Convert token allocations to array with percentages
        const allocations = Array.from(tokenAllocations.entries()).map(([token, data]) => {
            const percentage = totalBalanceUSD > 0 ? (data.usdValue / totalBalanceUSD) * 100 : 0

            // Assign colors based on token
            let color = '#6B7280' // gray fallback
            if (token === 'S') color = '#00FFA3'
            else if (token === 'WS') color = '#059669'
            else if (token === 'USDC') color = '#15803D'
            else if (token === 'WETH' || token === 'ETH') color = '#10B981'

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
            earliestFirstDeposit: earliestTimestamp,
            allocations,
            deposited,
            metroRewards,
            shadowRewards
        }
    }, [vaultMetrics, vaultConfigs, totalHarvestedData, prices])
}
