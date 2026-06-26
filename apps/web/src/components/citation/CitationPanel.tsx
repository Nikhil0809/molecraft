import styles from "./CitationPanel.module.css";
import { CitationGroup } from "./CitationGroup";

export interface Citation {
  id: string;
  source: string;
  title: string;
  year?: number;
  url?: string;
  tier: 1 | 2 | 3;
}

interface CitationPanelProps {
  citations: Citation[];
}

export function CitationPanel({ citations }: CitationPanelProps) {
  const tier1 = citations.filter((c) => c.tier === 1);
  const tier2 = citations.filter((c) => c.tier === 2);
  const tier3 = citations.filter((c) => c.tier === 3);

  if (citations.length === 0) {
    return (
      <div className={styles.panel}>
        <h3 className={styles.heading}>Citations</h3>
        <div className={styles.empty}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="4" width="20" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11H21M11 15H21M11 19H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>No citations available yet</p>
          <span>Run a query to see source citations</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.heading}>
        Citations
        <span className={styles.count}>{citations.length}</span>
      </h3>

      {tier1.length > 0 && (
        <CitationGroup
          tier={1}
          label="Peer-reviewed"
          citations={tier1}
        />
      )}

      {tier2.length > 0 && (
        <CitationGroup
          tier={2}
          label="Preprint"
          warning="Not peer reviewed"
          citations={tier2}
        />
      )}

      {tier3.length > 0 && (
        <CitationGroup
          tier={3}
          label="Web"
          sublabel="Supplementary context only"
          citations={tier3}
        />
      )}
    </div>
  );
}
