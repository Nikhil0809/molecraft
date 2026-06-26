"use client";

import styles from "./CanvasGrid.module.css";

interface CanvasGridProps {
  scale: number;
}

export function CanvasGrid({ scale }: CanvasGridProps) {
  const gridSize = 40 * scale;
  const dotSize = Math.max(1, Math.min(2, 2 * scale));

  return (
    <div className={styles.grid}>
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <defs>
          <pattern
            id="canvasGrid"
            x="0"
            y="0"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={gridSize / 2}
              cy={gridSize / 2}
              r={dotSize}
              fill="rgba(255,255,255,0.04)"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#canvasGrid)" />
      </svg>
    </div>
  );
}
