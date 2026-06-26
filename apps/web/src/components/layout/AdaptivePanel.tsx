"use client";

import styles from "./AdaptivePanel.module.css";

interface AdaptivePanelProps {
  title: string;
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  position?: "left" | "right";
  width?: number;
}

export function AdaptivePanel({
  title,
  visible,
  onClose,
  children,
  position = "right",
  width = 320,
}: AdaptivePanelProps) {
  if (!visible) return null;

  return (
    <div
      className={`${styles.panel} ${position === "left" ? styles.left : styles.right}`}
      style={{ width, "--panel-width": `${width}px` } as React.CSSProperties}
    >
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {onClose && (
          <button className={styles.close} onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
