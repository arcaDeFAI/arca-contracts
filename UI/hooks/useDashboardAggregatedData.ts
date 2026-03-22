import { useMemo } from 'react'
import { formatUnits } from 'viem'
import { getToken, getTokenByAddress } from '@/lib/tokenRegistry'
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
    allocations: Array<{ token: string; amount: number; usdValue: number; percentage: number; color: string }>
    deposited: Array<{ token: string; amount: number; usdValue: number }>
    metroRewards: Array<{ token: string; amount: number; usdValue: number; logo?: string }>
    shadowRewards: Array<{ token: string; amount: number; usdValue: number; logo?: string }>
    isLoading: boolean
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
        [key: string]: number
    }
    pendingRewards?: Array<{ token: string; pendingRewards: bigint }>
    isLoading?: boolean
}

interface TotalHarvestedData {
    totalHarvestedUSD: number
    firstHarvestTimestamp: number | null
    isLoading?: boolean
}

export function useDashboardAggregatedData(
    vaultMetrics: (VaultMetric | Record<string, unknown>)[],
    vaultConfigs: VaultConfig[],
    totalHarvestedData: TotalHarvestedData[],
    prices: Record<string, number> | undefined
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

        vaultMetrics.forEach((metrics: any, index: number) => {
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

                // Group by canonical name for aggregation (S and WS → 'S / wS')
                const getAllocKey = (name: string) => {
                    const canonical = getToken(name)?.canonicalName;
                    return canonical === 'SONIC' ? 'S / wS' : name;
                };
                const keyX = getAllocKey(tokenX);
                const keyY = getAllocKey(tokenY);

                // Token 0 - use dynamic decimals and price
                const token0Decimals = getTokenDecimals(tokenX)
                const token0Amount = Number(formatUnits(metrics.balances[0], token0Decimals)) * shareRatio

                // Get token0 price using centralized utility
                const token0Price = getTokenPrice(tokenX, metrics.prices, metrics.sonicPrice)
                const token0Value = token0Amount * token0Price

                const existing0 = tokenAllocations.get(keyX) || { amount: 0, usdValue: 0 }
                tokenAllocations.set(keyX, {
                    amount: existing0.amount + token0Amount,
                    usdValue: existing0.usdValue + token0Value
                })

                // Track deposited amounts
                const existingDeposit0 = depositedAmounts.get(keyX) || { amount: 0, usdValue: 0 }
                depositedAmounts.set(keyX, {
                    amount: existingDeposit0.amount + token0Amount,
                    usdValue: existingDeposit0.usdValue + token0Value
                })

                // Token 1
                const token1Decimals = getTokenDecimals(tokenY)
                const token1Amount = Number(formatUnits(metrics.balances[1], token1Decimals)) * shareRatio

                // Get token1 price using centralized utility
                const token1Price = getTokenPrice(tokenY, prices)
                const token1Value = token1Amount * token1Price

                const existing1 = tokenAllocations.get(keyY) || { amount: 0, usdValue: 0 }
                tokenAllocations.set(keyY, {
                    amount: existing1.amount + token1Amount,
                    usdValue: existing1.usdValue + token1Value
                })

                // Track deposited token1
                const existingDeposit1 = depositedAmounts.get(keyY) || { amount: 0, usdValue: 0 }
                depositedAmounts.set(keyY, {
                    amount: existingDeposit1.amount + token1Amount,
                    usdValue: existingDeposit1.usdValue + token1Value
                })
            }

            // Process pending rewards
            if (metrics.pendingRewards) {
                const rewards = metrics.pendingRewards

                rewards.forEach((reward: { token: string; pendingRewards: bigint }) => {
                    const tokenAddress = reward.token.toLowerCase()
                    const amount = Number(formatUnits(reward.pendingRewards, 18))

                    // Look up reward token via registry
                    const tokenDef = getTokenByAddress(tokenAddress)
                    const tokenName = tokenDef?.displayName ?? 'Unknown'
                    const priceKey = tokenDef?.canonicalName.toLowerCase()
                    const tokenPrice = priceKey && metrics.prices ? (metrics.prices[priceKey] || 0) : 0
                    const logo = tokenDef?.logo

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

            // Get chart color from registry (use first word as token key for grouped keys like 'S / wS')
            const tokenKey = token.split(' ')[0]; // 'S / wS' → 'S'
            const color = getToken(tokenKey)?.chartColor ?? '#6B7280';

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

        const isAnyVaultLoading = vaultMetrics.some((m: any) => m.isLoading);
        const isAnyHarvestLoading = totalHarvestedData.some(h => h.isLoading);
        const isLoading = isAnyVaultLoading || isAnyHarvestLoading;

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
            shadowRewards,
            isLoading
        }
    }, [vaultMetrics, vaultConfigs, totalHarvestedData, prices])
}
