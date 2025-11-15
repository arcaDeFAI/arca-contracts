'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  timestamp: number
  value: number
}

interface BalanceHistoryCardProps {
  currentBalance: number
  change24h: number
  changePercentage: number
  historicalData?: DataPoint[]
}

export function BalanceHistoryCard({ 
  currentBalance, 
  change24h, 
  changePercentage,
  historicalData = []
}: BalanceHistoryCardProps) {
  // Generate sample data if no historical data provided
  const chartData = useMemo(() => {
    const data = []
    const now = Date.now()
    
    // Try to load historical balance snapshots
    let snapshots: Array<{ timestamp: number; balance: number }> = []
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(`balance_history_chart`)
        if (stored) {
          snapshots = JSON.parse(stored)
        }
      } catch (err) {
        console.warn('Failed to load balance history:', err)
      }
    }
    
    // If we have snapshots, use them
    if (snapshots.length > 0) {
      // Show last 30 days of data
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)
      const recentSnapshots = snapshots.filter(s => s.timestamp >= thirtyDaysAgo)
      
      recentSnapshots.forEach(snapshot => {
        const date = new Date(snapshot.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        data.push({
          date,
          value: snapshot.balance,
          timestamp: snapshot.timestamp
        })
      })
    }
    
    // Always add current balance as the latest point
    const date = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    data.push({
      date,
      value: currentBalance,
      timestamp: now
    })
    
    // If we have less than 2 points, add a starting point from today
    if (data.length < 2) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const startDate = todayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      data.unshift({
        date: startDate,
        value: currentBalance,
        timestamp: todayStart.getTime()
      })
    }
    
    return data
  }, [currentBalance])

  const isPositive = change24h >= 0

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/90 border border-arca-green/50 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-xs mb-1">{payload[0].payload.date}</p>
          <p className="text-white font-bold text-sm">
            ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-black border border-gray-800/50 rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-gray-400 text-sm mb-1">Total Balance</div>
          <div className="text-white text-3xl font-bold">
            ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Recharts Area Chart */}
      <div className="bg-gradient-to-br from-arca-green/5 to-transparent rounded-lg p-4 border border-arca-green/10 flex-1 flex flex-col">
        <div className="flex-1" style={{ minHeight: '120px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(0, 255, 163)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="rgb(0, 255, 163)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                hide
              />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgb(0, 255, 163)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="rgb(0, 255, 163)" 
                strokeWidth={2}
                fill="url(#colorBalance)" 
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs text-gray-500 text-center">
          {chartData.length <= 2 ? 'Tracking started today - Data accumulates at each rebalance' : 'Last 30 days'}
        </div>
      </div>
    </div>
  )
}
