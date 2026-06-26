import styles from "./CitationGroup.module.css";
import { CitationItem } from "./CitationItem";
import type { Citation } from "./CitationPanel";

interface CitationGroupProps {
  tier: 1 | 2 | 3;
  label: string;
  warning?: string;
  sublabel?: string;
  citations: Citation[];
}

export function CitationGroup({ tier, label, warning, sublabel, citations }: CitationGroupProps) {
  const tierClass = styles[`tier${tier}` as keyof typeof styles];

  return (
    <div className={`${styles.group} ${tierClass}`}>
      <div className={styles.header}>
        <span className={styles.badge}>T{tier}</span>
        <span className={styles.label}>{label}</span>
        {warning && (
          <span className={styles.warning}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              <path d="M6 5V7M6 8.5V9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            {warning}
          </span>
        )}
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      </div>
      <div className={styles.items}>
        {citations.map((c) => (
          <CitationItem key={c.id} citation={c} />
        ))}
      </div>
    </div>
  );
}
