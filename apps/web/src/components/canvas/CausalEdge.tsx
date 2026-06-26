"use client";

import { useRef } from "react";
import styles from "./CausalEdge.module.css";

export interface CausalLink {
  sourceId: string;
  targetId: string;
  label: string;
  strength: number;
  type: "generated" | "sourced" | "similar" | "derived";
}

interface CausalEdgeProps {
  links: CausalLink[];
  nodePositions: Map<string, { x: number; y: number }>;
  viewport: { x: number; y: number; scale: number };
}

const TYPE_COLORS: Record<string, string> = {
  generated: "var(--accent-primary)",
  sourced: "var(--accent-success)",
  similar: "var(--accent-warning)",
  derived: "#8B5CF6",
};

export function CausalEdge({ links, nodePositions, viewport }: CausalEdgeProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <svg
      ref={svgRef}
      className={styles.edges}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <defs>
        {links.map((link, i) => (
          <filter key={i} id={`glow-${i}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      {links.map((link, i) => {
        const source = nodePositions.get(link.sourceId);
        const target = nodePositions.get(link.targetId);
        if (!source || !target) return null;

        const sx = source.x * viewport.scale + viewport.x;
        const sy = source.y * viewport.scale + viewport.y;
        const tx = target.x * viewport.scale + viewport.x;
        const ty = target.y * viewport.scale + viewport.y;

        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const controlOffset = Math.max(40, dist * 0.25);

        const cx1 = sx + dx * 0.25;
        const cy1 = sy + dy * 0.25 - controlOffset;
        const cx2 = sx + dx * 0.75;
        const cy2 = sy + dy * 0.75 + controlOffset;

        const midX = (sx + tx) / 2;
        const midY = (sy + ty) / 2 - 14;

        const color = TYPE_COLORS[link.type] || "var(--text-secondary)";
        const opacity = 0.25 + link.strength * 0.55;

        return (
          <g key={i}>
            <path
              d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
              fill="none"
              stroke={color}
              strokeWidth={1.2 + link.strength * 1.5}
              opacity={opacity}
              filter={`url(#glow-${i})`}
              className={styles.bezier}
            />
            <circle r="3" fill={color} opacity={opacity}>
              <animateMotion
                dur={`${2 + (1 - link.strength) * 3}s`}
                repeatCount="indefinite"
                path={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
              />
            </circle>
            {link.label && link.strength > 0.5 && (
              <text
                x={midX}
                y={midY}
                fill={color}
                fontSize="10"
                textAnchor="middle"
                opacity={opacity * 1.5}
                fontFamily="var(--font-mono, monospace)"
              >
                {link.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
