"use client";

import { useEffect, useState } from "react";
import styles from "./CursorGhost.module.css";

interface CursorGhostProps {
  userName: string;
  color: string;
  x: number;
  y: number;
  label?: string;
}

export function CursorGhost({ userName, color, x, y, label }: CursorGhostProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={styles.ghost}
      style={{
        left: x,
        top: y,
        "--ghost-color": color,
      } as React.CSSProperties}
    >
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className={styles.cursor}>
        <path d="M2 2L13 13L8.5 13.5L6 18L5 12L2 2Z" fill={color} opacity="0.8" />
      </svg>
      <div className={styles.label} style={{ backgroundColor: color }}>
        {userName}
        {label && <span className={styles.action}>{label}</span>}
      </div>
    </div>
  );
}
