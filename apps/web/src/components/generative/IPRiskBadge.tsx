"use client";

import styles from "./IPRiskBadge.module.css";

interface IPRiskBadgeProps {
  risk: string;
  maxSimilarity?: number;
}

const RISK_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  low: { label: "IP Clear", className: styles.low, icon: "🟢" },
  medium: { label: "IP Review", className: styles.medium, icon: "🟡" },
  high: { label: "IP Conflict", className: styles.high, icon: "🔴" },
  unknown: { label: "IP Unknown", className: styles.unknown, icon: "⚪" },
};

export function IPRiskBadge({ risk, maxSimilarity }: IPRiskBadgeProps) {
  const config = RISK_CONFIG[risk] || RISK_CONFIG.unknown;
  return (
    <span className={`${styles.badge} ${config.className}`} title={`Max patent similarity: ${maxSimilarity ?? "n/a"}`}>
      <span className={styles.icon}>{config.icon}</span>
      {config.label}
      {maxSimilarity !== undefined && (
        <span className={styles.sim}>{maxSimilarity.toFixed(2)}</span>
      )}
    </span>
  );
}