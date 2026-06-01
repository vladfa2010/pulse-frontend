import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SentimentTooltipProps {
  reasoning: string;
  score: number;
  children: React.ReactNode;
}

export function SentimentTooltip({ reasoning, score, children }: SentimentTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isTouchDevice = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine touch device once on mount
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const showTooltip = useCallback(() => {
    if (isTouchDevice.current) return; // Desktop only
    // 150ms delay to prevent flicker on fast mouse passes
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 150);
  }, []);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Desktop: mouse enter/leave
  const handleMouseEnter = useCallback(() => {
    showTooltip();
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  // Mobile: toggle on tap
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isTouchDevice.current) return; // Mobile only
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(prev => !prev);
  }, []);

  // Desktop: close on Escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Close tooltip when clicking/tapping outside
  useEffect(() => {
    if (!isVisible) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sentiment-tooltip')) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isVisible]);

  const paragraphs = reasoning.split('\n\n');

  return (
    <div
      className="sentiment-tooltip relative inline-flex items-center cursor-help"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && reasoning && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-80">
          <div className="bg-[#1a1d29] border border-[rgba(255,255,255,0.1)] rounded-xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">
                Investment Analysis
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: score > 0 ? 'rgba(52,211,153,0.15)' : score < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)',
                  color: score > 0 ? '#34D399' : score < 0 ? '#EF4444' : '#9CA3AF',
                }}
              >
                {score > 0 ? '+' : ''}{score}
              </span>
            </div>
            <div className="space-y-2">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[13px] text-[#D1D5DB] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="w-2 h-2 bg-[#1a1d29] border-r border-b border-[rgba(255,255,255,0.1)] rotate-45" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
