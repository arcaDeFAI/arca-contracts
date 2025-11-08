'use client';

import { useState } from 'react';
import { getAPYCalculationExplanation } from '@/hooks/useShadowAPYAdjusted';

interface APYTooltipProps {
  className?: string;
}

/**
 * Tooltip component that explains how APY is calculated for Shadow vaults
 */
export function APYTooltip({ className = '' }: APYTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const explanation = getAPYCalculationExplanation();

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className="w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold flex items-center justify-center transition-colors cursor-help"
        aria-label="APY calculation explanation"
        role="button"
        tabIndex={0}
      >
        ?
      </div>
      
      {showTooltip && (
        <div className="absolute z-[9999] w-[420px] p-5 bg-black border-2 border-arca-green rounded-lg shadow-[0_0_30px_rgba(0,255,163,0.3)] text-left left-full top-1/2 transform -translate-y-1/2 ml-3 max-w-[95vw]">
          <div className="text-white text-sm whitespace-pre-line leading-relaxed">
            {explanation}
          </div>
          {/* Arrow pointing left */}
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-px">
            <div className="border-8 border-transparent border-r-arca-green"></div>
          </div>
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-0.5">
            <div className="border-[7px] border-transparent border-r-black"></div>
          </div>
        </div>
      )}
    </div>
  );
}
