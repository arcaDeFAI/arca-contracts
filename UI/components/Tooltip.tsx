'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  width?: 'sm' | 'md' | 'lg';
  position?: 'top' | 'right';
  className?: string;
  ariaLabel?: string;
}

/**
 * Unified tooltip component with question mark icon
 * Renders using portal to avoid clipping by parent containers
 */
export function Tooltip({ text, width = 'sm', position: positionProp = 'top', className = '', ariaLabel = 'Information' }: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  // Width classes
  const widthClass = {
    sm: 'w-[200px]',
    md: 'w-[280px]',
    lg: 'w-[460px]',
  }[width];

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      
      if (positionProp === 'right') {
        // Position to the right of the icon
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 10,
        });
      } else {
        // Position above the icon (default)
        setPosition({
          top: rect.top - 10,
          left: rect.left + rect.width / 2,
        });
      }
    }
  }, [showTooltip, positionProp]);

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <div
          ref={iconRef}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
          className="w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold flex items-center justify-center transition-colors cursor-help"
          aria-label={ariaLabel}
          role="button"
          tabIndex={0}
        >
          ?
        </div>
      </div>
      
      {showTooltip && typeof window !== 'undefined' && createPortal(
        <div 
          className={`fixed z-[9999] ${widthClass} p-2.5 bg-black border-2 border-arca-green rounded-lg shadow-[0_0_30px_rgba(0,255,163,0.3)] text-left`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: positionProp === 'right' ? 'translate(0, -50%)' : 'translate(-50%, -100%)',
          }}
        >
          <div className="text-white text-xs whitespace-pre-line leading-relaxed">
            {text}
          </div>
          {/* Arrow */}
          {positionProp === 'right' ? (
            <>
              {/* Arrow pointing left */}
              <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-px">
                <div className="border-8 border-transparent border-r-arca-green"></div>
              </div>
              <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-0.5">
                <div className="border-[7px] border-transparent border-r-black"></div>
              </div>
            </>
          ) : (
            <>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                <div className="border-8 border-transparent border-t-arca-green"></div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0.5">
                <div className="border-[7px] border-transparent border-t-black"></div>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
