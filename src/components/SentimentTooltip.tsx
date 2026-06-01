import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface SentimentTooltipProps {
  reasoning: string;
  score: number;
  children: React.ReactNode;
}

export function SentimentTooltip({ reasoning, score, children }: SentimentTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const isTouchDevice = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Determine touch device once on mount
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches;
  }, []);

  // Calculate tooltip position based on trigger element
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 320; // w-80 = 20rem = 320px
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    const top = rect.top - 12; // 12px gap above trigger

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    setTooltipPos({ top, left });
  }, []);

  const showTooltip = useCallback(() => {
    if (isTouchDevice.current) return;
    updatePosition();
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 150);
  }, [updatePosition]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Update position on scroll/resize while visible
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isVisible, updatePosition]);

  // Desktop: mouse enter/leave
  const handleMouseEnter = useCallback(() => {
    showTooltip();
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  // Mobile: toggle on tap
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!isTouchDevice.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (!isVisible) updatePosition();
    setIsVisible(prev => !prev);
  }, [isVisible, updatePosition]);

  // Desktop: close on Escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisible(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Close tooltip when clicking/tapping outside
  useEffect(() => {
    if (!isVisible) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sentiment-tooltip') && !target.closest('.sentiment-tooltip-popup')) {
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

  // Arrow color based on score
  const scoreColor = score > 0 ? '#34D399' : score < 0 ? '#EF4444' : '#9CA3AF';

  return (
    <>
      <div
        ref={triggerRef}
        className="sentiment-tooltip relative inline-flex items-center cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>

      {isVisible && reasoning && createPortal(
        <div
          ref={tooltipRef}
          className="sentiment-tooltip-popup fixed z-[9999] w-80 pointer-events-none"
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="bg-[#1a1d29] border border-[rgba(255,255,255,0.1)] rounded-xl p-4 shadow-2xl pointer-events-auto">
            {/* Header: label + score */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">
                Investment Analysis
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: score > 0 ? 'rgba(52,211,153,0.15)' : score < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)',
                  color: scoreColor,
                }}
              >
                {score > 0 ? '+' : ''}{score}
              </span>
            </div>

            {/* Paragraphs */}
            <div className="space-y-2">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[13px] text-[#D1D5DB] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* Arrow pointer */}
          <div className="flex justify-center">
            <div
              className="w-2.5 h-2.5 rotate-45 -mt-1.5 border-r border-b"
              style={{
                backgroundColor: '#1a1d29',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
