"use client";

import styles from "./SourcePill.module.css";

export type SourceStatus = "idle" | "searching" | "done" | "empty" | "error";

interface SourcePillProps {
  name: string;
  status: SourceStatus;
  tier?: 1 | 2 | 3;
  resultCount?: number;
  message?: string;
}

export function SourcePill({ name, status, tier, resultCount, message }: SourcePillProps) {
  const statusIcon = {
    idle: "○",
    searching: "◌",
    done: "●",
    empty: "◇",
    error: "✕",
  };

  const tierLabel = tier === 3 ? " (web)" : "";
  const countLabel = status === "done" && resultCount !== undefined ? ` · ${resultCount}` : "";
  const tooltipText =
    message ||
    (status === "empty" ? `No results from ${name}` : `${name}: ${status}`);

  return (
    <div
      className={`${styles.pill} ${styles[status]}`}
      title={tooltipText}
      role="status"
      aria-label={`${name} ${status}${countLabel ? `, ${resultCount} results` : ""}`}
    >
      <span className={styles.dot}>{statusIcon[status]}</span>
      <span className={styles.name}>{name}{tierLabel}</span>
      {countLabel && <span className={styles.count}>{resultCount}</span>}
    </div>
  );
}
