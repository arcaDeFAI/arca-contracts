'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAPYCalculationExplanation } from '@/hooks/useShadowAPYAdjusted';

interface APYTooltipProps {
  className?: string;
}

/**
 * Tooltip component that explains how APY is calculated for Shadow vaults
 */
export function APYTooltip({ className = '' }: APYTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const explanation = getAPYCalculationExplanation();

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 10, // Position above the icon
        left: rect.left + rect.width / 2, // Center horizontally
      });
    }
  }, [showTooltip]);

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <div
          ref={iconRef}
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
      </div>
      
      {showTooltip && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] w-[880px] p-2 bg-black border-2 border-arca-green rounded-lg shadow-[0_0_30px_rgba(0,255,163,0.3)] text-left"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-white text-xs whitespace-pre-line leading-relaxed">
            {explanation}
          </div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="border-8 border-transparent border-t-arca-green"></div>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5">
            <div className="border-[7px] border-transparent border-t-black"></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
