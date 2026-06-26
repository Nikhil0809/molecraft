"use client";

import { useCallback, useState } from "react";
import { usePanZoom } from "@/hooks/usePanZoom";
import { CanvasGrid } from "./CanvasGrid";
import styles from "./InfiniteCanvas.module.css";

interface InfiniteCanvasProps {
  children?: React.ReactNode;
  className?: string;
  onCanvasClick?: () => void;
  overlay?: React.ReactNode;
}

export function InfiniteCanvas({ children, className, onCanvasClick, overlay }: InfiniteCanvasProps) {
  const {
    viewport,
    containerRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetView,
  } = usePanZoom(1, 0, 0);

  const [showMinimap, setShowMinimap] = useState(false);

  const handleCanvasClick = useCallback(() => {
    onCanvasClick?.();
  }, [onCanvasClick]);

  return (
    <div className={`${styles.canvasContainer} ${className || ""}`}>
      <div
        ref={containerRef}
        className={styles.viewport}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <CanvasGrid scale={viewport.scale} />

        <div
          className={styles.world}
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>

      {overlay}

      <div className={styles.hud}>
        <button className={styles.hudBtn} onClick={resetView} title="Reset view">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V1M8 15V13M3 8H1M15 8H13M5.05 5.05L3.64 3.64M12.36 12.36L10.95 10.95M12.36 3.64L10.95 5.05M3.64 12.36L5.05 10.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className={styles.hudBtn} onClick={() => setShowMinimap(!showMinimap)} title="Toggle minimap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
          </svg>
        </button>
        <div className={styles.zoomLevel}>
          {Math.round(viewport.scale * 100)}%
        </div>
      </div>

      {showMinimap && (
        <div className={styles.minimap}>
          <div className={styles.minimapContent}>
            <div className={styles.minimapViewport} />
          </div>
        </div>
      )}
    </div>
  );
}
