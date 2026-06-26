"use client";

import styles from "./RetrievalStatusStrip.module.css";
import { SourcePill, type SourceStatus } from "./SourcePill";

export interface SourceState {
  name: string;
  status: SourceStatus;
  tier?: 1 | 2 | 3;
  resultCount?: number;
  message?: string;
}

interface RetrievalStatusStripProps {
  sources: SourceState[];
  visible?: boolean;
}

export function RetrievalStatusStrip({ sources, visible = true }: RetrievalStatusStripProps) {
  if (!visible || sources.length === 0) return null;

  return (
    <div className={styles.strip} role="status" aria-label="Retrieval progress">
      <span className={styles.label}>Sources</span>
      <div className={styles.pills}>
        {sources.map((source) => (
          <SourcePill
            key={source.name}
            name={source.name}
            status={source.status}
            tier={source.tier}
            resultCount={source.resultCount}
            message={source.message}
          />
        ))}
      </div>
    </div>
  );
}
