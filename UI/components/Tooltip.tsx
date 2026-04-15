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

export function Tooltip({ text, width = 'sm', position: positionProp = 'top', className = '', ariaLabel = 'Information' }: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const widthClass = {
    sm: 'w-[200px]',
    md: 'w-[280px]',
    lg: 'w-[460px]',
  }[width];

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();

      if (positionProp === 'right') {
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 10,
        });
      } else {
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
          className="w-4 h-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-arca-text-tertiary hover:text-arca-text-secondary text-[10px] font-semibold flex items-center justify-center transition-all duration-200 cursor-help"
          aria-label={ariaLabel}
          role="button"
          tabIndex={0}
        >
          ?
        </div>
      </div>

      {showTooltip && typeof window !== 'undefined' && createPortal(
        <div
          className={`fixed z-[9999] ${widthClass} p-3 bg-arca-gray border border-white/[0.08] rounded-xl shadow-elevated text-left animate-fade-in`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: positionProp === 'right' ? 'translate(0, -50%)' : 'translate(-50%, -100%)',
          }}
        >
          <div className="text-arca-text-secondary text-xs whitespace-pre-line leading-relaxed">
            {text}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
