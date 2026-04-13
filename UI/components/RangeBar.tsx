'use client';

import { type VaultPositionData } from '@/hooks/useVaultPositionData';

interface RangeBarProps {
  position: VaultPositionData;
  activePercentage?: number;
  /** compact = thinner bar, no text labels (used in table) */
  compact?: boolean;
  tokenY?: string;
}

function formatPrice(price: number | null, tokenY: string): string {
  if (price === null) return '';
  if (price >= 1000)  return `$${price.toFixed(0)}`;
  if (price >= 1)     return `$${price.toFixed(2)}`;
  if (price >= 0.01)  return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export function RangeBar({ position, activePercentage, compact = false, tokenY = 'USDC' }: RangeBarProps) {
  const { rangeStart, rangeEnd, pricePosition, inRange, lowerPrice, upperPrice, currentPrice, hasData } = position;

  return (
    <div className="w-full">
      {/* Header row — hidden in compact mode */}
      {!compact && (
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-1.5">
            {!inRange && hasData && (
              <span className="text-[9px] text-red-400 font-medium uppercase tracking-wide">Out of range</span>
            )}
          </div>
          {activePercentage !== undefined && activePercentage > 0 && (
            <span className="text-gray-500 text-[10px]">{activePercentage.toFixed(0)}% active</span>
          )}
        </div>
      )}

      {/* Bar */}
      <div className="h-3 bg-gray-800/60 rounded-full overflow-visible relative">
        {/* Green range section */}
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-arca-green/70 via-arca-green/50 to-arca-green/70"
          style={{
            left:  `${rangeStart}%`,
            width: `${rangeEnd - rangeStart}%`,
          }}
        />
        {/* Red price line */}
        {hasData && (
          <div
            className="absolute top-[-1px] bottom-[-1px] w-[3px] rounded-full bg-red-400"
            style={{
              left: `${pricePosition}%`,
              transform: 'translateX(-50%)',
              boxShadow: '0 0 6px rgba(248,113,113,0.9)',
            }}
          />
        )}
      </div>

      {/* Price labels — hidden in compact mode */}
      {!compact && hasData && lowerPrice !== null && upperPrice !== null && (
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-gray-600 font-mono">
            {formatPrice(lowerPrice, tokenY)}
          </span>
          {currentPrice !== null && !inRange && (
            <span className="text-[9px] text-red-400/70 font-mono">
              {formatPrice(currentPrice, tokenY)}
            </span>
          )}
          <span className="text-[9px] text-gray-600 font-mono">
            {formatPrice(upperPrice, tokenY)}
          </span>
        </div>
      )}
    </div>
  );
}
