import styles from "./CitationItem.module.css";
import type { Citation } from "./CitationPanel";

interface CitationItemProps {
  citation: Citation;
}

export function CitationItem({ citation }: CitationItemProps) {
  return (
    <div className={styles.item}>
      <span className={styles.source}>{citation.source}</span>
      <span className={styles.title}>
        {citation.url ? (
          <a href={citation.url} target="_blank" rel="noopener noreferrer">
            {citation.title}
          </a>
        ) : (
          citation.title
        )}
      </span>
      {citation.year && <span className={styles.year}>{citation.year}</span>}
    </div>
  );
}
