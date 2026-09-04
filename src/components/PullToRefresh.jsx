import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children, className = '' }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const threshold = 80;

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current) return;
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    // Apply damping
    const damped = distance > threshold ? threshold + (distance - threshold) * 0.3 : distance;
    setPullDistance(damped);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(0);
      await onRefresh();
      setRefreshing(false);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
        style={{ height: `${Math.min(pullDistance, 60)}px`, opacity: Math.min(pullDistance / threshold, 1) }}
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <RefreshCw
            className="w-5 h-5 text-muted-foreground transition-transform"
            style={{ transform: `rotate(${Math.min(pullDistance / threshold * 180, 180)}deg)` }}
          />
        )}
      </div>
      {children}
    </div>
  );
}