import { ReactNode, TouchEvent, useRef, useState } from 'react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => void;
  threshold?: number;
}

export function PullToRefresh({
  children,
  onRefresh = () => window.location.reload(),
  threshold = 70,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);

  function handleTouchStart(e: TouchEvent) {
    startYRef.current = window.scrollY === 0 ? e.touches[0].clientY : null;
  }

  function handleTouchMove(e: TouchEvent) {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, threshold * 1.5));
    }
  }

  function handleTouchEnd() {
    if (pullDistance >= threshold) {
      onRefresh();
    }
    setPullDistance(0);
    startYRef.current = null;
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {pullDistance > 0 && (
        <div
          className="pull-to-refresh__indicator"
          style={{ opacity: Math.min(pullDistance / threshold, 1) }}
        >
          {pullDistance >= threshold ? '⬆️ 놓으면 새로고침' : '⬇️ 당겨서 새로고침'}
        </div>
      )}
      {children}
    </div>
  );
}
