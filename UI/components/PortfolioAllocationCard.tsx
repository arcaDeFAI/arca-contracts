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
    <div className={`t-resize bg-arca-gray/80 border border-white/[0.04] rounded-2xl shadow-card transition-all duration-300 ${isExpanded ? 'h-[286px] p-5' : 'h-[72px] p-4 md:h-[84px]'}`}>
      <div className={`flex items-center justify-between transition-all duration-300 ${isExpanded ? 'mb-5' : 'mb-0'}`}>
        {isCollapsible ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="hover:opacity-80 transition-opacity p-0.5 -ml-0.5"
            >
              <svg
                className={`w-4 h-4 text-arca-text-tertiary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
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

      <div className="overflow-hidden">
        <div className="t-panel-slide min-h-0" data-open={isExpanded ? 'true' : 'false'}>
          <div className="flex flex-row items-center gap-3 sm:gap-4 lg:flex-row">
          {/* Pie Chart */}
          <div className="h-24 w-24 flex-shrink-0 sm:h-32 sm:w-32 lg:h-36 lg:w-36">
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
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1 w-full">
            {allocations.map((allocation, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 rounded-xl border border-transparent px-1 py-1 transition-all duration-200 cursor-pointer sm:px-2 sm:py-1.5"
                style={{
                  borderColor: hoveredToken === allocation.token ? `${allocation.color}40` : 'transparent',
                  backgroundColor: hoveredToken === allocation.token ? `${allocation.color}08` : 'transparent',
                }}
                onMouseEnter={() => setHoveredToken(allocation.token)}
                onMouseLeave={() => setHoveredToken(null)}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: allocation.color }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-arca-text sm:text-sm">{allocation.token}</div>
                    <div className="text-[10px] leading-tight text-arca-text-tertiary">
                      {allocation.amount.toFixed(4)}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-medium text-arca-text sm:text-sm">
                    {allocation.percentage.toFixed(1)}%
                  </div>
                  <div className="text-[10px] leading-tight text-arca-text-tertiary">
                    ${allocation.usdValue.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
