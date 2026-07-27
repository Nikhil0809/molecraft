import styles from "./CitationPanel.module.css";
import { CitationItem } from "./CitationItem";

export interface Citation {
  id: string;
  source: string;
  title: string;
  year?: number;
  url?: string;
  domain?: string;
  tier: 1 | 2 | 3;
}

interface CitationPanelProps {
  citations: Citation[];
}

const TIER_COLORS: Record<number, { source: string; bg: string; border: string }> = {
  1: { source: "text-indigo-400", bg: "bg-[#1e1b4b]/50", border: "border-[#312e81]/30" },
  2: { source: "text-amber-400", bg: "bg-[#1e1b4b]/50", border: "border-[#312e81]/30" },
  3: { source: "text-emerald-400", bg: "bg-[#1e1b4b]/50", border: "border-[#312e81]/30" },
};

export function CitationPanel({ citations }: CitationPanelProps) {
  if (citations.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.heading}>
            Citations
          </h2>
        </div>
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
      <div className={styles.header}>
        <h2 className={styles.heading}>
          Citations
          <span className={styles.count}>{citations.length}</span>
        </h2>
        <span className={styles.peerBadge}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7L6 9L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Peer-reviewed
        </span>
      </div>

      <div className={styles.list}>
        {citations.map((c) => (
          <CitationItem key={c.id} citation={c} />
        ))}
      </div>
    </div>
  );
}
