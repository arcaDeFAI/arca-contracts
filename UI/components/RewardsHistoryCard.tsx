'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface RewardDataPoint {
  timestamp: number
  metroValue: number
  shadowValue: number
  totalValue: number
}

interface RewardsHistoryCardProps {
  totalRewardsUSD: number
  metroRewardsUSD: number
  shadowRewardsUSD: number
  change24h: number
  changePercentage: number
  historicalData?: RewardDataPoint[]
}

export function RewardsHistoryCard({ 
  totalRewardsUSD,
  metroRewardsUSD,
  shadowRewardsUSD,
  change24h, 
  changePercentage,
  historicalData = []
}: RewardsHistoryCardProps) {
  // Generate sample data if no historical data provided
  const chartData = useMemo(() => {
    const rawData = historicalData.length > 0 ? historicalData : (() => {
      // Generate 30 days of cumulative rewards data
      const days = 30
      const points: RewardDataPoint[] = []
      const now = Date.now()
      
      for (let i = days; i >= 0; i--) {
        const timestamp = now - (i * 24 * 60 * 60 * 1000)
        const progress = 1 - (i / days)
        
        // Simulate cumulative growth (always increasing)
        const metroValue = metroRewardsUSD * progress
        const shadowValue = shadowRewardsUSD * progress
        
        points.push({
          timestamp,
          metroValue,
          shadowValue,
          totalValue: metroValue + shadowValue
        })
      }
      return points
    })()
    
    // Format for Recharts
    return rawData.map(point => ({
      date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Metro: point.metroValue,
      Shadow: point.shadowValue,
      Total: point.totalValue,
      timestamp: point.timestamp
    }))
  }, [totalRewardsUSD, metroRewardsUSD, shadowRewardsUSD, historicalData])

  const isPositive = change24h >= 0

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-blue-500/50 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-xs mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs text-gray-300">Metro:</span>
              <span className="text-xs text-white font-semibold">
                ${payload[0].payload.Metro.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-300">Shadow:</span>
              <span className="text-xs text-white font-semibold">
                ${payload[0].payload.Shadow.toFixed(2)}
              </span>
            </div>
            <div className="border-t border-gray-700 pt-1 mt-1">
              <span className="text-xs text-gray-300">Total:</span>
              <span className="text-sm text-white font-bold ml-2">
                ${payload[0].payload.Total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-black border border-gray-800/50 rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-gray-400 text-sm mb-1">Total Rewards Earned</div>
          <div className="text-white text-3xl font-bold">
            ${totalRewardsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-1">24h Change</div>
          <div className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{changePercentage.toFixed(2)}%
          </div>
          <div className={`text-xs ${isPositive ? 'text-green-400/70' : 'text-red-400/70'}`}>
            {isPositive ? '+' : ''}${change24h.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Recharts Stacked Area Chart */}
      <div className="bg-gradient-to-br from-purple-500/5 to-transparent rounded-lg p-4 border border-purple-500/10 flex-1 flex flex-col">
        <div className="flex-1" style={{ minHeight: '120px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorMetro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorShadow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(251, 191, 36)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="rgb(251, 191, 36)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgb(59, 130, 246)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area 
                type="monotone" 
                dataKey="Metro" 
                stackId="1"
                stroke="rgb(59, 130, 246)" 
                strokeWidth={2}
                fill="url(#colorMetro)" 
                animationDuration={300}
              />
              <Area 
                type="monotone" 
                dataKey="Shadow" 
                stackId="1"
                stroke="rgb(251, 191, 36)" 
                strokeWidth={2}
                fill="url(#colorShadow)" 
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-gray-400">Metro: ${metroRewardsUSD.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span className="text-gray-400">Shadow: ${shadowRewardsUSD.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          Cumulative rewards over 30 days
        </div>
      </div>
    </div>
  )
}
