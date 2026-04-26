'use client';

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
  isCollapsible = false,
  isExpanded: controlledIsExpanded,
  onToggle
}: PortfolioAllocationCardProps) {
  const [hoveredToken, setHoveredToken] = useState<string | null>(null)
  const [internalIsExpanded, setInternalIsExpanded] = useState(true)

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded
  const handleToggle = onToggle || (() => setInternalIsExpanded(!internalIsExpanded))

  const pieSegments = useMemo(() => {
    let currentAngle = -90

    return allocations.map((allocation) => {
      const sweepAngle = (allocation.percentage / 100) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + sweepAngle

      const startRad = (startAngle * Math.PI) / 180
      const endRad = (endAngle * Math.PI) / 180

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
      <div className="bg-arca-gray/80 border border-white/[0.04] rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-arca-text mb-4">Capital Allocation</h3>
        <div className="text-center text-arca-text-tertiary py-8 text-sm">
          No positions yet
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-arca-gray/80 border border-white/[0.04] rounded-2xl shadow-card transition-all h-full ${isExpanded ? 'p-5' : 'p-4'}`}>
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-5' : 'mb-0'}`}>
        {isCollapsible ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="hover:opacity-80 transition-opacity p-0.5 -ml-0.5"
            >
              <svg
                className={`w-4 h-4 text-arca-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-semibold text-arca-text">Capital Allocation</h3>
          </div>
        ) : (
          <h3 className="text-sm font-semibold text-arca-text">Capital Allocation</h3>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Pie Chart */}
          <div className="flex-shrink-0 w-36 h-36 sm:w-44 sm:h-44">
            <svg width="100%" height="100%" viewBox="0 0 200 200">
              {pieSegments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.pathData}
                  fill={segment.color}
                  stroke="#12161e"
                  strokeWidth="2"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: hoveredToken === null || hoveredToken === segment.token ? 1 : 0.35,
                    filter: hoveredToken === segment.token ? 'brightness(1.2)' : 'none'
                  }}
                  onMouseEnter={() => setHoveredToken(segment.token)}
                  onMouseLeave={() => setHoveredToken(null)}
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2 w-full">
            {allocations.map((allocation, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer border border-transparent"
                style={{
                  borderColor: hoveredToken === allocation.token ? `${allocation.color}40` : 'transparent',
                  backgroundColor: hoveredToken === allocation.token ? `${allocation.color}08` : 'transparent',
                }}
                onMouseEnter={() => setHoveredToken(allocation.token)}
                onMouseLeave={() => setHoveredToken(null)}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: allocation.color }}
                  />
                  <div>
                    <div className="text-arca-text font-medium text-sm">{allocation.token}</div>
                    <div className="text-arca-text-tertiary text-xs">
                      {allocation.amount.toFixed(4)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-arca-text font-medium text-sm">
                    {allocation.percentage.toFixed(1)}%
                  </div>
                  <div className="text-arca-text-tertiary text-xs">
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
