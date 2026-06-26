"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./CanvasNode.module.css";

export type NodeType = "molecule" | "target" | "query" | "prediction" | "cluster" | "note";

export interface CanvasNodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  content?: React.ReactNode;
  metadata?: Record<string, unknown>;
}

interface CanvasNodeProps {
  node: CanvasNodeData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onConnect?: (sourceId: string, targetId: string) => void;
  scale: number;
}

export function CanvasNode({ node, isSelected, onSelect, onMove, scale }: CanvasNodeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      nodeStart.current = { x: node.x, y: node.y };
      onSelect?.(node.id);
    },
    [node.id, node.x, node.y, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStart.current.x) / scale;
      const dy = (e.clientY - dragStart.current.y) / scale;
      onMove?.(node.id, nodeStart.current.x + dx, nodeStart.current.y + dy);
    },
    [isDragging, scale, onMove, node.id]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const typeClass = styles[node.type] || styles.molecule;

  return (
    <div
      className={`${styles.node} ${typeClass} ${isSelected ? styles.selected : ""}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className={styles.header}>
        <span className={styles.typeIndicator} />
        <span className={styles.label}>{node.label}</span>
      </div>
      {node.content && <div className={styles.content}>{node.content}</div>}
    </div>
  );
}
