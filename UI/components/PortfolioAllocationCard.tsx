'use client'

import { useMemo, useState } from 'react'

interface TokenAllocation {
  token: string
  amount: number
  usdValue: number
  percentage: number
  color: string
}

interface DepositedAmount {
  token: string
  amount: number
  usdValue: number
}

interface PortfolioAllocationCardProps {
  allocations: TokenAllocation[]
  totalValueUSD: number
  deposited?: DepositedAmount[]
  isCollapsible?: boolean
  isExpanded?: boolean
  onToggle?: () => void
}

export function PortfolioAllocationCard({
  allocations,
  totalValueUSD,
  deposited,
  isCollapsible = false,
  isExpanded: controlledIsExpanded,
  onToggle
}: PortfolioAllocationCardProps) {
  const [hoveredToken, setHoveredToken] = useState<string | null>(null)
  const [internalIsExpanded, setInternalIsExpanded] = useState(true)

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded
  const handleToggle = onToggle || (() => setInternalIsExpanded(!internalIsExpanded))

  // Calculate pie chart segments
  const pieSegments = useMemo(() => {
    let currentAngle = -90 // Start at top

    return allocations.map((allocation) => {
      const sweepAngle = (allocation.percentage / 100) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + sweepAngle

      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180
      const endRad = (endAngle * Math.PI) / 180

      // Calculate arc path
      const radius = 80
      const centerX = 100
      const centerY = 100

      const x1 = centerX + radius * Math.cos(startRad)
      const y1 = centerY + radius * Math.sin(startRad)
      const x2 = centerX + radius * Math.cos(endRad)
      const y2 = centerY + radius * Math.sin(endRad)

      const largeArcFlag = sweepAngle > 180 ? 1 : 0

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')

      currentAngle = endAngle

      return {
        ...allocation,
        pathData,
        startAngle,
        endAngle
      }
    })
  }, [allocations])

  if (allocations.length === 0) {
    return (
      <div className="bg-arca-gray border border-gray-800/60 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Capital Allocation</h3>
        <div className="text-center text-gray-400 py-8">
          No positions yet
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-arca-gray border border-gray-800/60 rounded-xl transition-all h-full ${isExpanded ? 'p-5' : 'p-3'}`}>
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-6' : 'mb-0'}`}>
        {isCollapsible ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="hover:opacity-80 transition-opacity p-1 -ml-1"
            >
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-white">Capital Allocation</h3>
          </div>
        ) : (
          <h3 className="text-lg font-semibold text-white">Capital Allocation</h3>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Pie Chart */}
          <div className="flex-shrink-0 w-40 h-40 sm:w-48 sm:h-48 lg:w-52 lg:h-52">
            <svg width="100%" height="100%" viewBox="0 0 200 200" className="drop-shadow-lg">
              {/* Inner circle (donut hole) - Match bg-arca-gray (#1a1a1a) */}
              <circle cx="100" cy="100" r="50" fill="#1a1a1a" />

              {/* Pie segments */}
              {pieSegments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.pathData}
                  fill={segment.color}
                  stroke="#1a1a1a"
                  strokeWidth="2"
                  className="transition-all cursor-pointer"
                  style={{
                    opacity: hoveredToken === null || hoveredToken === segment.token ? 1 : 0.4
                  }}
                  onMouseEnter={() => setHoveredToken(segment.token)}
                  onMouseLeave={() => setHoveredToken(null)}
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-3 w-full">
            {allocations.map((allocation, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-arca-dark/30 rounded-lg border transition-all cursor-pointer"
                style={{
                  borderColor: hoveredToken === allocation.token ? allocation.color : 'rgba(55, 65, 81, 0.3)',
                  backgroundColor: hoveredToken === allocation.token ? `${allocation.color}15` : 'rgba(0, 0, 0, 0.3)',
                  transform: hoveredToken === allocation.token ? 'scale(1.02)' : 'scale(1)'
                }}
                onMouseEnter={() => setHoveredToken(allocation.token)}
                onMouseLeave={() => setHoveredToken(null)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: allocation.color }}
                  />
                  <div>
                    <div className="text-white font-medium text-sm">{allocation.token}</div>
                    <div className="text-gray-400 text-xs">
                      {allocation.amount.toFixed(4)} tokens
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold text-sm">
                    {allocation.percentage.toFixed(1)}%
                  </div>
                  <div className="text-gray-400 text-xs">
                    ${allocation.usdValue.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
